"use client";

import { useState } from "react";
import { CitationList } from "@/components/citation";

type Citation = { document_title: string; excerpt: string };
type HistoryItem = {
  id: string;
  question: string;
  answer: string | null;
  citations: Citation[];
  not_found: boolean;
  product_name: string;
  created_at: string;
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// A member's own question history. Click a question to expand the saved
// answer + citations inline — no second API call, free to browse.
export function MemberHistory({ items }: { items: HistoryItem[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 rounded-card border border-edge bg-surface p-[22px]">
      <h2 className="text-[15px] font-bold">Your recent questions</h2>
      <ul className="flex flex-col">
        {items.map((item) => {
          const open = openId === item.id;
          return (
            <li key={item.id} className="border-b border-edge last:border-0">
              <button
                onClick={() => setOpenId(open ? null : item.id)}
                className="flex w-full items-start gap-3 py-3 text-left"
              >
                <span
                  className={`mt-1 text-[10px] text-ink-faint transition-transform ${
                    open ? "rotate-90" : ""
                  }`}
                >
                  ▶
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[13.5px] font-medium text-ink">
                    {item.question}
                  </span>
                  <span className="text-[11.5px] text-ink-faint">
                    {item.product_name} · {timeAgo(item.created_at)}
                  </span>
                </span>
                {item.not_found && (
                  <span className="mt-0.5 whitespace-nowrap rounded-[5px] bg-reject-tint px-[6px] py-0.5 text-[9.5px] font-bold uppercase tracking-[0.05em] text-reject">
                    No match
                  </span>
                )}
              </button>

              {open && (
                <div className="flex flex-col gap-2.5 pb-4 pl-6 pr-1">
                  <div
                    className={`rounded-[10px] border border-edge bg-page px-4 py-3 text-[13px] leading-relaxed ${
                      item.not_found ? "italic text-ink-muted" : "text-ink"
                    }`}
                  >
                    {item.answer || "No answer was recorded for this question."}
                  </div>

                  <CitationList
                    citations={item.citations.map((c) => ({
                      documentTitle: c.document_title,
                      excerpt: c.excerpt,
                    }))}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
