import { BrandLoader } from "@/components/brand-loader";

export default function Loading() {
  return (
    <div className="flex h-[60vh] flex-col items-center justify-center gap-3">
      <BrandLoader size="md" />
      <p className="text-[12.5px] text-ink-faint">Loading…</p>
    </div>
  );
}
