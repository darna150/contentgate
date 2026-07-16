import { cn } from "@/lib/utils";

export function FieldCounter({
  count,
  max,
  status,
}: {
  count: number;
  max?: number;
  status?: "ok" | "warn" | "error";
}) {
  const overLimit = max != null && count > max;
  const resolvedStatus = status ?? (overLimit ? "error" : "ok");
  return (
    <span
      className={cn(
        "text-[10.5px] font-semibold tabular-nums",
        resolvedStatus === "error" && "text-reject",
        resolvedStatus === "warn" && "text-warn",
        resolvedStatus === "ok" && "text-ink-faint"
      )}
    >
      {max != null ? `${count}/${max}` : count}
    </span>
  );
}
