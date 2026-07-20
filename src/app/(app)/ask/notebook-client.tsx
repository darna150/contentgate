"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { FileText, MessageCircleQuestion, Menu, Pencil, Plus, Trash2, UploadCloud, X } from "lucide-react";
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
import { CitationList } from "@/components/citation";

type Product = { id: string; name: string };
type Doc = {
  id: string;
  title: string;
  product_id: string | null;
  paragraphCount: number;
  indexStatus: "indexed" | "processing" | "failed";
};
type Session = {
  id: string;
  product_id: string | null;
  title: string;
  messages: SessionMessage[];
  updated_at: string;
  created_at: string;
};

const STARTERS = [
  "What claims can local teams use?",
  "Which template fields can be edited?",
  "Who is ContentGate for?",
  "How should teams localize content?",
];
const WORKSPACE_NOTEBOOK_ID = "workspace";

function softenSavedAnswer(content: string) {
  return content.replace(/^The approved source says:\s*/i, "");
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+?\*\*|\[[^\]]+?\]\(https?:\/\/[^)\s]+?\))/g);

  return parts.map((part, index) => {
    const boldMatch = /^\*\*([^*]+?)\*\*$/.exec(part);
    if (boldMatch) {
      return (
        <strong key={index} className="font-semibold text-ink">
          {boldMatch[1]}
        </strong>
      );
    }

    const linkMatch = /^\[([^\]]+?)\]\((https?:\/\/[^)\s]+?)\)$/.exec(part);
    if (linkMatch) {
      return (
        <a
          key={index}
          href={linkMatch[2]}
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-brand underline decoration-brand/30 underline-offset-2 hover:decoration-brand"
        >
          {linkMatch[1]}
        </a>
      );
    }

    return part;
  });
}

function AssistantMarkdown({ content }: { content: string }) {
  const lines = content.split(/\r?\n/);
  const blocks: Array<
    | { type: "paragraph"; lines: string[] }
    | { type: "bullets"; items: string[] }
    | { type: "numbers"; items: string[] }
  > = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const bulletMatch = /^[-*]\s+(.+)$/.exec(trimmed);
    if (bulletMatch) {
      const last = blocks.at(-1);
      if (last?.type === "bullets") {
        last.items.push(bulletMatch[1]);
      } else {
        blocks.push({ type: "bullets", items: [bulletMatch[1]] });
      }
      continue;
    }

    const numberMatch = /^\d+[.)]\s+(.+)$/.exec(trimmed);
    if (numberMatch) {
      const last = blocks.at(-1);
      if (last?.type === "numbers") {
        last.items.push(numberMatch[1]);
      } else {
        blocks.push({ type: "numbers", items: [numberMatch[1]] });
      }
      continue;
    }

    const last = blocks.at(-1);
    if (last?.type === "paragraph") {
      last.lines.push(trimmed);
    } else {
      blocks.push({ type: "paragraph", lines: [trimmed] });
    }
  }

  if (blocks.length === 0) return null;

  return (
    <div className="space-y-3">
      {blocks.map((block, index) => {
        if (block.type === "bullets") {
          return (
            <ul key={index} className="list-disc space-y-1 pl-5">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInlineMarkdown(item)}</li>
              ))}
            </ul>
          );
        }

        if (block.type === "numbers") {
          return (
            <ol key={index} className="list-decimal space-y-1 pl-5">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInlineMarkdown(item)}</li>
              ))}
            </ol>
          );
        }

        return (
          <p key={index}>
            {renderInlineMarkdown(block.lines.join(" "))}
          </p>
        );
      })}
    </div>
  );
}

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
    notebookIds: products.map((product) => product.id),
    sessions: initialSessions.map((session) => ({
      id: session.id,
      productId: session.product_id ?? WORKSPACE_NOTEBOOK_ID,
    })),
    requestedProductId: initialProductId,
    workspaceNotebookId: WORKSPACE_NOTEBOOK_ID,
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
  const [errorsBySession, setErrorsBySession] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

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
  const activeError = activeId ? errorsBySession[activeId] ?? null : null;
  const selectedProduct =
    products.find((product) => product.id === selectedProductId) ?? null;
  const selectedIsWorkspace = selectedProductId === WORKSPACE_NOTEBOOK_ID;
  const activeSourceDocs = docs.filter(
    (doc) =>
      selectedIsWorkspace ||
      doc.product_id === selectedProductId ||
      doc.product_id === null
  );
  const indexedSourceCount = activeSourceDocs.filter(
    (doc) => doc.indexStatus === "indexed"
  ).length;

  function setSessionError(sessionId: string, message: string | null) {
    setErrorsBySession((current) => {
      if (!message) {
        const next = { ...current };
        delete next[sessionId];
        return next;
      }
      return { ...current, [sessionId]: message };
    });
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession?.messages.length, loading]);

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

  function closeSessionsDrawer() {
    setSessionsOpen(false);
    sessionsMenuButtonRef.current?.focus();
  }

  // ── Session management ──────────────────────────────────────────────────────

  async function handleNew(productId: string) {
    setSelectedProductId(productId);
    startTransition(async () => {
      const dbProductId = productId === WORKSPACE_NOTEBOOK_ID ? null : productId;
      const result = await createSession(dbProductId);
      if ("error" in result) return;
      const session: Session = {
        id: result.id,
        product_id: dbProductId,
        title: "New conversation",
        messages: [],
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      setSessions((prev) => [session, ...prev]);
      setActiveId(result.id);
      setSessionError(result.id, null);
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

    if (!activeSession) return;
    const productId = activeSession.product_id;

    let sessionId = activeId;

    // Auto-create a session on first message if somehow none is active
    if (!sessionId) {
      const result = await createSession(productId);
      if ("error" in result) return;
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
    setSessionError(sessionId, null);

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
      if (!res.ok) {
        const payload = await res.json().catch(() => null) as { error?: unknown } | null;
        const message =
          typeof payload?.error === "string"
            ? payload.error
            : "Knowledge Q&A is temporarily unavailable. Please try again.";
        throw new Error(message);
      }
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

      try {
        const saveResult = await saveSession(sessionId, allMessages, newTitle);
        if (saveResult.error) {
          setSessionError(sessionId, "The answer is shown, but this conversation could not be saved.");
        }
      } catch (saveError) {
        console.warn("knowledge session save failed:", saveError);
        setSessionError(sessionId, "The answer is shown, but this conversation could not be saved.");
      }
    } catch (caught) {
      const message =
        caught instanceof Error && caught.message
          ? caught.message
          : "Knowledge Q&A is temporarily unavailable. Please try again.";
      setSessionError(sessionId, message);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const sessionsByProduct = products.map((p) => ({
    product: p,
    sessions: sessions.filter((s) => (s.product_id ?? WORKSPACE_NOTEBOOK_ID) === p.id),
  }));

  const sourceList = (
    <aside className="hidden w-[276px] shrink-0 flex-col border-l border-edge bg-surface lg:flex">
      <div className="border-b border-edge px-4 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] font-bold text-ink">Sources</span>
          <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-[11.5px]">
            <Link href="/knowledge/new">
              <UploadCloud className="size-3.5" aria-hidden />
              Upload
            </Link>
          </Button>
        </div>
        <p className="mt-1.5 text-[11.5px] leading-snug text-ink-faint">
          Ask reads indexed source documents only. No manual claim picking.
        </p>
      </div>

      <div className="flex flex-col gap-3 overflow-y-auto p-4">
        <div className="rounded-[12px] border border-edge bg-page px-3 py-2.5">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-ink-faint">
            Active notebook
          </p>
          <p className="mt-1 truncate text-[13px] font-semibold text-ink">
            {selectedProduct?.name ?? "No notebook selected"}
          </p>
          <p className="mt-1 text-[11.5px] text-ink-faint">
            {indexedSourceCount} indexed · {activeSourceDocs.length} allowed
          </p>
        </div>

        {activeSourceDocs.length === 0 ? (
          <div className="rounded-[12px] border border-dashed border-edge bg-page/50 px-3 py-4 text-center">
            <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-brand-tint text-brand">
              <FileText className="size-4" aria-hidden />
            </div>
            <p className="mt-2 text-[12.5px] font-semibold text-ink">No sources yet</p>
            <p className="mt-1 text-[11.5px] leading-snug text-ink-faint">
              Upload a guide, FAQ, claim sheet, or legal doc before asking.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {activeSourceDocs.map((doc) => (
              <li key={doc.id}>
                <Link
                  href={`/knowledge/${doc.id}`}
                  className="group flex gap-2.5 rounded-[10px] border border-edge bg-page px-3 py-2.5 transition-colors hover:border-brand/35 hover:bg-brand-tint"
                >
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-surface text-ink-faint group-hover:text-brand">
                    <FileText className="size-3.5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-[12.5px] font-semibold leading-snug text-ink">
                      {doc.title}
                    </span>
                    <span className="mt-1 flex items-center gap-1.5 text-[11px] text-ink-faint">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          doc.indexStatus === "indexed"
                            ? "bg-approve"
                            : doc.indexStatus === "processing"
                              ? "bg-warn"
                              : "bg-reject"
                        }`}
                        aria-hidden
                      />
                      {doc.indexStatus === "indexed"
                        ? `${doc.paragraphCount} citable paragraphs`
                        : doc.indexStatus === "processing"
                          ? "Processing"
                          : "Needs text extraction"}
                      {doc.product_id === null ? " · org-wide" : ""}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );

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
                  setSelectedProductId(s.product_id ?? WORKSPACE_NOTEBOOK_ID);
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
              <span className="text-[13px] font-bold text-ink">Ask notebook</span>
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
          <span className="text-[13px] font-bold text-ink">Ask notebook</span>
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
                ? products.find((p) => p.id === (activeSession.product_id ?? WORKSPACE_NOTEBOOK_ID))?.name ?? "Ask notebook"
                : activeSession.title
              : "Ask notebook"}
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
                  Ask anything about {products.find((p) => p.id === (activeSession.product_id ?? WORKSPACE_NOTEBOOK_ID))?.name}
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
                    <div className="max-w-[72%] rounded-[14px] rounded-tr-[4px] bg-brand-tint px-4 py-3 text-[13.5px] font-medium leading-snug text-ink">
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
                      <AssistantMarkdown content={softenSavedAnswer(msg.content)} />
                    </Card>
                    {msg.citations && msg.citations.length > 0 && (
                      <CitationList
                        citations={msg.citations.map((citation) => ({
                          documentId: citation.document_id,
                          documentTitle: citation.document_title,
                          excerpt: citation.excerpt,
                          paragraphN: citation.paragraph_n,
                        }))}
                        label="From approved sources"
                      />
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
              {activeError && <p className="text-[13px] text-reject">{activeError}</p>}
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
                  className="min-h-[64px] flex-1 resize-none overflow-y-auto rounded-control border border-edge bg-page px-4 py-2.5 text-[13.5px] leading-5 placeholder:text-ink-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:opacity-50 sm:min-h-[44px]"
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

      {sourceList}
    </div>
  );
}
