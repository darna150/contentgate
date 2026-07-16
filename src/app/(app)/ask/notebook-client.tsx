"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { MessageCircleQuestion, Menu, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  createSession,
  saveSession,
  deleteSession,
  renameSession,
} from "./actions";
import type { Citation, SessionMessage } from "./actions";
import { resolveInitialKnowledgeSelection } from "@/lib/knowledge-hub";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/confirm-dialog";

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
  "What claims can local teams use?",
  "Which template fields can be edited?",
  "Who is ContentGate for?",
  "How should teams localize content?",
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
  const sourcePanelRef = useRef<HTMLElement>(null);

  // Rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Mobile sessions drawer (below `lg`)
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const sessionsMenuButtonRef = useRef<HTMLButtonElement>(null);
  const sessionsCloseButtonRef = useRef<HTMLButtonElement>(null);
  const sessionsPanelRef = useRef<HTMLElement>(null);

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

  useFocusTrap(sessionsOpen, sessionsPanelRef);

  useEffect(() => {
    if (!sessionsOpen) return;

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    sessionsCloseButtonRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeSessionsDrawer();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
    };
  }, [sessionsOpen]);

  // Source panel is a full-screen modal overlay only below `lg` (see the
  // `lg:static` panel below) — only lock/trap while it's acting as one.
  const sourcePanelIsModal = sourcePanel !== null;
  useFocusTrap(sourcePanelIsModal, sourcePanelRef, 1024);

  useEffect(() => {
    if (!sourcePanelIsModal || window.innerWidth >= 1024) return;

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setSourcePanel(null);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
    };
  }, [sourcePanelIsModal]);

  function closeSessionsDrawer() {
    setSessionsOpen(false);
    sessionsMenuButtonRef.current?.focus();
  }

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

  const sessionsList = (onNavigate?: () => void) => (
    <div className="flex-1 overflow-y-auto py-3">
      {sessionsByProduct.map(({ product, sessions: ps }) => (
        <div key={product.id} className="mb-3">
          <div className="flex items-center justify-between px-4 py-1">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-ink-faint">
              {product.name}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => { handleNew(product.id); onNavigate?.(); }}
              disabled={isPending}
              title="New conversation"
              aria-label="New conversation"
              className="h-5 w-5 rounded text-ink-faint hover:bg-page hover:text-ink [&_svg]:size-[11px]"
            >
              <Plus strokeWidth={2.2} aria-hidden />
            </Button>
          </div>
          {ps.length === 0 && (
            <p className="px-4 py-1 text-[11.5px] text-ink-faint">No conversations yet</p>
          )}
          {ps.map((s) => {
            function selectSession() {
              setActiveId(s.id);
              setSelectedProductId(s.product_id);
              setSourcePanel(null);
              onNavigate?.();
            }
            return (
            <div
              key={s.id}
              role="button"
              tabIndex={0}
              aria-current={activeId === s.id}
              className={`group relative flex items-start gap-1 rounded-[7px] mx-2 px-2 py-2 transition-colors cursor-pointer ${
                activeId === s.id ? "bg-brand-tint" : "hover:bg-page"
              }`}
              onClick={selectSession}
              onKeyDown={(e) => {
                if (e.target !== e.currentTarget) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  selectSession();
                }
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
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => { e.stopPropagation(); startRename(s); }}
                  title="Rename"
                  aria-label="Rename"
                  className="h-5 w-5 rounded p-0.5 text-ink-faint hover:bg-transparent hover:text-ink [&_svg]:size-[11px]"
                >
                  <Pencil strokeWidth={1.8} aria-hidden />
                </Button>
                <ConfirmDialog
                  trigger={
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => e.stopPropagation()}
                      title="Delete"
                      aria-label="Delete"
                      className="h-5 w-5 rounded p-0.5 text-ink-faint hover:bg-transparent hover:text-reject [&_svg]:size-[11px]"
                    >
                      <Trash2 strokeWidth={1.8} aria-hidden />
                    </Button>
                  }
                  title="Delete this conversation?"
                  description="This conversation and its messages will be permanently removed."
                  confirmLabel="Delete"
                  onConfirm={() => handleDelete(s.id)}
                />
              </div>
            </div>
            );
          })}
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Mobile sessions drawer (below `lg`) ── */}
      {sessionsOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close conversations"
            tabIndex={-1}
            className="absolute inset-0 bg-ink/40"
            onClick={closeSessionsDrawer}
          />
          <aside
            ref={sessionsPanelRef}
            id="mobile-sessions"
            aria-label="Conversations"
            className="relative flex h-full w-[min(320px,88vw)] flex-col border-r border-edge bg-surface shadow-elevated"
          >
            <div className="flex items-center justify-between border-b border-edge px-4 py-3.5">
              <span className="text-[13px] font-bold text-ink">Knowledge Hub</span>
              <Button
                ref={sessionsCloseButtonRef}
                variant="ghost"
                size="icon"
                onClick={closeSessionsDrawer}
                aria-label="Close conversations"
                className="h-7 w-7 text-ink-faint hover:bg-page hover:text-ink [&_svg]:size-4"
              >
                <X aria-hidden />
              </Button>
            </div>
            {sessionsList(closeSessionsDrawer)}
          </aside>
        </div>
      )}

      {/* ── Sidebar (desktop, `lg` and up) ── */}
      <aside className="hidden w-[232px] shrink-0 flex-col border-r border-edge bg-surface lg:flex">
        <div className="border-b border-edge px-4 py-3.5">
          <span className="text-[13px] font-bold text-ink">Knowledge Hub</span>
        </div>
        {sessionsList()}
      </aside>

      {/* ── Chat ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center border-b border-edge bg-surface px-6 py-3.5">
          <Button
            ref={sessionsMenuButtonRef}
            variant="ghost"
            size="icon"
            onClick={() => setSessionsOpen(true)}
            aria-label="Show conversations"
            aria-expanded={sessionsOpen}
            aria-controls="mobile-sessions"
            className="mr-2 h-8 w-8 shrink-0 text-ink-faint hover:bg-page hover:text-ink [&_svg]:size-4 lg:hidden"
          >
            <Menu aria-hidden />
          </Button>
          <span className="text-[13.5px] font-semibold text-ink truncate">
            {activeSession
              ? activeSession.title === "New conversation"
                ? products.find((p) => p.id === activeSession.product_id)?.name ?? "Knowledge Hub"
                : activeSession.title
              : "Knowledge Hub"}
          </span>
          <div className="flex-1" />
          <Badge variant="brand" className="shrink-0 uppercase tracking-[0.06em]">
            Approved sources only
          </Badge>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {!activeSession ? (
            <div className="flex h-full flex-col items-center justify-center gap-5 px-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-tint text-brand">
                <MessageCircleQuestion className="size-6" aria-hidden />
              </div>
              <div className="flex flex-col gap-1.5">
                <p className="text-[15px] font-semibold text-ink">
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
                  <Button
                    size="sm"
                    onClick={() => handleNew(selectedProduct.id)}
                    disabled={isPending}
                    className="mt-3 self-center"
                  >
                    Start conversation
                  </Button>
                )}
              </div>
            </div>
          ) : activeSession.messages.length === 0 && !loading ? (
            <div className="flex h-full flex-col items-center justify-center gap-5 px-8 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-tint text-brand">
                <MessageCircleQuestion className="size-5" aria-hidden />
              </div>
              <div className="flex flex-col gap-1.5">
                <p className="text-[14.5px] font-semibold text-ink">
                  Ask anything about {products.find((p) => p.id === activeSession.product_id)?.name}
                </p>
                <p className="max-w-sm text-[13px] text-ink-muted">
                  Claims, usage, key benefits, target audience — answered from approved sources only.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {STARTERS.map((s) => (
                  <Button
                    key={s}
                    variant="outline"
                    size="sm"
                    onClick={() => { setQuestion(s); setTimeout(() => inputRef.current?.focus(), 50); }}
                    className="rounded-full font-medium text-ink-muted hover:text-ink"
                  >
                    {s}
                  </Button>
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
                    <Card
                      className={`gap-0 px-5 py-4 text-[13.5px] leading-relaxed ${
                        msg.not_found ? "italic text-ink-muted" : "text-ink"
                      }`}
                    >
                      {msg.content}
                    </Card>
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="flex flex-col gap-2 pl-1">
                        <span className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-faint">
                          From approved sources
                        </span>
                        {msg.citations.map((c, j) => (
                          <button
                            key={j}
                            onClick={() => openSource(c)}
                            className={`flex gap-3 rounded-card border px-4 py-3 text-left transition-colors hover:border-brand ${
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
                <Button
                  type="submit"
                  disabled={!question.trim() || loading}
                  className="self-end px-5"
                >
                  Ask
                </Button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* ── Source panel ── */}
      {sourcePanel && (
        <>
          {/* Mobile backdrop — panel is a full-width overlay below `lg` */}
          <button
            type="button"
            aria-label="Close source panel"
            tabIndex={-1}
            className="fixed inset-0 z-50 bg-ink/40 lg:hidden"
            onClick={() => setSourcePanel(null)}
          />
          <aside
            ref={sourcePanelRef}
            aria-label="Source document"
            className="fixed inset-0 z-50 flex flex-col bg-surface lg:static lg:inset-auto lg:z-auto lg:w-[300px] lg:shrink-0 lg:border-l lg:border-edge"
          >
            <div className="flex items-center gap-2 border-b border-edge px-4 py-3.5">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[12px] font-bold text-ink">{sourcePanel.docTitle}</span>
                <span className="text-[10.5px] text-ink-faint">Approved source</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSourcePanel(null)}
                className="h-6 w-6 shrink-0 text-ink-faint hover:bg-transparent hover:text-ink [&_svg]:size-[14px]"
                aria-label="Close source panel"
              >
                <X strokeWidth={1.8} aria-hidden />
              </Button>
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
        </>
      )}
    </div>
  );
}
