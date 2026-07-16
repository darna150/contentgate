"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { approveContent, rejectContent } from "../content/actions";

export function StudioReviewActions({
  contentId,
  onReviewed,
}: {
  contentId: string;
  onReviewed?: (status: "approved" | "rejected") => void;
}) {
  const router = useRouter();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onApprove() {
    setError(null);
    startTransition(async () => {
      const result = await approveContent(contentId);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      onReviewed?.("approved");
      router.refresh();
    });
  }

  function onReject() {
    setError(null);
    startTransition(async () => {
      const result = await rejectContent(contentId, note);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      onReviewed?.("rejected");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-card border border-brand/25 bg-brand-tint/30 p-5">
      <div className="flex flex-col gap-1">
        <p className="text-h2 text-ink">Review this draft</p>
        <p className="text-caption text-ink-muted">
          Check every claim against its evidence before approving. Approval unlocks export.
        </p>
      </div>
      {!rejecting ? (
        <div className="flex gap-2.5">
          <Button
            type="button"
            variant="default"
            className="flex-1 bg-approve hover:bg-approve/90"
            onClick={onApprove}
            disabled={pending}
          >
            {pending ? "Working…" : "Approve"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1 border-reject-border text-reject hover:bg-reject-tint"
            onClick={() => setRejecting(true)}
            disabled={pending}
          >
            Reject
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            autoFocus
            placeholder="What needs to change before this can be approved?"
            className="focus:border-reject"
          />
          <div className="flex gap-2.5">
            <Button
              type="button"
              variant="destructive"
              className="flex-1"
              onClick={onReject}
              disabled={pending || !note.trim()}
            >
              {pending ? "Working…" : "Reject with note"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRejecting(false)}
              disabled={pending}
            >
              Cancel
            </Button>
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
