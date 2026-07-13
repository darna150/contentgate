export type ContentHistoryEvent = {
  id: number;
  actor_name: string;
  revision_number: number;
  event_type: string;
  detail: Record<string, unknown> | null;
  created_at: string;
};

export type ContentRevisionSummary = {
  id: number;
  revision_number: number;
  actor_name: string;
  change_kind: string;
  created_at: string;
};

const EVENT_LABELS: Record<string, string> = {
  "content.created": "Content created",
  "content.generated": "Copy generated",
  "content.edited": "Content edited",
  "content.submitted": "Submitted for review",
  "content.approved": "Approved",
  "content.rejected": "Changes requested",
  "content.approval_revoked": "Approval revoked after edit",
  "content.exported": "Exported",
};

const CHANGE_LABELS: Record<string, string> = {
  baseline: "Baseline snapshot",
  generated: "Generated",
  regenerated: "Regenerated",
  manual_edit: "Manual edit",
};

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function eventDetail(event: ContentHistoryEvent) {
  const detail = event.detail ?? {};
  if (event.event_type === "content.rejected" && typeof detail.note === "string") {
    return detail.note;
  }
  if (event.event_type === "content.exported" && typeof detail.format === "string") {
    const format = detail.format.replaceAll("_", " ").toUpperCase();
    return typeof detail.size === "string" ? `${format} · ${detail.size}` : format;
  }
  return null;
}

export function ContentHistory({
  currentRevision,
  approvedRevision,
  events,
  revisions,
}: {
  currentRevision: number;
  approvedRevision: number | null;
  events: ContentHistoryEvent[];
  revisions: ContentRevisionSummary[];
}) {
  return (
    <section className="flex flex-col gap-4 rounded-card border border-edge bg-surface p-[22px]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-[15px] font-bold">History</h2>
          <p className="text-[12px] text-ink-faint">
            Revision {currentRevision}
            {approvedRevision ? ` · revision ${approvedRevision} approved` : " · not approved"}
          </p>
        </div>
        <span className="text-[11px] font-semibold text-ink-muted">
          {revisions.length} {revisions.length === 1 ? "snapshot" : "snapshots"}
        </span>
      </div>

      <ol className="flex flex-col border-l border-edge pl-4">
        {events.length === 0 ? (
          <li className="pb-1 text-[12.5px] text-ink-faint">No events recorded yet.</li>
        ) : (
          events.map((event) => {
            const detail = eventDetail(event);
            return (
              <li key={event.id} className="relative border-b border-edge py-3 last:border-0 last:pb-0 first:pt-0">
                <span className="absolute -left-[21px] top-[17px] h-2 w-2 rounded-full border-2 border-surface bg-brand first:top-1" />
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-semibold text-ink">
                      {EVENT_LABELS[event.event_type] ?? event.event_type}
                    </p>
                    <p className="mt-0.5 text-[11.5px] text-ink-muted">
                      {event.actor_name} · revision {event.revision_number}
                    </p>
                    {detail && (
                      <p className="mt-1 break-words text-[11.5px] leading-relaxed text-ink-muted">
                        {detail}
                      </p>
                    )}
                  </div>
                  <time className="shrink-0 text-right text-[10.5px] leading-relaxed text-ink-faint">
                    {formatTimestamp(event.created_at)}
                  </time>
                </div>
              </li>
            );
          })
        )}
      </ol>

      {revisions.length > 0 && (
        <div className="border-t border-edge pt-3">
          <p className="mb-2 text-[11px] font-bold uppercase text-ink-faint">
            Immutable revisions
          </p>
          <ul className="flex flex-col gap-1.5">
            {revisions.map((revision) => (
              <li
                key={revision.id}
                className="flex items-center justify-between gap-3 text-[11.5px] text-ink-muted"
              >
                <span className="font-semibold text-ink">
                  Revision {revision.revision_number} · {CHANGE_LABELS[revision.change_kind] ?? revision.change_kind}
                </span>
                <span className="shrink-0">{revision.actor_name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
