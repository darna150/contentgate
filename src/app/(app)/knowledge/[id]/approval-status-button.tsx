"use client";

import { useState, useTransition } from "react";
import { setDocumentApprovalStatus } from "../actions";

export function DocumentApprovalStatusButton({
  id,
  approvalStatus,
}: {
  id: string;
  approvalStatus: "approved" | "inactive";
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const deactivate = approvalStatus === "approved";

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              await setDocumentApprovalStatus(id, deactivate ? "inactive" : "approved");
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : "Could not update source status.");
            }
          });
        }}
        className="rounded-control border border-edge-strong px-4 py-2 text-[13px] font-semibold text-ink-muted transition-colors hover:border-brand hover:text-brand disabled:opacity-50"
      >
        {pending ? "Updating…" : deactivate ? "Deactivate source" : "Reactivate source"}
      </button>
      {error && <p className="max-w-[230px] text-right text-[11px] text-reject">{error}</p>}
    </div>
  );
}
