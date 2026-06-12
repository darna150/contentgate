"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { createDocument, type CreateDocumentState } from "../actions";
import { segmentParagraphs } from "@/lib/paragraphs";

const TEXT_EXTENSIONS = /\.(txt|md|markdown|csv)$/i;

export function AddDocumentForm() {
  const [state, formAction, pending] = useActionState<CreateDocumentState, FormData>(
    createDocument,
    null
  );
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileNote, setFileNote] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const paragraphs = useMemo(() => segmentParagraphs(content), [content]);

  async function onFileChosen(file: File | null) {
    if (!file) {
      setFileName(null);
      setFileNote(null);
      return;
    }
    setFileName(file.name);
    if (TEXT_EXTENSIONS.test(file.name) || file.type.startsWith("text/")) {
      const text = await file.text();
      setContent(text);
      setFileNote("Text extracted — review and edit it below before saving.");
    } else {
      setFileNote(
        "The original file will be attached for reference, but its text can't be auto-extracted yet — paste the document text below."
      );
    }
  }

  return (
    <form action={formAction} className="grid grid-cols-[1.45fr_1fr] items-start gap-5">
      <div className="flex flex-col gap-5 rounded-card border border-edge bg-surface p-6">
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold">Title</span>
            <input
              name="title"
              required
              placeholder="e.g. FleaShield Duo · Claim sheet 2026"
              className="rounded-control border border-edge-strong bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-brand"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold">
              Product <span className="font-normal text-ink-faint">(optional)</span>
            </span>
            <input
              name="product"
              placeholder="e.g. FleaShield Duo"
              className="rounded-control border border-edge-strong bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-brand"
            />
          </label>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold">Source file <span className="font-normal text-ink-faint">(optional)</span></span>
          <input
            ref={fileInputRef}
            type="file"
            name="file"
            className="hidden"
            onChange={(e) => onFileChosen(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center gap-1.5 rounded-[10px] border-[1.5px] border-dashed border-[#C7D0C9] bg-[#FAFBF9] px-6 py-6 transition-colors hover:border-brand"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path d="M10 13V4M6.5 7.5L10 4l3.5 3.5" stroke="#0E5F58" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3.5 13.5v1.5a2 2 0 002 2h9a2 2 0 002-2v-1.5" stroke="#0E5F58" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <span className="text-[13.5px] font-semibold">
              {fileName ?? "Browse for a file"}
            </span>
            <span className="text-xs text-ink-faint">
              TXT and Markdown are extracted automatically · PDF/DOCX attach as reference
            </span>
          </button>
          {fileNote && (
            <p className="rounded-control border border-edge bg-page px-3.5 py-2.5 text-[13px] text-ink-muted">
              {fileNote}
            </p>
          )}
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold">Document text</span>
          <textarea
            name="content"
            required
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Paste the approved document text here. Separate paragraphs with a blank line — each paragraph becomes a citable source."
            rows={14}
            className="resize-y rounded-control border border-edge-strong bg-surface px-3.5 py-3 text-sm leading-relaxed outline-none focus:border-brand"
          />
        </label>

        {state?.error && (
          <p className="rounded-control border border-reject-border bg-reject-tint px-3.5 py-3 text-[13px] text-reject">
            {state.error}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-control bg-brand px-[18px] py-2.5 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save to Knowledge Hub"}
          </button>
          <span className="text-[12.5px] text-ink-faint">
            Saved documents become available to the Content Generator.
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3.5 rounded-card border border-edge bg-surface p-[22px]">
        <div className="flex items-center gap-2">
          <h2 className="text-[15px] font-bold">Paragraph preview</h2>
          <span className="rounded-[5px] bg-brand-tint px-[7px] py-0.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-brand">
            {paragraphs.length} citable
          </span>
        </div>
        {paragraphs.length === 0 ? (
          <p className="text-[13px] leading-relaxed text-ink-faint">
            As you add text, it&apos;s split into numbered paragraphs. Generated
            content cites these numbers — &ldquo;Supporting sources: ¶3, ¶8&rdquo;
            — so reviewers can check every claim against the source.
          </p>
        ) : (
          <ol className="flex max-h-[480px] flex-col gap-2.5 overflow-y-auto">
            {paragraphs.map((p) => (
              <li key={p.n} className="flex gap-2.5">
                <span className="mt-0.5 shrink-0 text-[11.5px] font-bold text-brand">
                  ¶{p.n}
                </span>
                <span className="line-clamp-3 text-[12.5px] leading-relaxed text-ink-muted">
                  {p.text}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </form>
  );
}
