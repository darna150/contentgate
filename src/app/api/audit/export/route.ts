import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminMfaRequest } from "@/lib/auth/admin-mfa";
import {
  AUDIT_EXPORT_MAX_ROWS,
  AUDIT_EXPORT_PAGE_SIZE,
  auditExportFileName,
  auditRowsToCsv,
  parseAuditExportFilters,
  type AuditExportFilters,
  type AuditExportRow,
} from "@/lib/audit-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdminMfaRequest();
  if ("error" in auth) return auth.error;

  let filters: AuditExportFilters;
  try {
    filters = parseAuditExportFilters(new URL(request.url).searchParams);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid audit export filters." },
      { status: 400 },
    );
  }

  const { supabase, userId, orgId } = auth.value;
  let countQuery = supabase
    .from("audit_log")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId);
  if (filters.from) countQuery = countQuery.gte("created_at", filters.from);
  if (filters.to) countQuery = countQuery.lte("created_at", filters.to);
  if (filters.action) countQuery = countQuery.eq("action", filters.action);
  if (filters.entityType) countQuery = countQuery.eq("entity_type", filters.entityType);
  const { count, error: countError } = await countQuery;
  if (countError) {
    console.error("audit export count failed:", countError.message);
    return Response.json({ error: "Audit export is temporarily unavailable." }, { status: 503 });
  }
  if ((count ?? 0) > AUDIT_EXPORT_MAX_ROWS) {
    return Response.json(
      {
        error: `This export contains more than ${AUDIT_EXPORT_MAX_ROWS.toLocaleString("en-US")} events. Add date or event filters and try again.`,
        matchingEvents: count,
      },
      { status: 422 },
    );
  }

  const rows: AuditExportRow[] = [];
  for (let offset = 0; offset < (count ?? 0); offset += AUDIT_EXPORT_PAGE_SIZE) {
    let pageQuery = supabase
      .from("audit_log")
      .select("id, created_at, actor_id, action, entity_type, entity_id, detail")
      .eq("org_id", orgId);
    if (filters.from) pageQuery = pageQuery.gte("created_at", filters.from);
    if (filters.to) pageQuery = pageQuery.lte("created_at", filters.to);
    if (filters.action) pageQuery = pageQuery.eq("action", filters.action);
    if (filters.entityType) pageQuery = pageQuery.eq("entity_type", filters.entityType);
    const { data, error } = await pageQuery
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, Math.min(offset + AUDIT_EXPORT_PAGE_SIZE - 1, (count ?? 0) - 1));
    if (error) {
      console.error("audit export page failed:", error.message);
      return Response.json({ error: "Audit export is temporarily unavailable." }, { status: 503 });
    }
    rows.push(...((data ?? []) as AuditExportRow[]));
  }

  const audit = createAdminClient();
  const { error: receiptError } = await audit.from("audit_log").insert({
    org_id: orgId,
    actor_id: userId,
    action: "audit.exported",
    entity_type: "organization",
    entity_id: orgId,
    detail: {
      exported_event_count: rows.length,
      filters,
      format: "csv",
    },
  });
  if (receiptError) {
    console.error("audit export receipt failed:", receiptError.message);
    return Response.json(
      { error: "The export could not be recorded and was not released." },
      { status: 503 },
    );
  }

  return new Response(auditRowsToCsv(rows), {
    status: 200,
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${auditExportFileName()}"`,
      "Content-Type": "text/csv; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "X-ContentGate-Audit-Event-Count": String(rows.length),
    },
  });
}
