export const AUDIT_EXPORT_MAX_ROWS = 10_000;
export const AUDIT_EXPORT_PAGE_SIZE = 1_000;

export type AuditExportRow = {
  id: number;
  created_at: string;
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  detail: unknown;
};

export type AuditExportFilters = {
  from: string | null;
  to: string | null;
  action: string | null;
  entityType: string | null;
};

function optionalToken(value: string | null, label: string) {
  const normalized = value?.trim() ?? "";
  if (!normalized) return null;
  if (normalized.length > 100 || !/^[a-zA-Z0-9._:-]+$/.test(normalized)) {
    throw new Error(`${label} contains unsupported characters.`);
  }
  return normalized;
}

function optionalIsoDate(value: string | null, label: string) {
  const normalized = value?.trim() ?? "";
  if (!normalized) return null;
  const date = new Date(normalized);
  if (!Number.isFinite(date.getTime())) throw new Error(`${label} must be a valid date.`);
  return date.toISOString();
}

export function parseAuditExportFilters(params: URLSearchParams): AuditExportFilters {
  const filters = {
    from: optionalIsoDate(params.get("from"), "from"),
    to: optionalIsoDate(params.get("to"), "to"),
    action: optionalToken(params.get("action"), "action"),
    entityType: optionalToken(params.get("entity_type"), "entity_type"),
  };
  if (filters.from && filters.to && filters.from > filters.to) {
    throw new Error("from must be earlier than or equal to to.");
  }
  return filters;
}

function csvCell(value: unknown) {
  let text = value == null ? "" : String(value);
  // Spreadsheet applications can execute formula-like CSV cells. Prefixing a
  // quote preserves the displayed value while forcing text interpretation.
  if (/^[\t\r\n ]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function auditRowsToCsv(rows: AuditExportRow[]) {
  const header = [
    "event_id",
    "occurred_at",
    "actor_id",
    "action",
    "entity_type",
    "entity_id",
    "detail_json",
  ];
  const lines = rows.map((row) =>
    [
      row.id,
      row.created_at,
      row.actor_id,
      row.action,
      row.entity_type,
      row.entity_id,
      row.detail == null ? "" : JSON.stringify(row.detail),
    ]
      .map(csvCell)
      .join(","),
  );
  return `\uFEFF${[header.map(csvCell).join(","), ...lines].join("\r\n")}\r\n`;
}

export function auditExportFileName(now = new Date()) {
  return `contentgate-audit-${now.toISOString().slice(0, 10).replaceAll("-", "")}.csv`;
}
