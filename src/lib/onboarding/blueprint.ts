export const WORKSPACE_BLUEPRINT_SCHEMA_VERSION = "contentgate-workspace-v1" as const;

export type WorkspaceBlueprintRole = "admin" | "approver" | "member";

export type WorkspaceBlueprint = {
  schemaVersion: typeof WORKSPACE_BLUEPRINT_SCHEMA_VERSION;
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
  campaigns?: Array<{
    key: string;
    productKey: string;
    name: string;
    status?: "draft" | "active" | "archived";
    brief?: string;
  }>;
  documents?: Array<{
    key: string;
    productKey?: string;
    title: string;
    content?: string;
    file?: string;
    approvalStatus?: "approved" | "inactive";
  }>;
  claims?: Array<{
    key: string;
    productKey: string;
    text: string;
    sourceDocumentKey?: string;
    sourceParagraph?: number;
    status?: "approved" | "inactive";
  }>;
  assets?: Array<{
    key: string;
    productKey?: string;
    type: "background" | "image" | "logo" | "packshot";
    file: string;
    title?: string;
    altText?: string;
    tags?: string[];
    approvalStatus?: "approved" | "pending" | "rejected";
  }>;
  templateBundles?: Array<{
    key: string;
    directory: string;
    assignToProducts: string[];
  }>;
  qa?: {
    productKey: string;
    templateBundleKey?: string;
    templateName?: string;
    outputSizeKey?: string;
    outputSizeLabel?: string;
    outputWidth?: number;
    outputHeight?: number;
    knowledgeQuestion?: string;
  };
};

export type BlueprintIssueCode =
  | "duplicate"
  | "invalid_reference"
  | "invalid_type"
  | "invalid_value"
  | "missing"
  | "package_path"
  | "scale_limit"
  | "unknown_field"
  | "unsupported_version";

export type BlueprintIssue = {
  code: BlueprintIssueCode;
  path: string;
  message: string;
};

export type BlueprintPreflightReport = {
  ok: boolean;
  schemaVersion: string | null;
  workspaceKey: string | null;
  issues: BlueprintIssue[];
  counts: {
    users: number;
    products: number;
    campaigns: number;
    documents: number;
    claims: number;
    assets: number;
    templateBundles: number;
  };
  blueprint: WorkspaceBlueprint | null;
};

const KEY_PATTERN = /^[a-z0-9][a-z0-9_-]{1,62}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_COUNTS = {
  users: 50,
  products: 100,
  campaigns: 500,
  documents: 1000,
  claims: 5000,
  assets: 2000,
  templateBundles: 100,
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function issue(
  issues: BlueprintIssue[],
  code: BlueprintIssueCode,
  path: string,
  message: string,
) {
  issues.push({ code, path, message });
}

function checkUnknownFields(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
  issues: BlueprintIssue[],
) {
  const known = new Set(allowed);
  for (const field of Object.keys(value)) {
    if (!known.has(field)) {
      issue(
        issues,
        "unknown_field",
        path === "$" ? field : `${path}.${field}`,
        `Unknown field "${field}". Remove it or use a supported schema version.`,
      );
    }
  }
}

function requiredString(
  value: unknown,
  path: string,
  issues: BlueprintIssue[],
  maximum = 500,
) {
  if (typeof value !== "string" || !value.trim()) {
    issue(issues, "missing", path, "A non-empty string is required.");
    return null;
  }
  const normalized = value.trim();
  if (normalized.length > maximum) {
    issue(issues, "invalid_value", path, `Must be ${maximum} characters or fewer.`);
  }
  return normalized;
}

function optionalString(
  value: unknown,
  path: string,
  issues: BlueprintIssue[],
  maximum = 10_000,
) {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    issue(issues, "invalid_type", path, "Must be a string when provided.");
    return undefined;
  }
  const normalized = value.trim();
  if (normalized.length > maximum) {
    issue(issues, "invalid_value", path, `Must be ${maximum} characters or fewer.`);
  }
  return normalized || undefined;
}

function key(value: unknown, path: string, issues: BlueprintIssue[]) {
  const normalized = requiredString(value, path, issues, 63);
  if (normalized && !KEY_PATTERN.test(normalized)) {
    issue(
      issues,
      "invalid_value",
      path,
      "Use 2–63 lowercase letters, numbers, underscores, or hyphens; start with a letter or number.",
    );
  }
  return normalized;
}

function packagePath(value: unknown, path: string, issues: BlueprintIssue[]) {
  const normalized = requiredString(value, path, issues, 500);
  if (
    normalized &&
    (normalized.startsWith("/") ||
      normalized.startsWith("\\") ||
      /^[a-zA-Z]:[\\/]/.test(normalized) ||
      normalized.split(/[\\/]/).includes(".."))
  ) {
    issue(
      issues,
      "package_path",
      path,
      "Paths must be relative to the package and cannot contain parent-directory segments.",
    );
  }
  return normalized;
}

function array(value: unknown, path: string, issues: BlueprintIssue[], required = false) {
  if (value === undefined && !required) return [];
  if (!Array.isArray(value)) {
    issue(issues, required ? "missing" : "invalid_type", path, "Must be an array.");
    return [];
  }
  return value;
}

function enumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  path: string,
  issues: BlueprintIssue[],
  fallback: T,
) {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    issue(issues, "invalid_value", path, `Choose one of: ${allowed.join(", ")}.`);
    return fallback;
  }
  return value as T;
}

function checkUnique(values: Array<string | null>, path: string, issues: BlueprintIssue[]) {
  const seen = new Set<string>();
  values.forEach((value, index) => {
    if (!value) return;
    if (seen.has(value)) {
      issue(issues, "duplicate", `${path}.${index}.key`, `Key "${value}" is duplicated.`);
    }
    seen.add(value);
  });
}

function checkScale(
  count: number,
  name: keyof typeof MAX_COUNTS,
  issues: BlueprintIssue[],
) {
  if (count > MAX_COUNTS[name]) {
    issue(
      issues,
      "scale_limit",
      name,
      `Contains ${count} entries; the v1 safety limit is ${MAX_COUNTS[name]}. Split the package or raise the reviewed limit.`,
    );
  }
}

export function preflightWorkspaceBlueprint(input: unknown): BlueprintPreflightReport {
  const issues: BlueprintIssue[] = [];
  if (!isRecord(input)) {
    issue(issues, "invalid_type", "$", "The blueprint must be a JSON object.");
    return {
      ok: false,
      schemaVersion: null,
      workspaceKey: null,
      issues,
      counts: { users: 0, products: 0, campaigns: 0, documents: 0, claims: 0, assets: 0, templateBundles: 0 },
      blueprint: null,
    };
  }
  checkUnknownFields(
    input,
    ["schemaVersion", "workspace", "users", "products", "campaigns", "documents", "claims", "assets", "templateBundles", "qa"],
    "$",
    issues,
  );

  const schemaVersion = typeof input.schemaVersion === "string" ? input.schemaVersion : null;
  if (schemaVersion !== WORKSPACE_BLUEPRINT_SCHEMA_VERSION) {
    issue(
      issues,
      "unsupported_version",
      "schemaVersion",
      `Expected "${WORKSPACE_BLUEPRINT_SCHEMA_VERSION}".`,
    );
  }

  const workspaceInput = isRecord(input.workspace) ? input.workspace : {};
  if (!isRecord(input.workspace)) {
    issue(issues, "missing", "workspace", "Workspace configuration is required.");
  }
  checkUnknownFields(workspaceInput, ["key", "name", "industry"], "workspace", issues);
  const workspaceKey = key(workspaceInput.key, "workspace.key", issues);
  const workspaceName = requiredString(workspaceInput.name, "workspace.name", issues, 120);
  const workspaceIndustry = optionalString(workspaceInput.industry, "workspace.industry", issues, 120);

  const userInputs = array(input.users, "users", issues, true);
  const users = userInputs.map((entry, index) => {
    const value = isRecord(entry) ? entry : {};
    if (!isRecord(entry)) issue(issues, "invalid_type", `users.${index}`, "Must be an object.");
    checkUnknownFields(value, ["key", "email", "fullName", "role"], `users.${index}`, issues);
    const userKey = key(value.key, `users.${index}.key`, issues);
    const email = requiredString(value.email, `users.${index}.email`, issues, 254)?.toLowerCase() ?? null;
    if (email && !EMAIL_PATTERN.test(email)) {
      issue(issues, "invalid_value", `users.${index}.email`, "Enter a valid email address.");
    }
    return {
      key: userKey ?? "",
      email: email ?? "",
      fullName: optionalString(value.fullName, `users.${index}.fullName`, issues, 120),
      role: enumValue(value.role, ["admin", "approver", "member"], `users.${index}.role`, issues, "member"),
    };
  });
  checkUnique(users.map((entry) => entry.key), "users", issues);
  const seenEmails = new Set<string>();
  users.forEach((user, index) => {
    if (seenEmails.has(user.email)) issue(issues, "duplicate", `users.${index}.email`, `Email "${user.email}" is duplicated.`);
    seenEmails.add(user.email);
  });
  if (!users.some((user) => user.role === "admin")) {
    issue(issues, "missing", "users", "At least one workspace admin is required.");
  }

  const productInputs = array(input.products, "products", issues, true);
  const products = productInputs.map((entry, index) => {
    const value = isRecord(entry) ? entry : {};
    if (!isRecord(entry)) issue(issues, "invalid_type", `products.${index}`, "Must be an object.");
    checkUnknownFields(value, ["key", "name", "description", "disclaimer"], `products.${index}`, issues);
    return {
      key: key(value.key, `products.${index}.key`, issues) ?? "",
      name: requiredString(value.name, `products.${index}.name`, issues, 120) ?? "",
      description: optionalString(value.description, `products.${index}.description`, issues),
      disclaimer: optionalString(value.disclaimer, `products.${index}.disclaimer`, issues),
    };
  });
  checkUnique(products.map((entry) => entry.key), "products", issues);
  if (products.length === 0) issue(issues, "missing", "products", "At least one product is required.");
  const productKeys = new Set(products.map((entry) => entry.key));

  const campaignInputs = array(input.campaigns, "campaigns", issues);
  const campaigns = campaignInputs.map((entry, index) => {
    const value = isRecord(entry) ? entry : {};
    if (!isRecord(entry)) issue(issues, "invalid_type", `campaigns.${index}`, "Must be an object.");
    checkUnknownFields(value, ["key", "productKey", "name", "status", "brief"], `campaigns.${index}`, issues);
    const productKey = requiredString(value.productKey, `campaigns.${index}.productKey`, issues, 63) ?? "";
    if (productKey && !productKeys.has(productKey)) issue(issues, "invalid_reference", `campaigns.${index}.productKey`, `Product "${productKey}" does not exist.`);
    return {
      key: key(value.key, `campaigns.${index}.key`, issues) ?? "",
      productKey,
      name: requiredString(value.name, `campaigns.${index}.name`, issues, 120) ?? "",
      status: enumValue(value.status, ["draft", "active", "archived"], `campaigns.${index}.status`, issues, "draft"),
      brief: optionalString(value.brief, `campaigns.${index}.brief`, issues, 20_000),
    };
  });
  checkUnique(campaigns.map((entry) => entry.key), "campaigns", issues);

  const documentInputs = array(input.documents, "documents", issues);
  const documents = documentInputs.map((entry, index) => {
    const value = isRecord(entry) ? entry : {};
    if (!isRecord(entry)) issue(issues, "invalid_type", `documents.${index}`, "Must be an object.");
    checkUnknownFields(value, ["key", "productKey", "title", "content", "file", "approvalStatus"], `documents.${index}`, issues);
    const productKey = optionalString(value.productKey, `documents.${index}.productKey`, issues, 63);
    if (productKey && !productKeys.has(productKey)) issue(issues, "invalid_reference", `documents.${index}.productKey`, `Product "${productKey}" does not exist.`);
    const content = optionalString(value.content, `documents.${index}.content`, issues, 1_000_000);
    const file = value.file === undefined ? undefined : packagePath(value.file, `documents.${index}.file`, issues) ?? undefined;
    if (!content && !file) issue(issues, "missing", `documents.${index}`, "Provide inline content or a package-relative file.");
    return {
      key: key(value.key, `documents.${index}.key`, issues) ?? "",
      productKey,
      title: requiredString(value.title, `documents.${index}.title`, issues, 200) ?? "",
      content,
      file,
      approvalStatus: enumValue(value.approvalStatus, ["approved", "inactive"], `documents.${index}.approvalStatus`, issues, "approved"),
    };
  });
  checkUnique(documents.map((entry) => entry.key), "documents", issues);
  const documentsByKey = new Map(documents.map((entry) => [entry.key, entry]));

  const claimInputs = array(input.claims, "claims", issues);
  const claims = claimInputs.map((entry, index) => {
    const value = isRecord(entry) ? entry : {};
    if (!isRecord(entry)) issue(issues, "invalid_type", `claims.${index}`, "Must be an object.");
    checkUnknownFields(value, ["key", "productKey", "text", "sourceDocumentKey", "sourceParagraph", "status"], `claims.${index}`, issues);
    const productKey = requiredString(value.productKey, `claims.${index}.productKey`, issues, 63) ?? "";
    if (productKey && !productKeys.has(productKey)) issue(issues, "invalid_reference", `claims.${index}.productKey`, `Product "${productKey}" does not exist.`);
    const sourceDocumentKey = optionalString(value.sourceDocumentKey, `claims.${index}.sourceDocumentKey`, issues, 63);
    if (sourceDocumentKey) {
      const source = documentsByKey.get(sourceDocumentKey);
      if (!source) issue(issues, "invalid_reference", `claims.${index}.sourceDocumentKey`, `Document "${sourceDocumentKey}" does not exist.`);
      else if (source.productKey !== productKey) issue(issues, "invalid_reference", `claims.${index}.sourceDocumentKey`, "The source document must belong to the same product as the claim.");
    }
    let sourceParagraph: number | undefined;
    if (value.sourceParagraph !== undefined) {
      if (!Number.isInteger(value.sourceParagraph) || Number(value.sourceParagraph) < 1) issue(issues, "invalid_value", `claims.${index}.sourceParagraph`, "Must be a positive integer.");
      else sourceParagraph = Number(value.sourceParagraph);
    }
    if (sourceParagraph && !sourceDocumentKey) issue(issues, "invalid_reference", `claims.${index}.sourceParagraph`, "A sourceDocumentKey is required when a source paragraph is provided.");
    return {
      key: key(value.key, `claims.${index}.key`, issues) ?? "",
      productKey,
      text: requiredString(value.text, `claims.${index}.text`, issues, 2000) ?? "",
      sourceDocumentKey,
      sourceParagraph,
      status: enumValue(value.status, ["approved", "inactive"], `claims.${index}.status`, issues, "approved"),
    };
  });
  checkUnique(claims.map((entry) => entry.key), "claims", issues);

  const assetInputs = array(input.assets, "assets", issues);
  const assets = assetInputs.map((entry, index) => {
    const value = isRecord(entry) ? entry : {};
    if (!isRecord(entry)) issue(issues, "invalid_type", `assets.${index}`, "Must be an object.");
    checkUnknownFields(value, ["key", "productKey", "type", "file", "title", "altText", "tags", "approvalStatus"], `assets.${index}`, issues);
    const productKey = optionalString(value.productKey, `assets.${index}.productKey`, issues, 63);
    if (productKey && !productKeys.has(productKey)) issue(issues, "invalid_reference", `assets.${index}.productKey`, `Product "${productKey}" does not exist.`);
    const tags = value.tags === undefined ? undefined : array(value.tags, `assets.${index}.tags`, issues).map((tag, tagIndex) => requiredString(tag, `assets.${index}.tags.${tagIndex}`, issues, 40) ?? "").filter(Boolean);
    return {
      key: key(value.key, `assets.${index}.key`, issues) ?? "",
      productKey,
      type: enumValue(value.type, ["background", "image", "logo", "packshot"], `assets.${index}.type`, issues, "image"),
      file: packagePath(value.file, `assets.${index}.file`, issues) ?? "",
      title: optionalString(value.title, `assets.${index}.title`, issues, 120),
      altText: optionalString(value.altText, `assets.${index}.altText`, issues, 500),
      tags,
      approvalStatus: enumValue(value.approvalStatus, ["approved", "pending", "rejected"], `assets.${index}.approvalStatus`, issues, "approved"),
    };
  });
  checkUnique(assets.map((entry) => entry.key), "assets", issues);

  const templateInputs = array(input.templateBundles, "templateBundles", issues);
  const templateBundles = templateInputs.map((entry, index) => {
    const value = isRecord(entry) ? entry : {};
    if (!isRecord(entry)) issue(issues, "invalid_type", `templateBundles.${index}`, "Must be an object.");
    checkUnknownFields(value, ["key", "directory", "assignToProducts"], `templateBundles.${index}`, issues);
    const assignments = array(value.assignToProducts, `templateBundles.${index}.assignToProducts`, issues, true).map((item, assignmentIndex) => requiredString(item, `templateBundles.${index}.assignToProducts.${assignmentIndex}`, issues, 63) ?? "").filter(Boolean);
    assignments.forEach((productKey, assignmentIndex) => {
      if (!productKeys.has(productKey)) issue(issues, "invalid_reference", `templateBundles.${index}.assignToProducts.${assignmentIndex}`, `Product "${productKey}" does not exist.`);
    });
    if (new Set(assignments).size !== assignments.length) issue(issues, "duplicate", `templateBundles.${index}.assignToProducts`, "Product assignments must be unique.");
    return {
      key: key(value.key, `templateBundles.${index}.key`, issues) ?? "",
      directory: packagePath(value.directory, `templateBundles.${index}.directory`, issues) ?? "",
      assignToProducts: assignments,
    };
  });
  checkUnique(templateBundles.map((entry) => entry.key), "templateBundles", issues);

  let qa: WorkspaceBlueprint["qa"];
  if (input.qa !== undefined) {
    const value = isRecord(input.qa) ? input.qa : {};
    if (!isRecord(input.qa)) issue(issues, "invalid_type", "qa", "Must be an object.");
    checkUnknownFields(
      value,
      ["productKey", "templateBundleKey", "templateName", "outputSizeKey", "outputSizeLabel", "outputWidth", "outputHeight", "knowledgeQuestion"],
      "qa",
      issues,
    );
    const productKey = requiredString(value.productKey, "qa.productKey", issues, 63) ?? "";
    if (productKey && !productKeys.has(productKey)) issue(issues, "invalid_reference", "qa.productKey", `Product "${productKey}" does not exist.`);
    const templateBundleKey = optionalString(value.templateBundleKey, "qa.templateBundleKey", issues, 63);
    const qaTemplateBundle = templateBundleKey
      ? templateBundles.find((entry) => entry.key === templateBundleKey)
      : undefined;
    if (templateBundleKey && !qaTemplateBundle) {
      issue(issues, "invalid_reference", "qa.templateBundleKey", `Template bundle "${templateBundleKey}" does not exist.`);
    } else if (qaTemplateBundle && productKey && !qaTemplateBundle.assignToProducts.includes(productKey)) {
      issue(issues, "invalid_reference", "qa.templateBundleKey", `Template bundle "${templateBundleKey}" is not assigned to product "${productKey}".`);
    }
    qa = {
      productKey,
      templateBundleKey,
      templateName: optionalString(value.templateName, "qa.templateName", issues, 120),
      outputSizeKey: optionalString(value.outputSizeKey, "qa.outputSizeKey", issues, 120),
      outputSizeLabel: optionalString(value.outputSizeLabel, "qa.outputSizeLabel", issues, 120),
      outputWidth:
        Number.isInteger(value.outputWidth) && Number(value.outputWidth) > 0
          ? Number(value.outputWidth)
          : undefined,
      outputHeight:
        Number.isInteger(value.outputHeight) && Number(value.outputHeight) > 0
          ? Number(value.outputHeight)
          : undefined,
      knowledgeQuestion: optionalString(value.knowledgeQuestion, "qa.knowledgeQuestion", issues, 500),
    };
    if (value.outputWidth !== undefined && qa.outputWidth === undefined) {
      issue(issues, "invalid_value", "qa.outputWidth", "Must be a positive integer.");
    }
    if (value.outputHeight !== undefined && qa.outputHeight === undefined) {
      issue(issues, "invalid_value", "qa.outputHeight", "Must be a positive integer.");
    }
  }

  const counts = {
    users: users.length,
    products: products.length,
    campaigns: campaigns.length,
    documents: documents.length,
    claims: claims.length,
    assets: assets.length,
    templateBundles: templateBundles.length,
  };
  (Object.keys(counts) as Array<keyof typeof counts>).forEach((name) => checkScale(counts[name], name, issues));

  const blueprint: WorkspaceBlueprint = {
    schemaVersion: WORKSPACE_BLUEPRINT_SCHEMA_VERSION,
    workspace: { key: workspaceKey ?? "", name: workspaceName ?? "", ...(workspaceIndustry ? { industry: workspaceIndustry } : {}) },
    users,
    products,
    ...(campaigns.length ? { campaigns } : {}),
    ...(documents.length ? { documents } : {}),
    ...(claims.length ? { claims } : {}),
    ...(assets.length ? { assets } : {}),
    ...(templateBundles.length ? { templateBundles } : {}),
    ...(qa ? { qa } : {}),
  };

  return {
    ok: issues.length === 0,
    schemaVersion,
    workspaceKey,
    issues,
    counts,
    blueprint: issues.length === 0 ? blueprint : null,
  };
}
