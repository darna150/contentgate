import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

import type { CompiledTemplateBundleImport } from "./compiler";
import type {
  FailedTemplateImportRunInsert,
  TemplateBundleImportRepository,
} from "./importer";

type SupabaseWriteResult = {
  error: { message: string } | null;
};

type SupabaseMaybeSingleResult<T> = {
  data: T | null;
  error: { message: string; code?: string } | null;
};

type SupabaseSelectBuilder<T> = {
  eq(column: string, value: string): SupabaseSelectBuilder<T>;
  maybeSingle(): Promise<SupabaseMaybeSingleResult<T>>;
};

type SupabaseTemplatePlatformClient = {
  from(table: string): {
    select(columns: string): SupabaseSelectBuilder<{ id: string }>;
    insert(values: unknown): Promise<SupabaseWriteResult>;
    upsert(
      values: unknown,
      options?: { onConflict?: string; ignoreDuplicates?: boolean }
    ): Promise<SupabaseWriteResult>;
  };
  storage: {
    from(bucket: string): {
      upload(
        path: string,
        data: Uint8Array,
        options?: { contentType?: string; upsert?: boolean }
      ): Promise<SupabaseWriteResult>;
    };
  };
};

function throwOnSupabaseError(result: SupabaseWriteResult, action: string) {
  if (result.error) throw new Error(`${action}: ${result.error.message}`);
}

export function createSupabaseTemplateBundleRepository(
  client: SupabaseTemplatePlatformClient = createAdminClient() as unknown as SupabaseTemplatePlatformClient,
  options: { uploadUpsert?: boolean } = {}
): TemplateBundleImportRepository {
  return {
    async findTemplateFamilyId(input) {
      const result = await client
        .from("template_families")
        .select("id")
        .eq("org_id", input.orgId)
        .eq("family_key", input.familyKey)
        .maybeSingle();
      if (result.error) {
        throw new Error(`Find template family: ${result.error.message}`);
      }
      return result.data?.id ?? null;
    },

    async uploadTemplateAsset(input) {
      const result = await client.storage
        .from(input.bucket)
        .upload(input.path, input.data, {
          contentType: input.contentType ?? undefined,
          upsert: options.uploadUpsert ?? false,
        });
      throwOnSupabaseError(result, `Upload template asset ${input.path}`);
    },

    async insertCompiledTemplateBundle(rows: CompiledTemplateBundleImport["rows"]) {
      throwOnSupabaseError(
        await client.from("template_families").upsert(rows.family, {
          onConflict: "org_id,family_key",
          ignoreDuplicates: true,
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

    async insertFailedTemplateImportRun(row: FailedTemplateImportRunInsert) {
      throwOnSupabaseError(
        await client.from("template_import_runs").insert(row),
        "Insert failed template import run"
      );
    },
  };
}
