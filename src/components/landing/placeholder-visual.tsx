/*
 * Deliberately obvious placeholders for the landing page's unfilled media
 * slots. Bare shapes in the brand palette, sized to the real slot dimensions
 * so the page's visual rhythm is legible before any asset exists.
 *
 * These MUST keep reading as placeholders — the dashed edge, the hatch, and
 * the dimension label are the point. If a placeholder ever starts looking
 * finished, it will ship by accident. Every slot is specified in
 * docs/LANDING_MEDIA_SPEC.md; replace, do not polish.
 */

type Tone = "dark" | "light";

type Props = {
  /** Slot name, e.g. "Hero visual". */
  label: string;
  /** Intended delivery size, e.g. "384 × 520". */
  spec: string;
  /** CSS aspect-ratio, when the slot has a fixed one. */
  ratio?: string;
  tone?: Tone;
  variant?: "composition" | "portrait" | "media";
  className?: string;
};

const hatch = (tone: Tone) =>
  `repeating-linear-gradient(135deg, ${
    tone === "dark" ? "rgb(255 255 255 / 0.04)" : "rgb(10 10 10 / 0.035)"
  } 0 10px, transparent 10px 20px)`;

function Shapes({ variant, tone }: { variant: Props["variant"]; tone: Tone }) {
  const fill = tone === "dark" ? "text-white" : "text-ink";

  if (variant === "portrait") {
    return (
      <div
        aria-hidden="true"
        className={`flex h-full w-full items-end justify-center ${fill}`}
      >
        <div className="flex w-full max-w-[120px] flex-col items-center gap-2 opacity-[0.13]">
          <div className="h-10 w-10 rounded-full bg-current" />
          <div className="h-12 w-full rounded-t-[999px] bg-current" />
        </div>
      </div>
    );
  }

  if (variant === "media") {
    return (
      <div
        aria-hidden="true"
        className={`flex h-full w-full items-center justify-center ${fill}`}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-current opacity-25">
          <div className="ml-1 h-0 w-0 border-y-[9px] border-l-[15px] border-y-transparent border-l-current" />
        </div>
      </div>
    );
  }

  // composition — layered geometry, the default
  return (
    <div aria-hidden="true" className="relative h-full w-full overflow-hidden">
      <div className="absolute right-[8%] top-[10%] h-[42%] w-[58%] rounded-card bg-brand/25" />
      <div className="absolute bottom-[14%] left-[10%] h-[46%] w-[46%] rounded-card border border-current opacity-20" />
      <div className="absolute bottom-[22%] right-[18%] h-16 w-16 rounded-full bg-brand/40" />
      <div
        className={`absolute left-[14%] top-[16%] h-2 w-[26%] rounded-full ${
          tone === "dark" ? "bg-white/25" : "bg-ink/20"
        }`}
      />
      <div
        className={`absolute left-[14%] top-[24%] h-2 w-[18%] rounded-full ${
          tone === "dark" ? "bg-white/15" : "bg-ink/12"
        }`}
      />
    </div>
  );
}

export function PlaceholderVisual({
  label,
  spec,
  ratio,
  tone = "dark",
  variant = "composition",
  className = "",
}: Props) {
  const edge = tone === "dark" ? "border-white/25" : "border-edge-strong";
  const text = tone === "dark" ? "text-sidebar-text" : "text-ink-muted-strong";

  return (
    <div
      role="img"
      aria-label={`Placeholder for ${label}`}
      style={{ aspectRatio: ratio, backgroundImage: hatch(tone) }}
      className={`relative flex flex-col justify-between overflow-hidden rounded-card border border-dashed ${edge} ${className}`}
    >
      <div className="absolute inset-0 p-4">
        <Shapes variant={variant} tone={tone} />
      </div>
      <div className="relative mt-auto flex flex-wrap items-baseline gap-x-2 gap-y-0.5 p-3">
        <span className={`text-label ${text}`}>{label}</span>
        <span className={`text-caption ${text}`}>{spec}</span>
      </div>
    </div>
  );
}
