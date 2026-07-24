import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { createClient } from "@supabase/supabase-js";

import { buildContentGateTemplateBundle } from "../../src/lib/template-platform/contentgate-bundle.ts";
import {
  importTemplateBundle,
  type TemplateBundleAssetSource,
  type TemplateBundleImportRepository,
} from "../../src/lib/template-platform/importer.ts";
import { loadTemplateBundleDirectory } from "../../src/lib/template-platform/bundle-directory.ts";
import {
  formatTemplateBundlePreflightReport,
  preflightTemplateBundle,
} from "../../src/lib/template-platform/preflight.ts";
import type { TemplateBundleManifest } from "../../src/lib/template-platform/manifest.ts";
import {
  buildProductTemplateAssignmentUpsert,
  decideTemplateVersionPublish,
} from "../../src/lib/template-platform/publishing.ts";

type QueryResult = { data: unknown; error: { message: string } | null };

type QueryBuilder = PromiseLike<QueryResult> & {
  eq(column: string, value: unknown): QueryBuilder;
  insert(values: unknown): QueryBuilder;
  limit(count: number): QueryBuilder;
  maybeSingle(): Promise<QueryResult>;
  order(column: string, options: { ascending: boolean }): QueryBuilder;
  select(columns: string): QueryBuilder;
  single(): Promise<QueryResult>;
  update(values: Record<string, unknown>): QueryBuilder;
  upsert(values: unknown, options?: { onConflict?: string }): QueryBuilder;
};

type AdminClient = {
  from(table: string): QueryBuilder;
  storage: {
    from(bucket: string): {
      upload(
        path: string,
        data: Uint8Array,
        options?: { contentType?: string; upsert?: boolean }
      ): Promise<{ error: { message: string } | null }>;
      remove(paths: readonly string[]): Promise<{ error: { message: string } | null }>;
    };
  };
};

function throwOnSupabaseError(
  result: { error: { message: string } | null },
  action: string
) {
  if (result.error) throw new Error(`${action}: ${result.error.message}`);
}

function isMissingTemplatePlatformSchema(error: unknown) {
  return (
    error instanceof Error &&
    (error.message.includes("template_families") ||
      error.message.includes("template_versions") ||
      error.message.includes("product_template_assignments")) &&
    error.message.includes("schema cache")
  );
}

function createCliTemplateBundleRepository(
  client: AdminClient
): TemplateBundleImportRepository {
  return {
    async findTemplateFamilyId(input) {
      const { data, error } = await client
        .from("template_families")
        .select("id")
        .eq("org_id", input.orgId)
        .eq("family_key", input.familyKey)
        .maybeSingle();
      if (error) throw new Error(`Find template family: ${error.message}`);
      return asIdRow(data)?.id ?? null;
    },
    async uploadTemplateAsset(input) {
      const result = await client.storage.from(input.bucket).upload(input.path, input.data, {
        contentType: input.contentType ?? undefined,
        upsert: true,
      });
      throwOnSupabaseError(result, `Upload template asset ${input.path}`);
    },
    async removeTemplateAssets(input) {
      if (input.paths.length === 0) return;
      throwOnSupabaseError(
        await client.storage.from(input.bucket).remove(input.paths),
        "Remove uploaded template assets"
      );
    },
    async insertCompiledTemplateBundle(rows) {
      throwOnSupabaseError(
        await client.from("template_families").upsert(rows.family, {
          onConflict: "org_id,family_key",
        }),
        "Upsert template family"
      );
      throwOnSupabaseError(
        await client.from("template_versions").insert(rows.version),
        "Insert template version"
      );
      throwOnSupabaseError(
        await client.from("template_variants").insert(rows.variants),
        "Insert template variants"
      );
      throwOnSupabaseError(
        await client.from("template_assets").insert(rows.assets),
        "Insert template assets"
      );
      throwOnSupabaseError(
        await client.from("template_import_runs").insert(rows.importRun),
        "Insert template import run"
      );
    },
    async insertFailedTemplateImportRun(row) {
      throwOnSupabaseError(
        await client.from("template_import_runs").insert(row),
        "Insert failed template import run"
      );
    },
  };
}

type ContentGateTarget = {
  layoutKey: "contentgate_local_friendly" | "contentgate_local_premium";
  figwrightBundleFolder: string;
  defaultVariantKey: string;
};

type CliOptions = {
  bundleRoot?: string;
  bundleSource: "auto" | "figwright" | "bundled";
  orgId?: string;
  productIds: string[];
  productName?: string;
  assign: boolean;
  dryRun: boolean;
};

type ExistingTemplateVersion = {
  id: string;
  family_id: string;
  status: "draft" | "published" | "ready" | "retired" | "validating";
  manifest: TemplateBundleManifest;
};

const CONTENTGATE_PRODUCT_ID = "20000000-0000-0000-0000-000000000001";

const targets: ContentGateTarget[] = [
  {
    layoutKey: "contentgate_local_friendly",
    figwrightBundleFolder: "local-friendly-v1",
    defaultVariantKey: "square",
  },
  {
    layoutKey: "contentgate_local_premium",
    figwrightBundleFolder: "local-premium-v1",
    defaultVariantKey: "square",
  },
];

function loadDotEnvLocal() {
  const path = join(process.cwd(), ".env.local");
  if (!existsSync(path)) return;

  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    bundleRoot: join(process.cwd(), ".template-bundles", "figwright-contentgate"),
    bundleSource: "auto",
    productIds: [],
    productName: "ContentGate",
    assign: true,
    dryRun: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];
    switch (arg) {
      case "--org-id":
        options.orgId = next;
        index += 1;
        break;
      case "--product-id":
        if (next) options.productIds.push(next);
        index += 1;
        break;
      case "--product-name":
        options.productName = next;
        index += 1;
        break;
      case "--no-assign":
        options.assign = false;
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--bundle-root":
        options.bundleRoot = next;
        index += 1;
        break;
      case "--bundle-source":
        if (next !== "auto" && next !== "figwright" && next !== "bundled") {
          throw new Error("--bundle-source must be auto, figwright, or bundled.");
        }
        options.bundleSource = next;
        index += 1;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required. Add it to .env.local or the environment.`);
  return value;
}

function defaultStoragePrefix(manifest: TemplateBundleManifest) {
  return ["template-bundles", manifest.family.key, manifest.version.name].join("/");
}

type InstallableContentGateBundle = {
  source: "figwright" | "bundled";
  manifest: TemplateBundleManifest;
  assets: TemplateBundleAssetSource[];
};

async function loadContentGateBundle(input: {
  options: CliOptions;
  target: ContentGateTarget;
}): Promise<InstallableContentGateBundle> {
  const figwrightDirectory = join(
    input.options.bundleRoot ?? "",
    input.target.figwrightBundleFolder,
    "bundle"
  );
  const shouldTryFigwright =
    input.options.bundleSource === "figwright" ||
    (input.options.bundleSource === "auto" && existsSync(join(figwrightDirectory, "manifest.json")));

  if (shouldTryFigwright) {
    if (!existsSync(join(figwrightDirectory, "manifest.json"))) {
      throw new Error(
        `Figwright bundle is missing: ${figwrightDirectory}. Run npm run figwright:export-contentgate-bundles first.`
      );
    }
    const bundle = await loadTemplateBundleDirectory(figwrightDirectory);
    return {
      source: "figwright",
      manifest: bundle.manifest,
      assets: bundle.assets,
    };
  }

  const bundle = await buildContentGateTemplateBundle(input.target.layoutKey);
  return {
    source: "bundled",
    manifest: bundle.manifest,
    assets: bundle.assets,
  };
}

function asIdRow(value: unknown): { id: string } | null {
  return value !== null &&
    typeof value === "object" &&
    "id" in value &&
    typeof value.id === "string"
    ? { id: value.id }
    : null;
}

async function getOrgId(supabase: AdminClient, requestedOrgId?: string) {
  if (requestedOrgId) return requestedOrgId;

  const { data, error } = await supabase
    .from("organizations")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .single();
  if (error || !data) throw new Error(`Could not resolve organization: ${error?.message}`);
  const row = asIdRow(data);
  if (!row) throw new Error("Could not resolve organization.");
  return row.id;
}

async function getProductIds(input: {
  supabase: AdminClient;
  orgId: string;
  options: CliOptions;
}) {
  if (!input.options.assign) return [];
  if (input.options.productIds.length > 0) return input.options.productIds;

  const { data: seededProduct } = await input.supabase
    .from("products")
    .select("id")
    .eq("org_id", input.orgId)
    .eq("id", CONTENTGATE_PRODUCT_ID)
    .maybeSingle();
  const seededProductRow = asIdRow(seededProduct);
  if (seededProductRow) return [seededProductRow.id];

  if (!input.options.productName) return [];
  const { data, error } = await input.supabase
    .from("products")
    .select("id")
    .eq("org_id", input.orgId)
    .eq("name", input.options.productName)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Could not resolve product: ${error.message}`);
  const row = asIdRow(data);
  return row ? [row.id] : [];
}

async function findExistingTemplateVersion(input: {
  supabase: AdminClient;
  orgId: string;
  manifest: TemplateBundleManifest;
}): Promise<ExistingTemplateVersion | null> {
  const { data: family, error: familyError } = await input.supabase
    .from("template_families")
    .select("id")
    .eq("org_id", input.orgId)
    .eq("family_key", input.manifest.family.key)
    .maybeSingle();
  if (familyError) throw new Error(`Find template family: ${familyError.message}`);
  const familyRow = asIdRow(family);
  if (!familyRow) return null;

  const { data: version, error: versionError } = await input.supabase
    .from("template_versions")
    .select("id, family_id, status, manifest")
    .eq("org_id", input.orgId)
    .eq("family_id", familyRow.id)
    .eq("version_label", input.manifest.version.name)
    .maybeSingle();
  if (versionError) throw new Error(`Find template version: ${versionError.message}`);
  return (version as ExistingTemplateVersion | null) ?? null;
}

async function publishTemplateVersion(input: {
  supabase: AdminClient;
  orgId: string;
  version: ExistingTemplateVersion;
}) {
  const decision = decideTemplateVersionPublish(input.version.status);
  if (!decision.ok) throw new Error(decision.reason);
  if (decision.alreadyPublished) return "already-published";

  const publishedAt = new Date().toISOString();
  const { error: familyError } = await input.supabase
    .from("template_families")
    .update({ status: "active", updated_at: publishedAt })
    .eq("org_id", input.orgId)
    .eq("id", input.version.family_id);
  if (familyError) throw new Error(`Activate template family: ${familyError.message}`);

  const { error: versionError } = await input.supabase
    .from("template_versions")
    .update({ status: "published", published_at: publishedAt })
    .eq("org_id", input.orgId)
    .eq("id", input.version.id);
  if (versionError) throw new Error(`Publish template version: ${versionError.message}`);
  input.version.status = "published";
  return "published";
}

async function assignTemplateToProducts(input: {
  supabase: AdminClient;
  orgId: string;
  productIds: string[];
  version: ExistingTemplateVersion;
  defaultVariantKey: string;
}) {
  for (const productId of input.productIds) {
    const assignment = buildProductTemplateAssignmentUpsert({
      orgId: input.orgId,
      productId,
      templateFamilyId: input.version.family_id,
      templateVersionId: input.version.id,
      manifest: input.version.manifest,
      defaultVariantKey: input.defaultVariantKey,
    });
    if (!assignment.ok) throw new Error(assignment.reason);

    const { data, error } = await input.supabase
      .from("product_template_assignments")
      .upsert(
        { ...assignment.row, updated_at: new Date().toISOString() },
        { onConflict: "org_id,product_id,template_family_id" }
      )
      .select("id")
      .single();
    const row = asIdRow(data);
    if (error || !row) throw new Error(`Assign template to product ${productId}: ${error?.message}`);
    console.log(`  assigned to product ${productId}: ${row.id}`);
  }
}

async function installTarget(input: {
  options: CliOptions;
  supabase: AdminClient;
  orgId: string;
  productIds: string[];
  target: ContentGateTarget;
}) {
  const bundle = await loadContentGateBundle({
    options: input.options,
    target: input.target,
  });
  const report = await preflightTemplateBundle({ manifest: bundle.manifest });
  if (!report.ok) {
    throw new Error(formatTemplateBundlePreflightReport(report));
  }

  let version = await findExistingTemplateVersion({
    supabase: input.supabase,
    orgId: input.orgId,
    manifest: bundle.manifest,
  });

  if (!version) {
    const result = await importTemplateBundle(
      {
        manifest: bundle.manifest,
        assets: bundle.assets,
        orgId: input.orgId,
        createdBy: null,
        storagePrefix: defaultStoragePrefix(bundle.manifest),
      },
      createCliTemplateBundleRepository(input.supabase)
    );
    if (!result.ok) {
      throw new Error(
        `Import failed for ${bundle.manifest.family.key}: ${result.issues
          .map((issue) => `${issue.path}: ${issue.message}`)
          .join("; ")}`
      );
    }
    version = {
      id: result.value.rows.version.id,
      family_id: result.value.rows.family.id,
      status: result.value.rows.version.status,
      manifest: result.value.rows.version.manifest,
    };
    console.log(`Imported ${bundle.manifest.family.key}@${bundle.manifest.version.name} from ${bundle.source}: ${version.id}`);
  } else {
    console.log(`Found ${bundle.manifest.family.key}@${bundle.manifest.version.name} from ${bundle.source}: ${version.id}`);
  }

  const publishStatus = await publishTemplateVersion({
    supabase: input.supabase,
    orgId: input.orgId,
    version,
  });
  console.log(`  ${publishStatus}`);

  await assignTemplateToProducts({
    supabase: input.supabase,
    orgId: input.orgId,
    productIds: input.productIds,
    version,
    defaultVariantKey: input.target.defaultVariantKey,
  });
}

async function main() {
  loadDotEnvLocal();
  const options = parseArgs(process.argv.slice(2));

  if (options.dryRun) {
    console.log("Dry run: building and validating local ContentGate platform bundles.");
    for (const target of targets) {
      const bundle = await loadContentGateBundle({ options, target });
      const report = await preflightTemplateBundle({ manifest: bundle.manifest });
      console.log(formatTemplateBundlePreflightReport(report));
      if (!report.ok) throw new Error(`${bundle.manifest.family.key} failed preflight.`);
      console.log(
        `${bundle.manifest.family.key}@${bundle.manifest.version.name} from ${bundle.source}: ${bundle.manifest.variants.length} variants, ${bundle.assets.length} assets`
      );
    }
    return;
  }

  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } }
  ) as unknown as AdminClient;

  const orgId = await getOrgId(supabase, options.orgId);
  const productIds = await getProductIds({ supabase, orgId, options });
  if (options.assign && productIds.length === 0) {
    throw new Error(
      "No product found to assign. Pass --product-id, --product-name, or --no-assign."
    );
  }

  console.log(`Installing ContentGate platform templates for org ${orgId}`);
  if (productIds.length > 0) console.log(`Assigning to products: ${productIds.join(", ")}`);

  for (const target of targets) {
    await installTarget({ options, supabase, orgId, productIds, target });
  }
}

main().catch((error) => {
  if (isMissingTemplatePlatformSchema(error)) {
    console.error(
      [
        "Template Platform tables are not present in Supabase yet.",
        "",
        "Apply these migrations in Supabase SQL Editor, then rerun:",
        "1. supabase/migrations/20260714183000_template_platform_v1_foundation.sql",
        "2. supabase/migrations/20260714190000_template_bundle_storage.sql",
        "",
        "You can generate one paste-ready SQL file with:",
        "npm run template-platform:write-migration-sql",
        "",
        error.message,
      ].join("\n")
    );
    process.exit(1);
  }
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
