"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { createDocument, type CreateDocumentState } from "../actions";
import { segmentParagraphs } from "@/lib/paragraphs";

const TEXT_EXTENSIONS = /\.(txt|md|markdown|csv)$/i;
const DOCUMENT_ACCEPT =
  ".txt,.md,.markdown,.csv,.html,.htm,.pdf,.docx,.pptx,.xlsx,.rtf,.odt,.odp,.ods,image/*";

export function AddDocumentForm({
  products,
  defaultProductId,
}: {
  products: { id: string; name: string }[];
  defaultProductId?: string;
}) {
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
            <span className="text-[13px] font-semibold">Product</span>
            <select
              name="product_id"
              defaultValue={defaultProductId ?? ""}
              className="rounded-control border border-edge-strong bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-brand"
            >
              <option value="">
                All products / workspace-wide
              </option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold">Source file <span className="font-normal text-ink-faint">(optional)</span></span>
          <input
            ref={fileInputRef}
            type="file"
            name="file"
            accept={DOCUMENT_ACCEPT}
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
              PDF, DOCX, PPTX, spreadsheets, text, and common office formats
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
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Optional: paste or correct approved text here. If left blank, supported files are extracted after submission."
            rows={14}
            className="resize-y rounded-control border border-edge-strong bg-surface px-3.5 py-3 text-sm leading-relaxed outline-none focus:border-brand"
          />
        </label>

        {state?.error && (
          <p className="rounded-control border border-reject-border bg-reject-tint px-3.5 py-3 text-[13px] text-reject">
            {state.error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="shrink-0 whitespace-nowrap rounded-control bg-brand px-[18px] py-2.5 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save source document"}
          </button>
          <span className="text-[12.5px] text-ink-faint">
            Product assignment is optional. Workspace-wide sources apply to every product.
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
