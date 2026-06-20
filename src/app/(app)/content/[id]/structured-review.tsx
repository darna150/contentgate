"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { updateStructuredFields, submitForReview } from "../actions";
import { fieldLabel, type Evidence } from "@/lib/templates";
import { fieldLimitText, type FieldLimits } from "@/lib/template-fields";

export function StructuredReview({
  id,
  status,
  initialFields,
  order,
  evidence,
  limits,
}: {
  id: string;
  status: string;
  initialFields: Record<string, string>;
  order: string[];
  evidence: Evidence[];
  limits: FieldLimits;
}) {
  const router = useRouter();
  const [fields, setFields] = useState(initialFields);
  const [savedFields, setSavedFields] = useState(initialFields);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty = useMemo(
    () => order.some((k) => (fields[k] ?? "") !== (savedFields[k] ?? "")),
    [fields, savedFields, order]
  );
  const canSubmit = (status === "draft" || status === "rejected") && !dirty;
  const evidenceFor = (field: string) =>
    evidence.filter((e) => e.field === field).map((e) => e.approved_source);

  function setField(k: string, v: string) {
    setFields((prev) => ({ ...prev, [k]: v }));
  }

  function onSave() {
    setMessage(null);
    startTransition(async () => {
      const res = await updateStructuredFields(id, fields);
      if ("error" in res) setMessage({ kind: "error", text: res.error });
      else {
        setSavedFields(fields);
        setMessage({
          kind: "ok",
          text:
            status === "approved"
              ? "Saved. Editing approved content moved it back to draft."
              : "Saved.",
        });
        router.refresh();
      }
    });
  }

  function onSubmit() {
    setMessage(null);
    startTransition(async () => {
      const res = await submitForReview(id);
      if ("error" in res) setMessage({ kind: "error", text: res.error });
      else router.refresh();
    });
  }

  const busy = pending;

  return (
    <div className="flex flex-col gap-5">
      {/* Fields with inline evidence */}
      <div className="flex flex-col gap-4 rounded-card border border-edge bg-surface p-6">
        <h2 className="text-[15px] font-bold">Content fields</h2>
        <div className="flex flex-col gap-4">
          {order.map((key) => {
            const sources = evidenceFor(key);
            const isHeadline = key === "headline";
            const rows = limits[key]?.max_lines ?? (key === "body" ? 4 : 2);
            return (
              <div key={key} className="flex flex-col gap-1.5">
                <label className="text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-faint">
                  {fieldLabel(key)}{" "}
                  <span className="font-normal normal-case tracking-normal">
                    · {fieldLimitText(limits[key])}
                  </span>
                </label>
                <textarea
                  value={fields[key] ?? ""}
                  onChange={(e) => setField(key, e.target.value)}
                  disabled={busy}
                  maxLength={limits[key]?.max_chars}
                  rows={rows}
                  className={
                    isHeadline
                      ? "resize-y rounded-control border border-edge-strong bg-surface px-3.5 py-2.5 text-[14px] font-semibold leading-snug outline-none focus:border-brand"
                      : "resize-y rounded-control border border-edge-strong bg-surface px-3.5 py-2.5 text-[13.5px] leading-relaxed outline-none focus:border-brand"
                  }
                />
                {sources.length > 0 && (
                  <div className="flex flex-col gap-1 rounded-control border border-approve-border bg-approve-tint px-3 py-2">
                    <span className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-approve">
                      Evidence
                    </span>
                    {sources.map((s, i) => (
                      <span key={i} className="text-[11.5px] leading-snug text-ink-muted">
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-edge pt-4">
          <button
            type="button"
            onClick={onSave}
            disabled={busy || !dirty}
            className="rounded-control border border-edge-strong bg-surface px-[18px] py-2.5 text-[13.5px] font-semibold transition-colors hover:border-brand disabled:opacity-50"
          >
            {pending ? "Working…" : "Save changes"}
          </button>
          {(status === "draft" || status === "rejected") && (
            <button
              type="button"
              onClick={onSubmit}
              disabled={busy || !canSubmit}
              title={dirty ? "Save your changes first" : undefined}
              className="rounded-control bg-brand-dark px-[18px] py-2.5 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Submit for review
            </button>
          )}
          {message && (
            <span
              className={`text-[12.5px] font-semibold ${
                message.kind === "ok" ? "text-approve" : "text-reject"
              }`}
            >
              {message.text}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
