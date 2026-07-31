"use client";

import { useActionState, useMemo, useRef, useState, useTransition } from "react";
import {
  createDocument,
  inspectSourceUrl,
  type CreateDocumentState,
} from "../actions";
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
  const [sourceMode, setSourceMode] = useState<"document" | "website">("document");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileNote, setFileNote] = useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [importedUrl, setImportedUrl] = useState<string | null>(null);
  const [importNote, setImportNote] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importPending, startImportTransition] = useTransition();
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
        "The file will be attached and its text will be extracted when you save. Paste text below only if you want to review or correct it first."
      );
    }
  }

  function chooseMode(mode: "document" | "website") {
    setSourceMode(mode);
    setImportError(null);
    if (mode === "website") {
      setFileName(null);
      setFileNote(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function importWebsite() {
    setImportError(null);
    setImportNote(null);
    startImportTransition(async () => {
      const result = await inspectSourceUrl(sourceUrl);
      if (!result.ok) {
        setImportedUrl(null);
        setImportError(result.error);
        return;
      }

      setSourceUrl(result.url);
      setImportedUrl(result.url);
      setTitle(result.title);
      setContent(result.content);
      setImportNote(
        result.aiAssisted
          ? "AI prepared the page as citable knowledge. Review the title and source text before saving."
          : "The page was extracted, but AI cleanup was unavailable. Review the source text carefully before saving."
      );
    });
  }

  return (
    <form action={formAction} className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[1.45fr_1fr]">
      <div className="flex flex-col gap-5 rounded-card border border-edge bg-surface p-6">
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold">Knowledge source</span>
          <div className="grid grid-cols-2 gap-1 rounded-[10px] border border-edge bg-page p-1">
            <button
              type="button"
              onClick={() => chooseMode("document")}
              aria-pressed={sourceMode === "document"}
              className={`rounded-[7px] px-3 py-2 text-[13px] font-semibold transition-colors ${
                sourceMode === "document"
                  ? "bg-surface text-ink shadow-sm"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              Upload or paste
            </button>
            <button
              type="button"
              onClick={() => chooseMode("website")}
              aria-pressed={sourceMode === "website"}
              className={`rounded-[7px] px-3 py-2 text-[13px] font-semibold transition-colors ${
                sourceMode === "website"
                  ? "bg-surface text-ink shadow-sm"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              Import from website
            </button>
          </div>
        </div>

        {sourceMode === "website" && (
          <div className="flex flex-col gap-2 rounded-[10px] border border-brand/20 bg-brand-tint/40 p-4">
            <div className="flex flex-col gap-1">
              <span className="text-[13px] font-semibold text-ink">Public webpage URL</span>
              <span className="text-[12px] leading-relaxed text-ink-muted">
                AI will remove page chrome, identify useful brand knowledge, and prepare citable paragraphs for your approval.
              </span>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="url"
                value={sourceUrl}
                onChange={(event) => {
                  setSourceUrl(event.target.value);
                  setImportedUrl(null);
                  setImportNote(null);
                  setImportError(null);
                }}
                placeholder="https://client.com/product-page"
                className="min-w-0 flex-1 rounded-control border border-edge-strong bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-brand"
              />
              <button
                type="button"
                onClick={importWebsite}
                disabled={importPending || !sourceUrl.trim()}
                className="shrink-0 rounded-control bg-brand px-4 py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {importPending ? "AI importing…" : "Import with AI"}
              </button>
            </div>
            <input type="hidden" name="source_url" value={importedUrl ?? ""} />
            {importError && (
              <p aria-live="polite" className="text-[12.5px] text-reject">
                {importError}
              </p>
            )}
            {importNote && (
              <p aria-live="polite" className="text-[12.5px] leading-relaxed text-brand">
                {importNote}
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold">Title</span>
            <input
              name="title"
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
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
                Unassigned / library only
              </option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {sourceMode === "document" && (
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
              className="flex flex-col items-center gap-1.5 rounded-[10px] border-[1.5px] border-dashed border-edge-strong bg-page px-6 py-6 transition-colors hover:border-brand"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-brand" aria-hidden>
                <path d="M10 13V4M6.5 7.5L10 4l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M3.5 13.5v1.5a2 2 0 002 2h9a2 2 0 002-2v-1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
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
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold">Document text</span>
          <textarea
            name="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={
              sourceMode === "website"
                ? "Import a webpage above, then review its AI-prepared source text here."
                : "Optional: paste or correct approved text here. If left blank, supported files are extracted after submission."
            }
            rows={14}
            className="resize-y rounded-control border border-edge-strong bg-surface px-3.5 py-3 text-sm leading-relaxed outline-none focus:border-brand"
          />
        </label>

        {state?.error && (
          <p role="alert" className="rounded-control border border-reject-border bg-reject-tint px-3.5 py-3 text-[13px] text-reject">
            {state.error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending || importPending || (sourceMode === "website" && !importedUrl)}
            className="shrink-0 whitespace-nowrap rounded-control bg-brand px-[18px] py-2.5 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Saving…" : sourceMode === "website" ? "Approve and save source" : "Save source document"}
          </button>
          <span className="text-[12.5px] text-ink-faint">
            Assign a product before Ask can use this source. Unassigned sources remain in the library.
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3.5 rounded-card border border-edge bg-surface p-[22px]">
        <div className="flex items-center gap-2">
          <h2 className="text-[15px] font-bold">Paragraph preview</h2>
          <span className="rounded-[5px] bg-brand-tint px-[7px] py-0.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-brand-on-tint">
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
                <span className="mt-0.5 shrink-0 text-[11.5px] font-bold text-brand-strong">
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
