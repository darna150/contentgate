"use client";

import { useState, useTransition } from "react";
import { approveContent, rejectContent } from "../actions";

export function ApprovalActions({ id }: { id: string }) {
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onApprove() {
    setError(null);
    startTransition(async () => {
      const result = await approveContent(id);
      if ("error" in result) setError(result.error);
    });
  }

  function onReject() {
    setError(null);
    startTransition(async () => {
      const result = await rejectContent(id, note);
      if ("error" in result) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-card border border-edge bg-surface p-[22px]">
      <h2 className="text-[15px] font-bold">Review</h2>
      <p className="text-[13px] leading-relaxed text-ink-muted">
        Check every claim against the sources before approving. Approval
        unlocks export.
      </p>
      {!rejecting ? (
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onApprove}
            disabled={pending}
            className="flex-1 rounded-control bg-approve px-4 py-2.5 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Working…" : "Approve"}
          </button>
          <button
            type="button"
            onClick={() => setRejecting(true)}
            disabled={pending}
            className="flex-1 rounded-control border border-reject-border px-4 py-2.5 text-[13.5px] font-semibold text-reject transition-colors hover:bg-reject-tint disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            autoFocus
            placeholder="What needs to change before this can be approved?"
            className="resize-y rounded-control border border-edge-strong bg-surface px-3.5 py-2.5 text-[13px] outline-none focus:border-reject"
          />
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={onReject}
              disabled={pending || !note.trim()}
              className="flex-1 rounded-control bg-reject px-4 py-2.5 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Working…" : "Reject with note"}
            </button>
            <button
              type="button"
              onClick={() => setRejecting(false)}
              disabled={pending}
              className="rounded-control border border-edge-strong px-4 py-2.5 text-[13.5px] font-semibold text-ink-muted hover:border-brand disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {error && (
        <p className="rounded-control border border-reject-border bg-reject-tint px-3.5 py-2.5 text-[13px] text-reject">
          {error}
        </p>
      )}
    </div>
  );
}
