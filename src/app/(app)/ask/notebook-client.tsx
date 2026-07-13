"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  createSession,
  saveSession,
  deleteSession,
  renameSession,
} from "./actions";
import type { Citation, SessionMessage } from "./actions";
import { resolveInitialKnowledgeSelection } from "@/lib/knowledge-hub";

type Product = { id: string; name: string };
type Doc = { id: string; title: string; product_id: string | null };
type Session = {
  id: string;
  product_id: string;
  title: string;
  messages: SessionMessage[];
  updated_at: string;
  created_at: string;
};
type Paragraph = { n: number; text: string };

const STARTERS = [
  "What claims can I make about this product?",
  "What are the key benefits?",
  "Who is this product for?",
  "What's the recommended dosage or usage?",
];

export function NotebookClient({
  products,
  initialSessions,
  initialProductId,
  docs,
}: {
  products: Product[];
  initialSessions: Session[];
  initialProductId: string | null;
  docs: Doc[];
}) {
  const initialSelection = resolveInitialKnowledgeSelection({
    productIds: products.map((product) => product.id),
    sessions: initialSessions.map((session) => ({
      id: session.id,
      productId: session.product_id,
    })),
    requestedProductId: initialProductId,
  });
  const [sessions, setSessions] = useState<Session[]>(initialSessions);
  const [activeId, setActiveId] = useState<string | null>(
    initialSelection.activeSessionId
  );
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    initialSelection.selectedProductId
  );
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Source panel
  const [sourcePanel, setSourcePanel] = useState<{
    docTitle: string;
    docId: string | null;
    paragraphN: number | null;
    excerpt: string;
  } | null>(null);
  const [sourceParagraphs, setSourceParagraphs] = useState<Paragraph[] | null>(null);
  const [sourceFetching, setSourceFetching] = useState(false);
  const citedParaRef = useRef<HTMLLIElement | null>(null);

  // Rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const activeSession = sessions.find((s) => s.id === activeId) ?? null;
  const selectedProduct =
    products.find((product) => product.id === selectedProductId) ?? null;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession?.messages.length, loading]);

  useEffect(() => {
    if (sourceParagraphs && citedParaRef.current) {
      citedParaRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [sourceParagraphs]);

  // ── Session management ──────────────────────────────────────────────────────

  async function handleNew(productId: string) {
    setSelectedProductId(productId);
    startTransition(async () => {
      const result = await createSession(productId);
      if ("error" in result) return;
      const session: Session = {
        id: result.id,
        product_id: productId,
        title: "New conversation",
        messages: [],
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      setSessions((prev) => [session, ...prev]);
      setActiveId(result.id);
      setSourcePanel(null);
      setTimeout(() => inputRef.current?.focus(), 80);
    });
  }

  async function handleDelete(sessionId: string) {
    startTransition(async () => {
      await deleteSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeId === sessionId) {
        const next = sessions.find((s) => s.id !== sessionId);
        setActiveId(next?.id ?? null);
        setSelectedProductId(
          next?.product_id ?? initialProductId ?? products[0]?.id ?? null
        );
        setSourcePanel(null);
      }
    });
  }

  function startRename(session: Session) {
    setRenamingId(session.id);
    setRenameValue(session.title);
  }

  async function commitRename(sessionId: string) {
    const title = renameValue.trim();
    setRenamingId(null);
    if (!title) return;
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, title } : s))
    );
    await renameSession(sessionId, title);
  }

  // ── Asking ──────────────────────────────────────────────────────────────────

  async function submit() {
    const q = question.trim();
    if (!q || loading) return;

    const productId = activeSession?.product_id;
    if (!productId) return;

    let sessionId = activeId;

    // Auto-create a session on first message if somehow none is active
    if (!sessionId) {
      const result = await createSession(productId);
      if ("error" in result) { setError(result.error); return; }
      sessionId = result.id;
      const session: Session = {
        id: result.id,
        product_id: productId,
        title: "New conversation",
        messages: [],
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      setSessions((prev) => [session, ...prev]);
      setActiveId(sessionId);
    }

    setQuestion("");
    setLoading(true);
    setError(null);

    const userMsg: SessionMessage = { role: "user", content: q };

    // Optimistic user bubble
    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId
          ? { ...s, messages: [...s.messages, userMsg], updated_at: new Date().toISOString() }
          : s
      )
    );

    try {
      const res = await fetch("/api/products/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, question: q }),
      });
      if (!res.ok) throw new Error("failed");
      const data = await res.json() as {
        answer: string;
        citations: Citation[];
        not_found: boolean;
      };

      const assistantMsg: SessionMessage = {
        role: "assistant",
        content: data.answer,
        citations: data.citations ?? [],
        not_found: data.not_found,
      };

      const current = sessions.find((s) => s.id === sessionId);
      const previousMessages = current?.messages ?? [];
      const isFirst = previousMessages.length === 0;
      const newTitle = isFirst ? q.slice(0, 58) : (current?.title ?? "New conversation");
      const allMessages = [...previousMessages, userMsg, assistantMsg];

      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                title: newTitle,
                messages: allMessages,
                updated_at: new Date().toISOString(),
              }
            : s
        )
      );

      const saveResult = await saveSession(sessionId, allMessages, newTitle);
      if (saveResult.error) {
        setError("The answer is shown, but this conversation could not be saved. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? { ...s, messages: s.messages.slice(0, -1) }
            : s
        )
      );
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  // ── Source panel ────────────────────────────────────────────────────────────

  async function openSource(citation: Citation) {
    const docId = citation.document_id ?? docs.find((d) => d.title === citation.document_title)?.id ?? null;
    setSourcePanel({
      docTitle: citation.document_title,
      docId,
      paragraphN: citation.paragraph_n ?? null,
      excerpt: citation.excerpt,
    });
    setSourceParagraphs(null);
    citedParaRef.current = null;
    if (!docId) return;
    setSourceFetching(true);
    try {
      const res = await fetch(`/api/knowledge/source?docId=${docId}`);
      if (!res.ok) throw new Error("failed");
      const data = await res.json() as { paragraphs: Paragraph[] };
      setSourceParagraphs(data.paragraphs);
    } catch {
      // leave panel open with error state
    } finally {
      setSourceFetching(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const sessionsByProduct = products.map((p) => ({
    product: p,
    sessions: sessions.filter((s) => s.product_id === p.id),
  }));

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Sidebar ── */}
      <aside className="flex w-[232px] shrink-0 flex-col border-r border-edge bg-surface">
        <div className="border-b border-edge px-4 py-3.5">
          <span className="text-[13px] font-bold text-ink">Knowledge Hub</span>
        </div>
        <div className="flex-1 overflow-y-auto py-3">
          {sessionsByProduct.map(({ product, sessions: ps }) => (
            <div key={product.id} className="mb-3">
              <div className="flex items-center justify-between px-4 py-1">
                <span className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-ink-faint">
                  {product.name}
                </span>
                <button
                  onClick={() => handleNew(product.id)}
                  disabled={isPending}
                  title="New conversation"
                  className="flex h-5 w-5 items-center justify-center rounded text-ink-faint hover:bg-page hover:text-ink disabled:opacity-40"
                >
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
                    <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              {ps.length === 0 && (
                <p className="px-4 py-1 text-[11.5px] text-ink-faint">No conversations yet</p>
              )}
              {ps.map((s) => (
                <div
                  key={s.id}
                  className={`group relative flex items-start gap-1 rounded-[7px] mx-2 px-2 py-2 transition-colors cursor-pointer ${
                    activeId === s.id ? "bg-brand-tint" : "hover:bg-page"
                  }`}
                  onClick={() => {
                    setActiveId(s.id);
                    setSelectedProductId(s.product_id);
                    setSourcePanel(null);
                  }}
                >
                  {renamingId === s.id ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => commitRename(s.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename(s.id);
                        if (e.key === "Escape") setRenamingId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 rounded border border-brand bg-surface px-1.5 py-0.5 text-[12px] outline-none"
                    />
                  ) : (
                    <span className={`flex-1 truncate text-[12.5px] leading-snug ${activeId === s.id ? "font-semibold text-brand" : "font-medium text-ink"}`}>
                      {s.title}
                    </span>
                  )}
                  <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
                    <button
                      onClick={(e) => { e.stopPropagation(); startRename(s); }}
                      title="Rename"
                      className="rounded p-0.5 text-ink-faint hover:text-ink"
                    >
                      <svg width="11" height="11" viewBox="0 0 14 14" fill="none" aria-hidden>
                        <path d="M9.5 2.5l2 2-7 7H2.5v-2l7-7z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }}
                      title="Delete"
                      className="rounded p-0.5 text-ink-faint hover:text-reject"
                    >
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
                        <path d="M1.5 1.5l9 9M10.5 1.5l-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </aside>

      {/* ── Chat ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center border-b border-edge bg-surface px-6 py-3.5">
          <span className="text-[13.5px] font-semibold text-ink truncate">
            {activeSession
              ? activeSession.title === "New conversation"
                ? products.find((p) => p.id === activeSession.product_id)?.name ?? "Knowledge Hub"
                : activeSession.title
              : "Knowledge Hub"}
          </span>
          <div className="flex-1" />
          <span className="shrink-0 rounded-[5px] bg-brand-tint px-[7px] py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-brand">
            Approved sources only
          </span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {!activeSession ? (
            <div className="flex h-full flex-col items-center justify-center gap-5 px-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-tint text-[22px] font-bold text-brand">?</div>
              <div className="flex flex-col gap-1.5">
                <p className="text-[15px] font-semibold">
                  {selectedProduct
                    ? `Start a conversation about ${selectedProduct.name}`
                    : "Start a conversation"}
                </p>
                <p className="max-w-sm text-[13px] text-ink-muted">
                  {selectedProduct
                    ? "Begin a new conversation grounded in this product's approved sources."
                    : "Pick a product on the left to begin a new conversation."}
                </p>
                {selectedProduct && (
                  <button
                    type="button"
                    onClick={() => handleNew(selectedProduct.id)}
                    disabled={isPending}
                    className="mt-3 rounded-control bg-brand px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-40"
                  >
                    Start conversation
                  </button>
                )}
              </div>
            </div>
          ) : activeSession.messages.length === 0 && !loading ? (
            <div className="flex h-full flex-col items-center justify-center gap-5 px-8 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-tint text-[20px] font-bold text-brand">?</div>
              <div className="flex flex-col gap-1.5">
                <p className="text-[14.5px] font-semibold">
                  Ask anything about {products.find((p) => p.id === activeSession.product_id)?.name}
                </p>
                <p className="max-w-sm text-[13px] text-ink-muted">
                  Claims, usage, key benefits, target audience — answered from approved sources only.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    onClick={() => { setQuestion(s); setTimeout(() => inputRef.current?.focus(), 50); }}
                    className="rounded-full border border-edge bg-page px-4 py-1.5 text-[12.5px] font-medium text-ink-muted transition-colors hover:bg-surface hover:text-ink"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto flex max-w-[740px] flex-col gap-6 px-6 py-6">
              {activeSession.messages.map((msg, i) =>
                msg.role === "user" ? (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[72%] rounded-[14px] rounded-tr-[4px] bg-brand-dark px-4 py-3 text-[13.5px] font-medium leading-snug text-white">
                      {msg.content}
                    </div>
                  </div>
                ) : (
                  <div key={i} className="flex flex-col gap-2.5">
                    <div className={`rounded-card border px-5 py-4 text-[13.5px] leading-relaxed ${
                      msg.not_found ? "border-edge bg-surface italic text-ink-muted" : "border-edge bg-surface text-ink"
                    }`}>
                      {msg.content}
                    </div>
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="flex flex-col gap-2 pl-1">
                        <span className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-faint">
                          From approved sources
                        </span>
                        {msg.citations.map((c, j) => (
                          <button
                            key={j}
                            onClick={() => openSource(c)}
                            className={`flex gap-3 rounded-[10px] border px-4 py-3 text-left transition-colors hover:border-brand ${
                              sourcePanel?.docId === c.document_id &&
                              sourcePanel.paragraphN === (c.paragraph_n ?? null)
                                ? "border-brand bg-brand-tint"
                                : "border-edge bg-page"
                            }`}
                          >
                            <div className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                            <div className="flex min-w-0 flex-col gap-0.5">
                              <span className="text-[11.5px] font-semibold text-brand">{c.document_title}</span>
                              <span className="text-[12px] leading-snug text-ink-muted">&ldquo;{c.excerpt}&rdquo;</span>
                            </div>
                            <span className="ml-auto shrink-0 self-center text-[10.5px] font-semibold text-ink-faint">
                              View →
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              )}
              {loading && (
                <div className="flex items-center gap-2 text-[13px] text-ink-faint">
                  <span>Searching approved sources</span>
                  {[0, 150, 300].map((d) => (
                    <span key={d} className="inline-block animate-bounce" style={{ animationDelay: `${d}ms` }}>·</span>
                  ))}
                </div>
              )}
              {error && <p className="text-[13px] text-reject">{error}</p>}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Input */}
        {activeSession && (
          <div className="border-t border-edge bg-surface px-6 py-4">
            <div className="mx-auto max-w-[740px]">
              <form
                onSubmit={(e) => { e.preventDefault(); submit(); }}
                className="flex gap-3"
              >
                <textarea
                  ref={inputRef}
                  value={question}
                  onChange={(e) => {
                    setQuestion(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
                  }}
                  placeholder="Ask a question… (Enter to send, Shift+Enter for new line)"
                  disabled={loading}
                  rows={1}
                  className="flex-1 resize-none overflow-hidden rounded-control border border-edge bg-page px-4 py-2.5 text-[13.5px] placeholder:text-ink-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!question.trim() || loading}
                  className="self-end rounded-control bg-brand px-5 py-2.5 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  Ask
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* ── Source panel ── */}
      {sourcePanel && (
        <aside className="flex w-[300px] shrink-0 flex-col border-l border-edge bg-surface">
          <div className="flex items-center gap-2 border-b border-edge px-4 py-3.5">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-[12px] font-bold text-ink">{sourcePanel.docTitle}</span>
              <span className="text-[10.5px] text-ink-faint">Approved source</span>
            </div>
            <button
              onClick={() => setSourcePanel(null)}
              className="shrink-0 text-ink-faint hover:text-ink"
              aria-label="Close source panel"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Cited excerpt at top */}
          <div className="border-b border-edge bg-approve-tint px-4 py-3">
            <span className="text-[10px] font-bold uppercase tracking-[0.07em] text-approve">Cited passage</span>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-muted italic">&ldquo;{sourcePanel.excerpt}&rdquo;</p>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {sourceFetching && (
              <div className="flex items-center justify-center py-12 text-[13px] text-ink-faint">
                Loading…
              </div>
            )}
            {!sourceFetching && !sourceParagraphs && !sourcePanel.docId && (
              <p className="py-6 text-center text-[12.5px] text-ink-faint">Source document not found.</p>
            )}
            {!sourceFetching && sourceParagraphs && (
              <ol className="flex flex-col gap-1.5">
                {sourceParagraphs.map((p) => {
                  const excerpt = sourcePanel.excerpt.trim().toLowerCase();
                  const isCited = sourcePanel.paragraphN
                    ? p.n === sourcePanel.paragraphN
                    : excerpt.length >= 20 && p.text.toLowerCase().includes(excerpt.slice(0, 40));
                  return (
                    <li
                      key={p.n}
                      ref={isCited ? (el) => { citedParaRef.current = el; } : undefined}
                      className={`flex gap-2.5 rounded-[8px] px-3 py-2.5 ${
                        isCited ? "bg-approve-tint ring-1 ring-inset ring-approve/25" : "hover:bg-page"
                      }`}
                    >
                      <span className="mt-0.5 w-5 shrink-0 text-right text-[10.5px] font-bold text-brand">
                        ¶{p.n}
                      </span>
                      <p className="text-[12px] leading-relaxed text-ink">{p.text}</p>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}
