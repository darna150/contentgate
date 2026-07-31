import { strToU8, unzipSync, zip, zipSync } from "fflate";

import {
  WORKSPACE_BLUEPRINT_SCHEMA_VERSION,
  preflightWorkspaceBlueprint,
  type WorkspaceBlueprint,
  type WorkspaceBlueprintRole,
} from "./blueprint.ts";

const MAX_PACKAGE_BYTES = 50 * 1024 * 1024;
const MAX_TEMPLATE_ENTRIES = 5_000;

export type PackageBuilderFile = {
  name: string;
  bytes: Uint8Array;
};

export type PackageBuilderDraft = {
  workspace: {
    key: string;
    name: string;
    industry?: string;
  };
  users: Array<{
    key: string;
    email: string;
    fullName?: string;
    role: WorkspaceBlueprintRole;
  }>;
  products: Array<{
    key: string;
    name: string;
    description?: string;
    disclaimer?: string;
  }>;
  campaigns: Array<{
    key: string;
    productKey: string;
    name: string;
    status: "draft" | "active" | "archived";
    brief?: string;
  }>;
  documents: Array<{
    key: string;
    productKey?: string;
    title: string;
    approvalStatus: "approved" | "inactive";
    content?: string;
    file?: PackageBuilderFile;
  }>;
  claims: Array<{
    key: string;
    productKey: string;
    text: string;
    sourceDocumentKey?: string;
    sourceParagraph?: number;
    status: "approved" | "inactive";
  }>;
  assets: Array<{
    key: string;
    productKey?: string;
    type: "background" | "image" | "logo" | "packshot";
    title?: string;
    altText?: string;
    tags?: string[];
    approvalStatus: "approved" | "pending" | "rejected";
    file: PackageBuilderFile;
  }>;
  templateBundles: Array<{
    key: string;
    assignToProducts: string[];
    archive: PackageBuilderFile;
  }>;
  qa?: WorkspaceBlueprint["qa"];
  review: {
    preparedBy: string;
    clientApprovalReference: string;
    rightsConfirmed: boolean;
    templateSignoffConfirmed: boolean;
  };
};

export type BuiltWorkspacePackage = {
  bytes: Uint8Array;
  fileName: string;
  blueprint: WorkspaceBlueprint;
  summary: string;
};

function clean(value: string | undefined) {
  const normalized = value?.trim();
  return normalized || undefined;
}

export function workspaceKeyFromName(value: string) {
  const normalized = value
    .replace(/[™®©]/g, "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
  if (normalized.length >= 2) return normalized;
  return normalized ? `${normalized}-workspace` : "client-workspace";
}

function safeFileName(value: string) {
  const normalized = value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "file";
}

function safeArchivePath(value: string) {
  if (!value || value.startsWith("/") || value.includes("\\") || value.includes("\0")) return false;
  const parts = value.replace(/^\.\//, "").split("/");
  return parts.every((part) => part !== "" && part !== "." && part !== "..");
}

function templateEntries(input: PackageBuilderDraft["templateBundles"][number]) {
  let raw: Record<string, Uint8Array>;
  try {
    raw = unzipSync(input.archive.bytes);
  } catch {
    throw new Error(`Template bundle "${input.key}" is not a readable ZIP archive.`);
  }

  const files = Object.entries(raw).filter(([name]) => !name.endsWith("/"));
  if (files.length === 0 || files.length > MAX_TEMPLATE_ENTRIES) {
    throw new Error(`Template bundle "${input.key}" must contain 1–${MAX_TEMPLATE_ENTRIES} files.`);
  }
  for (const [name] of files) {
    if (!safeArchivePath(name)) throw new Error(`Template bundle "${input.key}" contains an unsafe path: ${name}`);
  }

  const manifests = files.filter(([name]) => name === "manifest.json" || name.endsWith("/manifest.json"));
  if (manifests.length !== 1) {
    throw new Error(`Template bundle "${input.key}" must contain exactly one manifest.json.`);
  }
  const prefix = manifests[0][0].slice(0, -"manifest.json".length);
  if (files.some(([name]) => !name.startsWith(prefix))) {
    throw new Error(`Template bundle "${input.key}" must use one common root folder.`);
  }

  return files.map(([name, bytes]) => [
    `templates/${input.key}/${name.slice(prefix.length)}`,
    bytes,
  ] as const);
}

function reviewMarkdown(draft: PackageBuilderDraft, blueprint: WorkspaceBlueprint) {
  const lines = [
    "# ContentGate onboarding package review",
    "",
    `Workspace: ${blueprint.workspace.name} (${blueprint.workspace.key})`,
    `Prepared by: ${draft.review.preparedBy.trim()}`,
    `Client approval reference: ${draft.review.clientApprovalReference.trim()}`,
    `Created: ${new Date().toISOString()}`,
    "",
    "## Attestations",
    "",
    `- Asset usage rights confirmed: ${draft.review.rightsConfirmed ? "yes" : "no"}`,
    `- Template contract sign-off confirmed: ${draft.review.templateSignoffConfirmed ? "yes" : "no"}`,
    "",
    "## Package counts",
    "",
    `- Users: ${blueprint.users.length}`,
    `- Products: ${blueprint.products.length}`,
    `- Campaigns: ${blueprint.campaigns?.length ?? 0}`,
    `- Documents: ${blueprint.documents?.length ?? 0}`,
    `- Claims: ${blueprint.claims?.length ?? 0}`,
    `- Assets: ${blueprint.assets?.length ?? 0}`,
    `- Template bundles: ${blueprint.templateBundles?.length ?? 0}`,
    "",
    "This file records the delivery handoff. ContentGate server preflight remains the technical source of truth.",
    "",
  ];
  return lines.join("\n");
}

function prepareWorkspacePackage(draft: PackageBuilderDraft) {
  if (!draft.review.preparedBy.trim()) throw new Error("Enter the ContentGate preparer name.");
  if (!draft.review.clientApprovalReference.trim()) {
    throw new Error("Enter the client approval reference, such as an email date or signed brief ID.");
  }
  if (!draft.review.rightsConfirmed) throw new Error("Confirm that asset and font usage rights were reviewed.");
  if (!draft.review.templateSignoffConfirmed) throw new Error("Confirm that the template contract was signed off.");

  const entries: Record<string, Uint8Array> = {};
  const documents = draft.documents.map((document) => {
    const file = document.file;
    const path = file ? `knowledge/${document.key}-${safeFileName(file.name)}` : undefined;
    if (file && path) entries[path] = file.bytes;
    return {
      key: document.key.trim(),
      productKey: clean(document.productKey),
      title: document.title.trim(),
      content: clean(document.content),
      file: path,
      approvalStatus: document.approvalStatus,
    };
  });

  const assets = draft.assets.map((asset) => {
    const path = `assets/${asset.key}-${safeFileName(asset.file.name)}`;
    entries[path] = asset.file.bytes;
    return {
      key: asset.key.trim(),
      productKey: clean(asset.productKey),
      type: asset.type,
      file: path,
      title: clean(asset.title),
      altText: clean(asset.altText),
      tags: asset.tags?.map((tag) => tag.trim()).filter(Boolean),
      approvalStatus: asset.approvalStatus,
    };
  });

  const templateBundles = draft.templateBundles.map((bundle) => {
    for (const [path, bytes] of templateEntries(bundle)) {
      if (entries[path]) throw new Error(`The package contains the duplicate path "${path}".`);
      entries[path] = bytes;
    }
    return {
      key: bundle.key.trim(),
      directory: `templates/${bundle.key.trim()}`,
      assignToProducts: bundle.assignToProducts,
    };
  });

  const blueprint: WorkspaceBlueprint = {
    schemaVersion: WORKSPACE_BLUEPRINT_SCHEMA_VERSION,
    workspace: {
      key: draft.workspace.key.trim(),
      name: draft.workspace.name.trim(),
      industry: clean(draft.workspace.industry),
    },
    users: draft.users.map((user) => ({
      key: user.key.trim(),
      email: user.email.trim().toLowerCase(),
      fullName: clean(user.fullName),
      role: user.role,
    })),
    products: draft.products.map((product) => ({
      key: product.key.trim(),
      name: product.name.trim(),
      description: clean(product.description),
      disclaimer: clean(product.disclaimer),
    })),
    campaigns: draft.campaigns.map((campaign) => ({
      key: campaign.key.trim(),
      productKey: campaign.productKey,
      name: campaign.name.trim(),
      status: campaign.status,
      brief: clean(campaign.brief),
    })),
    documents,
    claims: draft.claims.map((claim) => ({
      key: claim.key.trim(),
      productKey: claim.productKey,
      text: claim.text.trim(),
      sourceDocumentKey: clean(claim.sourceDocumentKey),
      sourceParagraph: claim.sourceParagraph,
      status: claim.status,
    })),
    assets,
    templateBundles,
    qa: draft.qa,
  };

  const report = preflightWorkspaceBlueprint(blueprint);
  if (!report.ok || !report.blueprint) {
    throw new Error(report.issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n"));
  }

  entries["blueprint.json"] = strToU8(`${JSON.stringify(report.blueprint, null, 2)}\n`);
  const summary = reviewMarkdown(draft, report.blueprint);
  entries["PACKAGE_REVIEW.md"] = strToU8(summary);
  return { entries, blueprint: report.blueprint, summary };
}

function completedPackage(
  blueprint: WorkspaceBlueprint,
  summary: string,
  bytes: Uint8Array,
): BuiltWorkspacePackage {
  if (bytes.byteLength > MAX_PACKAGE_BYTES) {
    throw new Error("The generated ZIP exceeds the 50 MB onboarding limit. Split or optimize the source files.");
  }
  return {
    bytes,
    fileName: `${blueprint.workspace.key}-onboarding.zip`,
    blueprint,
    summary,
  };
}

export function buildWorkspacePackage(draft: PackageBuilderDraft): BuiltWorkspacePackage {
  const prepared = prepareWorkspacePackage(draft);
  return completedPackage(
    prepared.blueprint,
    prepared.summary,
    zipSync(prepared.entries, { level: 6 }),
  );
}

export async function buildWorkspacePackageAsync(draft: PackageBuilderDraft) {
  const prepared = prepareWorkspacePackage(draft);
  const bytes = await new Promise<Uint8Array>((resolve, reject) => {
    zip(prepared.entries, { level: 6 }, (error, value) => {
      if (error) reject(error);
      else resolve(value);
    });
  });
  return completedPackage(prepared.blueprint, prepared.summary, bytes);
}
