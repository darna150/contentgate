import { AlertTriangle, FlaskConical, ShieldAlert } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Operators run the same provisioning UI against more than one environment, and
 * the difference matters: a production run creates a real client workspace and
 * sends real account setup emails. Naming the target in body copy further down
 * the page is not enough — the environment has to be legible before any control
 * is touched, and production has to look materially unlike the safe targets.
 *
 * Presentation only. This reads the environment the server already resolved and
 * never gates, enables, or relaxes an action; the production confirmation phrase
 * and every server-side guard stay exactly where they are.
 */
type EnvironmentTone = "production" | "safe" | "unknown";

function describeEnvironment(environment: string | null) {
  const normalized = environment?.trim().toLowerCase() ?? "";

  if (normalized === "production") {
    return {
      tone: "production" as EnvironmentTone,
      label: "Production",
      headline: "You are operating on production",
      detail:
        "Provisioning here creates a real client workspace and sends real account setup emails. Confirm the package and the client before you continue.",
      Icon: ShieldAlert,
    };
  }

  if (normalized === "staging" || normalized === "development") {
    return {
      tone: "safe" as EnvironmentTone,
      label: normalized === "staging" ? "Staging" : "Development",
      headline: `You are operating on ${normalized}`,
      detail:
        "Runs here are for rehearsal. They do not touch production client workspaces.",
      Icon: FlaskConical,
    };
  }

  return {
    tone: "unknown" as EnvironmentTone,
    label: "Not configured",
    headline: "Target environment is not configured",
    detail:
      "CONTENTGATE_ENVIRONMENT is unset, so this surface cannot confirm which environment a run would reach. Treat it as unsafe and resolve the configuration before provisioning.",
    Icon: AlertTriangle,
  };
}

export function OnboardingEnvironmentBanner({
  environment,
}: {
  environment: string | null;
}) {
  const { tone, label, headline, detail, Icon } = describeEnvironment(environment);

  return (
    <section
      aria-label="Target environment"
      className={cn(
        "flex items-start gap-3 rounded-card border p-4",
        tone === "production" && "border-reject-border bg-reject-tint",
        tone === "safe" && "border-edge bg-surface",
        tone === "unknown" && "border-warn-border bg-warn-tint"
      )}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full",
          tone === "production" && "bg-reject text-white",
          tone === "safe" && "bg-page text-ink-muted",
          tone === "unknown" && "bg-warn text-white"
        )}
      >
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p
            className={cn(
              "text-h2",
              tone === "production" && "text-reject",
              tone === "safe" && "text-ink",
              tone === "unknown" && "text-warn"
            )}
          >
            {headline}
          </p>
          {/* The token is repeated as a chip so the environment is still
              identifiable when the sentence is skimmed rather than read. */}
          <span
            className={cn(
              "inline-flex w-fit shrink-0 items-center rounded-full px-[9px] py-0.5 text-[11px] font-bold uppercase tracking-[0.1em]",
              tone === "production" && "bg-reject text-white",
              tone === "safe" && "border border-edge-strong bg-page text-ink-muted",
              tone === "unknown" && "bg-warn text-white"
            )}
          >
            {label}
          </span>
        </div>
        <p
          className={cn(
            "mt-1 text-body",
            tone === "production" ? "text-reject" : "text-ink-muted"
          )}
        >
          {detail}
        </p>
      </div>
    </section>
  );
}
