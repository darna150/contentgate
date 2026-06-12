"use client";

import { useState, useTransition } from "react";
import { deleteDocument } from "../actions";

export function DeleteDocumentButton({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-control border border-edge-strong px-4 py-2 text-[13px] font-semibold text-ink-muted transition-colors hover:border-reject hover:text-reject"
      >
        Delete
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-[13px] text-ink-muted">Delete this document?</span>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => deleteDocument(id))}
        className="rounded-control bg-reject px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Deleting…" : "Yes, delete"}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => setConfirming(false)}
        className="rounded-control border border-edge-strong px-4 py-2 text-[13px] font-semibold text-ink-muted hover:border-brand hover:text-brand disabled:opacity-50"
      >
        Cancel
      </button>
    </div>
  );
}
