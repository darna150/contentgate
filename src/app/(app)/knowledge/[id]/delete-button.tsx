"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { deleteDocument } from "../actions";

export function DeleteDocumentButton({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirming) confirmButtonRef.current?.focus();
  }, [confirming]);

  function cancelDelete() {
    setConfirming(false);
    window.requestAnimationFrame(() => deleteButtonRef.current?.focus());
  }

  if (!confirming) {
    return (
      <button
        ref={deleteButtonRef}
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-control border border-edge-strong px-4 py-2 text-[13px] font-semibold text-ink-muted transition-colors hover:border-reject hover:text-reject"
      >
        Delete
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2" role="group" aria-labelledby="delete-document-prompt">
      <span id="delete-document-prompt" className="text-[13px] text-ink-muted">Delete this document?</span>
      <button
        ref={confirmButtonRef}
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
        onClick={cancelDelete}
        className="rounded-control border border-edge-strong px-4 py-2 text-[13px] font-semibold text-ink-muted hover:border-brand hover:text-brand disabled:opacity-50"
      >
        Cancel
      </button>
    </div>
  );
}
