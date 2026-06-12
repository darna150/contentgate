export default function GeneratePage() {
  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-10 py-9">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-serif text-[28px] font-semibold">Content Generator</h1>
        <p className="text-[14.5px] text-ink-muted">
          Localized marketing copy, grounded in approved product knowledge.
          Everything generated goes to the Approval Queue.
        </p>
      </div>
      <div className="flex flex-col items-center gap-2 rounded-card border border-dashed border-edge-strong bg-surface px-8 py-16 text-center">
        <p className="text-[15px] font-semibold">Coming on sprint Day 3</p>
        <p className="text-sm text-ink-muted">Brief form, streaming generation, saved drafts.</p>
      </div>
    </div>
  );
}
