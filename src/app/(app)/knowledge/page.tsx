export default function KnowledgePage() {
  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-10 py-9">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-serif text-[28px] font-semibold">Knowledge Hub</h1>
        <p className="text-[14.5px] text-ink-muted">
          Approved source documents your content is generated from.
        </p>
      </div>
      <div className="flex flex-col items-center gap-2 rounded-card border border-dashed border-edge-strong bg-surface px-8 py-16 text-center">
        <p className="text-[15px] font-semibold">Coming on sprint Day 2</p>
        <p className="text-sm text-ink-muted">Upload, paste-text fallback, and extraction preview.</p>
      </div>
    </div>
  );
}
