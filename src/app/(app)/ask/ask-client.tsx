"use client";

import { useState, useRef, useEffect } from "react";

type Product = { id: string; name: string };
type Citation = { document_title: string; excerpt: string };
type QA = {
  question: string;
  answer: string;
  citations: Citation[];
  not_found: boolean;
};

const STARTER_QUESTIONS = [
  "What claims can I make about this product?",
  "What are the key benefits?",
  "Who is this product for?",
];

export function AskClient({ products }: { products: Product[] }) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<QA[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, loading]);

  async function submit(q: string) {
    if (!q.trim() || !productId || loading) return;
    setQuestion("");
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/products/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, question: q.trim() }),
      });
      if (!res.ok) throw new Error("Request failed");
      const data = await res.json();
      setHistory((prev) => [...prev, { question: q.trim(), ...data }]);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submit(question);
  }

  function handleProductChange(id: string) {
    setProductId(id);
    setHistory([]);
    setError(null);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Product selector */}
      <div className="flex items-center gap-3 rounded-card border border-edge bg-surface px-[18px] py-3">
        <span className="text-[13px] font-semibold text-ink-muted whitespace-nowrap">Asking about</span>
        <select
          value={productId}
          onChange={(e) => handleProductChange(e.target.value)}
          className="flex-1 bg-transparent text-[13.5px] font-semibold text-ink focus:outline-none cursor-pointer"
        >
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <span className="rounded-[5px] bg-brand-tint px-[7px] py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-brand whitespace-nowrap">
          Approved sources only
        </span>
      </div>

      {/* Conversation thread */}
      {history.length > 0 && (
        <div className="flex flex-col gap-6">
          {history.map((qa, i) => (
            <div key={i} className="flex flex-col gap-3">
              {/* Question bubble */}
              <div className="flex justify-end">
                <div className="max-w-[72%] rounded-[14px] rounded-tr-[4px] bg-brand-dark px-4 py-3 text-[13.5px] font-medium leading-snug text-white">
                  {qa.question}
                </div>
              </div>

              {/* Answer */}
              <div className="flex flex-col gap-2.5">
                <div
                  className={`rounded-card border px-5 py-4 text-[13.5px] leading-relaxed ${
                    qa.not_found
                      ? "border-edge bg-surface italic text-ink-muted"
                      : "border-edge bg-surface text-ink"
                  }`}
                >
                  {qa.answer}
                </div>

                {/* Citations */}
                {qa.citations.length > 0 && (
                  <div className="flex flex-col gap-2 pl-1">
                    <span className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-faint">
                      From approved sources
                    </span>
                    {qa.citations.map((c, j) => (
                      <div
                        key={j}
                        className="flex gap-3 rounded-[10px] border border-edge bg-page px-4 py-3"
                      >
                        <div className="mt-[5px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand" />
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="text-[11.5px] font-semibold text-brand">
                            {c.document_title}
                          </span>
                          <span className="text-[12px] leading-snug text-ink-muted">
                            &ldquo;{c.excerpt}&rdquo;
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {loading && (
            <div className="flex items-center gap-2 px-1 text-[13px] text-ink-faint">
              <span>Searching approved sources</span>
              <span className="flex gap-0.5">
                {[0, 150, 300].map((d) => (
                  <span
                    key={d}
                    className="inline-block animate-bounce"
                    style={{ animationDelay: `${d}ms` }}
                  >
                    ·
                  </span>
                ))}
              </span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Empty state */}
      {history.length === 0 && !loading && (
        <div className="flex flex-col items-center gap-5 rounded-card border border-dashed border-edge-strong bg-surface px-8 py-14 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-tint text-[20px] font-bold text-brand">
            ?
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-[14.5px] font-semibold">Ask anything about this product</p>
            <p className="max-w-sm text-[13px] text-ink-muted">
              Claims, usage, withdrawal periods, target species, key benefits — all answered from approved sources.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {STARTER_QUESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => submit(s)}
                className="rounded-full border border-edge bg-page px-3.5 py-1.5 text-[12.5px] font-medium text-ink-muted transition-colors hover:bg-surface hover:text-ink"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p className="text-[13px] text-reject">{error}</p>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          ref={inputRef}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a question about this product…"
          disabled={loading}
          className="flex-1 rounded-control border border-edge bg-surface px-4 py-2.5 text-[13.5px] placeholder:text-ink-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!question.trim() || loading}
          className="rounded-control bg-brand px-5 py-2.5 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          Ask
        </button>
      </form>
    </div>
  );
}
