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
  rpc(fn: string, args: Record<string, unknown>): Promise<SupabaseWriteResult>;
  storage: {
    from(bucket: string): {
      upload(
        path: string,
        data: Uint8Array,
        options?: { contentType?: string; upsert?: boolean }
      ): Promise<SupabaseWriteResult>;
      remove(paths: readonly string[]): Promise<SupabaseWriteResult>;
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
          upsert: options.uploadUpsert ?? true,
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

    async insertCompiledTemplateBundle(rows: CompiledTemplateBundleImport["rows"]) {
      throwOnSupabaseError(
        await client.rpc("commit_template_bundle_import", {
          p_family: rows.family,
          p_version: rows.version,
          p_variants: rows.variants,
          p_assets: rows.assets,
          p_import_run: rows.importRun,
        }),
        "Commit template bundle import"
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
