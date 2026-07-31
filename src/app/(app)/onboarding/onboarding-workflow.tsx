"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle2, PackageCheck, ShieldCheck } from "lucide-react";

import { OnboardingPanel } from "./onboarding-panel";
import { PackageBuilder, type GeneratedOnboardingPackage } from "./package-builder";

const stages = [
  { title: "Prepare", description: "Convert the signed client handoff into one reviewed ZIP.", icon: ShieldCheck },
  { title: "Validate", description: "Run read-only schema, source, asset, and template preflight.", icon: CheckCircle2 },
  { title: "Create", description: "Provision the isolated workspace and send account setup emails.", icon: PackageCheck },
];

export function OnboardingWorkflow({ environment }: { environment: string | null }) {
  const [generatedPackage, setGeneratedPackage] = useState<GeneratedOnboardingPackage | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <ol className="grid gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:items-center" aria-label="Client onboarding stages">
        {stages.map((stage, index) => {
          const Icon = stage.icon;
          return (
            <li key={stage.title} className="contents">
              <div className="flex min-h-24 items-start gap-3 rounded-card border border-edge bg-surface p-4 shadow-card">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-tint text-brand"><Icon className="size-4" aria-hidden /></span>
                <div><p className="text-caption font-semibold uppercase tracking-[0.14em] text-brand">Stage {index + 1}</p><p className="mt-1 font-semibold text-ink">{stage.title}</p><p className="mt-1 text-small text-ink-muted">{stage.description}</p></div>
              </div>
              {index < stages.length - 1 && <ArrowRight className="mx-auto hidden size-5 text-ink-faint lg:block" aria-hidden />}
            </li>
          );
        })}
      </ol>
      <PackageBuilder built={generatedPackage} onPackageBuilt={setGeneratedPackage} />
      <OnboardingPanel
        environment={environment}
        generatedPackage={generatedPackage}
        onGeneratedPackageCleared={() => setGeneratedPackage(null)}
      />
    </div>
  );
}
