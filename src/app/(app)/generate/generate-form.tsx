"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { saveDraft } from "./actions";

export type DocOption = { id: string; title: string; product: string | null };
export type TemplateOption = {
  id: string;
  name: string;
  description: string | null;
  output_type: string;
};

const LANGUAGES = [
  "English",
  "Filipino",
  "Spanish",
  "Portuguese",
  "French",
  "German",
  "Bahasa Indonesia",
  "Vietnamese",
  "Thai",
  "Japanese",
];

const TONES = ["Professional", "Friendly"];

type Phase =
  | { kind: "idle" }
  | { kind: "streaming" }
  | { kind: "done" }
  | { kind: "saving" }
  | { kind: "saved"; id: string }
  | { kind: "error"; message: string };

export function GenerateForm({
  docs,
  templates,
}: {
  docs: DocOption[];
  templates: TemplateOption[];
}) {
  const [templateId, setTemplateId] = useState<string | null>(
    templates[0]?.id ?? null
  );
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [audience, setAudience] = useState("");
  const [language, setLanguage] = useState("English");
  const [tone, setTone] = useState("Professional");
  const [keyMessage, setKeyMessage] = useState("");
  const [output, setOutput] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const abortRef = useRef<AbortController | null>(null);

  const template = templates.find((t) => t.id === templateId) ?? null;
  const canGenerate =
    !!templateId && selectedDocs.size > 0 && phase.kind !== "streaming";

  function toggleDoc(id: string) {
    setSelectedDocs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function generate() {
    if (!canGenerate) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setOutput("");
    setPhase({ kind: "streaming" });
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          templateId,
          documentIds: [...selectedDocs],
          audience,
          language,
          tone,
          keyMessage,
        }),
      });
      if (!res.ok || !res.body) {
        const message = await res.text();
        setPhase({ kind: "error", message: message || `Generation failed (${res.status}).` });
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setOutput(text);
      }
      setPhase({ kind: "done" });
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setPhase({ kind: "error", message: "Generation failed — try again." });
    }
  }

  async function onSave() {
    if (!template || !output.trim()) return;
    setPhase({ kind: "saving" });
    const result = await saveDraft({
      title: `${template.name} · ${language}`,
      body: output,
      templateId: template.id,
      documentIds: [...selectedDocs],
      audience,
      language,
    });
    if ("error" in result) {
      setPhase({ kind: "error", message: result.error });
    } else {
      setPhase({ kind: "saved", id: result.id });
    }
  }

  if (docs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-edge-strong bg-surface px-8 py-16 text-center">
        <p className="text-[15px] font-semibold">Add documents first</p>
        <p className="max-w-md text-sm text-ink-muted">
          The generator only writes from approved sources — there&apos;s nothing
          to ground content in yet.
        </p>
        <Link
          href="/knowledge/new"
          className="mt-2 rounded-control bg-brand px-[18px] py-2.5 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90"
        >
          Add a document
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[1fr_1.15fr] items-start gap-5">
      <div className="flex flex-col gap-5 rounded-card border border-edge bg-surface p-6">
        <h2 className="text-[15px] font-bold">Brief</h2>

        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold">Source documents</span>
          <div className="flex max-h-56 flex-col gap-1 overflow-y-auto">
            {docs.map((doc) => {
              const checked = selectedDocs.has(doc.id);
              return (
                <label
                  key={doc.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-control border px-3 py-2.5 transition-colors ${
                    checked
                      ? "border-brand bg-brand-tint"
                      : "border-edge-strong hover:border-brand"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleDoc(doc.id)}
                    className="accent-[#0E5F58]"
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-[13.5px] font-semibold">
                      {doc.title}
                    </span>
                    {doc.product && (
                      <span className="text-[11.5px] text-ink-faint">
                        {doc.product}
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold">Channel</span>
          <div className="grid grid-cols-3 gap-2.5">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTemplateId(t.id)}
                className={`flex flex-col items-center gap-1.5 rounded-[10px] border px-2.5 py-3 text-[12.5px] font-semibold transition-colors ${
                  templateId === t.id
                    ? "border-brand bg-brand-tint"
                    : "border-edge-strong hover:border-brand"
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
          {template?.description && (
            <p className="text-[12px] text-ink-faint">{template.description}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3.5">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold">Language</span>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="rounded-control border border-edge-strong bg-surface px-3 py-2.5 text-[13.5px] outline-none focus:border-brand"
            >
              {LANGUAGES.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </label>
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold">Tone</span>
            <div className="flex gap-2">
              {TONES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTone(t)}
                  className={`flex-1 rounded-control border py-2.5 text-[12.5px] font-semibold transition-colors ${
                    tone === t
                      ? "border-brand bg-brand-tint text-brand"
                      : "border-edge-strong text-ink-muted hover:border-brand"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold">
            Audience <span className="font-normal text-ink-faint">(optional)</span>
          </span>
          <input
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            placeholder="e.g. Pet owners, clinic staff, distributors"
            className="rounded-control border border-edge-strong bg-surface px-3.5 py-2.5 text-[13.5px] outline-none focus:border-brand"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold">
            Key message <span className="font-normal text-ink-faint">(optional)</span>
          </span>
          <textarea
            value={keyMessage}
            onChange={(e) => setKeyMessage(e.target.value)}
            rows={3}
            placeholder="e.g. Announce availability at local vet clinics; highlight 12-week protection."
            className="resize-y rounded-control border border-edge-strong bg-surface px-3.5 py-2.5 text-[13.5px] outline-none focus:border-brand"
          />
        </label>

        <button
          type="button"
          disabled={!canGenerate}
          onClick={generate}
          className="rounded-control bg-brand px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {phase.kind === "streaming" ? "Generating…" : "Generate content"}
        </button>
        <p className="-mt-2 text-xs text-ink-faint">
          Uses only the selected approved documents — nothing else.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {output === "" && phase.kind !== "streaming" ? (
          <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 rounded-card border-[1.5px] border-dashed border-[#C7D0C9] bg-[#FAFBF9] px-8 text-center">
            <p className="text-sm font-semibold text-ink-faint">
              Generated content appears here
            </p>
            <p className="max-w-xs text-[12.5px] leading-relaxed text-ink-faint">
              Pick your source documents and a channel, then generate. Drafts
              are saved for review — nothing publishes without approval.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-card border border-edge bg-surface">
            <div className="flex items-center gap-2.5 border-b border-edge px-[22px] py-4">
              <span className="text-sm font-bold">
                {template?.name ?? "Draft"} · {language}
              </span>
              {phase.kind === "streaming" && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-tint px-[9px] py-0.5 text-[11.5px] font-semibold text-brand">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                  Writing…
                </span>
              )}
            </div>
            <div className="whitespace-pre-wrap px-[22px] py-5 text-sm leading-[1.7]">
              {output}
            </div>
          </div>
        )}

        {(phase.kind === "done" ||
          phase.kind === "saving" ||
          phase.kind === "saved") && (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={generate}
              disabled={phase.kind === "saving"}
              className="flex-1 rounded-control border border-edge-strong bg-surface py-3 text-[13.5px] font-semibold transition-colors hover:border-brand disabled:opacity-50"
            >
              Regenerate
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={phase.kind !== "done"}
              className="flex-[2] rounded-control bg-brand-dark py-3 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {phase.kind === "saving"
                ? "Saving…"
                : phase.kind === "saved"
                  ? "Saved"
                  : "Save as draft"}
            </button>
          </div>
        )}

        {phase.kind === "saved" && (
          <div className="flex items-center gap-3 rounded-[10px] border border-approve-border bg-approve-tint px-[18px] py-[15px]">
            <span className="flex flex-1 flex-col">
              <span className="text-[13.5px] font-bold text-approve">
                Saved as draft
              </span>
              <span className="text-[12.5px] text-ink-muted">
                Editing and the approval flow arrive on sprint Days 4–5.
              </span>
            </span>
          </div>
        )}

        {phase.kind === "error" && (
          <p className="rounded-control border border-reject-border bg-reject-tint px-3.5 py-3 text-[13px] text-reject">
            {phase.message}
          </p>
        )}
      </div>
    </div>
  );
}
