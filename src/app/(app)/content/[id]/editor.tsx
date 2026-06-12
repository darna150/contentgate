"use client";

import { useState, useTransition } from "react";
import { updateContentBody, submitForReview } from "../actions";

export function ContentEditor({
  id,
  initialBody,
  status,
}: {
  id: string;
  initialBody: string;
  status: string;
}) {
  const [body, setBody] = useState(initialBody);
  const [savedBody, setSavedBody] = useState(initialBody);
  const [message, setMessage] = useState<
    { kind: "ok" | "error"; text: string } | null
  >(null);
  const [pending, startTransition] = useTransition();

  const dirty = body !== savedBody;
  const canSubmit = (status === "draft" || status === "rejected") && !dirty;

  function onSave() {
    setMessage(null);
    startTransition(async () => {
      const result = await updateContentBody(id, body);
      if ("error" in result) {
        setMessage({ kind: "error", text: result.error });
      } else {
        setSavedBody(body);
        setMessage({
          kind: "ok",
          text:
            status === "approved"
              ? "Saved — editing approved content moved it back to draft for re-review."
              : "Saved.",
        });
      }
    });
  }

  function onSubmit() {
    setMessage(null);
    startTransition(async () => {
      const result = await submitForReview(id);
      if ("error" in result) {
        setMessage({ kind: "error", text: result.error });
      } else {
        setMessage({ kind: "ok", text: "Submitted to the Approval Queue." });
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={16}
        className="w-full resize-y rounded-control border border-edge-strong bg-surface px-4 py-3.5 text-sm leading-[1.7] outline-none focus:border-brand"
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={pending || !dirty}
          className="rounded-control border border-edge-strong bg-surface px-[18px] py-2.5 text-[13.5px] font-semibold transition-colors hover:border-brand disabled:opacity-50"
        >
          {pending ? "Working…" : "Save changes"}
        </button>
        {(status === "draft" || status === "rejected") && (
          <button
            type="button"
            onClick={onSubmit}
            disabled={pending || !canSubmit}
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
  );
}
