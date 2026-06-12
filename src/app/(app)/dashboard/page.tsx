export default function DashboardPage() {
  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-10 py-9">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-serif text-[28px] font-semibold">Dashboard</h1>
        <p className="text-[14.5px] text-ink-muted">
          Recent content and what&apos;s waiting on approval.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {[
          { label: "Documents", value: "—", hint: "in the Knowledge Hub" },
          { label: "Generated content", value: "—", hint: "drafts and approved" },
          { label: "Awaiting approval", value: "—", hint: "in the queue" },
        ].map((card) => (
          <div
            key={card.label}
            className="flex flex-col gap-1 rounded-card border border-edge bg-surface p-6"
          >
            <span className="text-[13px] font-semibold text-ink-muted">
              {card.label}
            </span>
            <span className="font-serif text-3xl font-semibold">{card.value}</span>
            <span className="text-xs text-ink-faint">{card.hint}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-edge-strong bg-surface px-8 py-16 text-center">
        <p className="text-[15px] font-semibold">Day 1 foundation is live</p>
        <p className="max-w-md text-sm text-ink-muted">
          Knowledge Hub, Content Generator, and the Approval Queue land over the
          next sprint days. Connect Supabase env vars to enable sign-in.
        </p>
      </div>
    </div>
  );
}
