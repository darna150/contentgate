import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

import { graphemeCount } from "../src/lib/graphemes.ts";

loadEnvConfig(process.cwd());

const mark = process.argv.includes("--mark");
const environment = process.env.CONTENTGATE_ENVIRONMENT?.trim().toLowerCase() ?? "unknown";
if (mark && environment === "production") {
  throw new Error("Refusing to mark production drafts. Run the audit without --mark.");
}
if (mark && process.env.CONTENTGATE_GENERATION_REPAIR_CONFIRM !== "MARK_INVALID_DRAFTS") {
  throw new Error(
    "Set CONTENTGATE_GENERATION_REPAIR_CONFIRM=MARK_INVALID_DRAFTS before using --mark."
  );
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

type ContentRow = {
  id: string;
  status: string;
  structured_fields: Record<string, unknown> | null;
  prompt_context: Record<string, unknown> | null;
};

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { data, error } = await admin
  .from("generated_content")
  .select("id, status, structured_fields, prompt_context")
  .neq("status", "archived")
  .limit(5_000);
if (error) throw new Error(`Could not audit generated content: ${error.message}`);

const rows = (data ?? []) as ContentRow[];
const invalid = rows.flatMap((row) => {
  const context = row.prompt_context ?? {};
  const limits =
    context.field_limits && typeof context.field_limits === "object"
      ? (context.field_limits as Record<string, { max_chars?: unknown }>)
      : {};
  const fields = row.structured_fields ?? {};
  const violations = Object.entries(limits).flatMap(([field, limit]) => {
    const hardMaximum = Number(limit?.max_chars);
    if (!Number.isInteger(hardMaximum) || hardMaximum <= 0) return [];
    const actual = graphemeCount(fields[field]);
    return actual > hardMaximum
      ? [{ field, actual, hardMaximum, overBy: actual - hardMaximum }]
      : [];
  });
  return violations.length ? [{ row, violations }] : [];
});

const byStatus = Object.fromEntries(
  [...new Set(invalid.map(({ row }) => row.status))].map((status) => [
    status,
    invalid.filter(({ row }) => row.status === status).length,
  ])
);
if (mark) {
  for (const { row, violations } of invalid) {
    if (row.status !== "draft" && row.status !== "rejected") continue;
    const { error: updateError } = await admin
      .from("generated_content")
      .update({
        prompt_context: {
          ...(row.prompt_context ?? {}),
          contract_repair_required: {
            detected_at: new Date().toISOString(),
            reason: "stored_copy_exceeds_grapheme_character_contract",
            fields: violations,
          },
        },
      })
      .eq("id", row.id);
    if (updateError) {
      throw new Error(`Could not mark ${row.id}: ${updateError.message}`);
    }
  }
}

console.log(
  JSON.stringify(
    {
      environment,
      audited: rows.length,
      invalid: invalid.length,
      byStatus,
      marked: mark
        ? invalid.filter(({ row }) => row.status === "draft" || row.status === "rejected").length
        : 0,
      approvedOrInReviewInvalid: invalid.filter(({ row }) =>
        ["approved", "in_review"].includes(row.status)
      ).length,
    },
    null,
    2
  )
);
