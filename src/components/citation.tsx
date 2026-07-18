"use client";

import Link from "next/link";
import { useState } from "react";

export type CitationData = {
  documentId?: string | null;
  documentTitle: string;
  excerpt: string;
  paragraphN?: number | null;
};

/**
 * The ¶-numbered citation — ContentGate's core-promise component. Compact
 * form: a quiet pill (¶N + doc title), click to expand the quoted
 * paragraph inline. Used by Ask (chat citations, question history) and
 * anywhere else a generated answer needs to show its approved-source trail.
 */
export function CitationChip({ citation, defaultOpen = false }: { citation: CitationData; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const { documentId, documentTitle, excerpt, paragraphN } = citation;

  return (
    <div className="flex flex-col gap-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 self-start rounded-full border border-edge bg-page px-3 py-1.5 text-left transition-colors hover:border-brand"
        aria-expanded={open}
      >
        {paragraphN != null && <span className="text-[11.5px] font-bold text-brand">¶{paragraphN}</span>}
        <span className="text-[12px] font-semibold text-ink-muted">{documentTitle}</span>
      </button>
      {open && (
        <div className="mt-1.5 flex flex-col gap-1.5 rounded-[8px] border-l-[3px] border-brand bg-[#fafafa] px-4 py-3">
          <p className="text-[12.5px] leading-relaxed italic text-ink-muted">&ldquo;{excerpt}&rdquo;</p>
          {documentId && (
            <Link
              href={paragraphN != null ? `/knowledge/${documentId}#p-${paragraphN}` : `/knowledge/${documentId}`}
              className="text-[11.5px] font-semibold text-brand hover:underline"
            >
              View in Source Documents →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

export function CitationList({ citations, label = "From approved sources" }: { citations: CitationData[]; label?: string }) {
  if (citations.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <span className="text-label text-brand">{label}</span>
      <div className="flex flex-wrap gap-2">
        {citations.map((c, i) => (
          <CitationChip key={`${c.documentId ?? c.documentTitle}-${c.paragraphN ?? i}`} citation={c} />
        ))}
      </div>
    </div>
  );
}

/**
 * Full form (Source Documents detail): the ¶N badge rendered beside a
 * source paragraph's text. Also usable anywhere a citation traces to a
 * specific, addressable paragraph of an approved document.
 */
export function ParagraphMark({ n, id }: { n: number; id?: string }) {
  return (
    <span
      id={id}
      className="mt-0.5 flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full border border-approve-border bg-brand-tint px-1.5 text-[11px] font-bold text-brand"
    >
      ¶{n}
    </span>
  );
}
