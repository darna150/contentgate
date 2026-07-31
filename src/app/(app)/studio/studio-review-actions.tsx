"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { useUiUxMeasurement } from "@/components/uiux-measurement-provider";
import { Textarea } from "@/components/ui/textarea";
import { approveContent, rejectContent } from "../content/actions";

export function StudioReviewActions({
  contentId,
  onReviewed,
}: {
  contentId: string;
  onReviewed?: (status: "approved" | "rejected", note?: string | null) => void;
}) {
  const router = useRouter();
  const { track } = useUiUxMeasurement();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [feedbackCategory, setFeedbackCategory] = useState("Claim or evidence");
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
      track("review_decision", { decision: "approved" });
      router.refresh();
    });
  }

  function onReject() {
    setError(null);
    startTransition(async () => {
      const formattedNote = `${feedbackCategory}: ${note.trim()}`;
      const result = await rejectContent(contentId, formattedNote);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      onReviewed?.("rejected", formattedNote);
      track("review_decision", { decision: "request_changes", change_reason: feedbackCategory });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-card border border-brand/25 bg-brand-tint/30 p-5">
      <div className="flex flex-col gap-1">
        <p className="text-h2 text-ink">Review this draft</p>
        <p className="text-caption text-ink-muted">
          Check changed copy, visual choices, fit, and evidence before deciding. Approval unlocks export for this exact revision.
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
            Request changes
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          <p className="text-[13px] leading-5 text-ink-muted">Requesting changes returns this exact revision to the author. An explanation is required so they can act safely.</p>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink">
            Feedback category
            <select
              value={feedbackCategory}
              onChange={(event) => setFeedbackCategory(event.target.value)}
              className="h-10 rounded-control border border-edge-strong bg-surface px-3 text-[13px] font-normal text-ink outline-none focus:border-reject"
            >
              <option>Claim or evidence</option>
              <option>Copy or message</option>
              <option>Visual choice</option>
              <option>Fit or layout</option>
              <option>Other</option>
            </select>
          </label>
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
              {pending ? "Working…" : "Request changes"}
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
