"use client";

import { useRef, useState } from "react";
import { CheckCircle2, PackageCheck, UploadCloud, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import {
  createOnboardingPackageUpload,
  discardStagedOnboardingPackage,
  preflightStagedOnboardingPackage,
  provisionStagedOnboardingPackage,
} from "./actions";

type PreflightResult = Awaited<ReturnType<typeof preflightStagedOnboardingPackage>>;
type Receipt = Awaited<ReturnType<typeof provisionStagedOnboardingPackage>>;
type Phase = "idle" | "uploading" | "preflighting" | "ready" | "provisioning" | "completed" | "failed";

export function OnboardingPanel({ environment }: { environment: string | null }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [storagePath, setStoragePath] = useState<string | null>(null);
  const [preflight, setPreflight] = useState<PreflightResult | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);

  const busy = phase === "uploading" || phase === "preflighting" || phase === "provisioning";

  async function discardCurrentPackage() {
    if (storagePath) await discardStagedOnboardingPackage(storagePath).catch(() => undefined);
    setStoragePath(null);
    setPreflight(null);
    setReceipt(null);
    setConfirmation("");
    setError(null);
    setPhase("idle");
    if (fileInput.current) fileInput.current.value = "";
  }

  async function stageAndPreflight() {
    const file = fileInput.current?.files?.[0];
    if (!file) {
      setError("Choose a workspace ZIP package.");
      return;
    }
    setError(null);
    setReceipt(null);
    if (storagePath) await discardStagedOnboardingPackage(storagePath).catch(() => undefined);

    try {
      setPhase("uploading");
      const upload = await createOnboardingPackageUpload(file.name, file.size);
      setStoragePath(upload.storagePath);
      const zipFile = file.type === "application/zip"
        ? file
        : new File([file], file.name, { type: "application/zip" });
      const { error: uploadError } = await createClient()
        .storage.from("onboarding-packages")
        .uploadToSignedUrl(upload.storagePath, upload.token, zipFile, {
          contentType: "application/zip",
        });
      if (uploadError) throw new Error(`Package upload failed: ${uploadError.message}`);

      setPhase("preflighting");
      const result = await preflightStagedOnboardingPackage(upload.storagePath);
      setPreflight(result);
      setPhase(result.ok ? "ready" : "failed");
      if (!result.ok) {
        setStoragePath(null);
        setError("The package has blocking preflight issues.");
      }
    } catch (caught) {
      setPhase("failed");
      setError(caught instanceof Error ? caught.message : "Could not preflight the package.");
    }
  }

  async function createWorkspace() {
    if (!storagePath || !preflight?.ok || !preflight.blueprintSha256) return;
    setError(null);
    setPhase("provisioning");
    try {
      const result = await provisionStagedOnboardingPackage(
        storagePath,
        preflight.blueprintSha256,
        confirmation,
      );
      setReceipt(result);
      setStoragePath(null);
      setPhase("completed");
    } catch (caught) {
      setStoragePath(null);
      setPhase("failed");
      setError(caught instanceof Error ? caught.message : "Workspace provisioning failed.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-card border border-edge bg-surface p-5 shadow-card">
        <div className="mb-5 flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-tint text-brand">
            <UploadCloud aria-hidden />
          </span>
          <div>
            <h2 className="text-h3 font-semibold text-ink">Upload a reviewed package</h2>
            <p className="mt-1 text-small text-ink-muted">
              Target: <span className="font-semibold text-ink">{environment ?? "not configured"}</span>. ZIP only, 50 MB maximum.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="onboarding-package">Workspace package</Label>
          <Input
            ref={fileInput}
            id="onboarding-package"
            type="file"
            accept=".zip,application/zip,application/x-zip-compressed"
            disabled={busy || phase === "completed"}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={stageAndPreflight} disabled={busy || phase === "completed"}>
            {phase === "uploading" ? "Uploading…" : phase === "preflighting" ? "Checking…" : "Upload and preflight"}
          </Button>
          {(storagePath || phase === "completed") && (
            <Button type="button" variant="outline" onClick={discardCurrentPackage} disabled={busy}>
              Start over
            </Button>
          )}
        </div>
      </section>

      {preflight && (
        <section className="rounded-card border border-edge bg-surface p-5 shadow-card" aria-labelledby="preflight-heading">
          <div className="flex items-start gap-3">
            {preflight.ok ? (
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-approve" aria-hidden />
            ) : (
              <XCircle className="mt-0.5 size-5 shrink-0 text-reject" aria-hidden />
            )}
            <div className="min-w-0 flex-1">
              <h2 id="preflight-heading" className="text-h3 font-semibold text-ink">
                {preflight.ok ? "Preflight passed" : "Preflight blocked"}
              </h2>
              <p className="mt-1 break-words text-small text-ink-muted">
                {preflight.workspaceKey ?? "Unknown workspace"}
                {preflight.blueprintSha256 ? ` · ${preflight.blueprintSha256.slice(0, 12)}` : ""}
              </p>
            </div>
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Object.entries(preflight.counts).map(([label, value]) => (
              <div key={label} className="rounded-control bg-page px-3 py-2">
                <dt className="text-caption capitalize text-ink-muted">{label}</dt>
                <dd className="text-h3 font-semibold text-ink">{value}</dd>
              </div>
            ))}
          </dl>

          {preflight.issues.length > 0 && (
            <ul className="mt-5 flex flex-col gap-2">
              {preflight.issues.map((issue, index) => (
                <li key={`${issue.path}-${index}`} className="rounded-control border border-reject-border bg-reject-tint px-3 py-2 text-small text-reject">
                  <span className="font-semibold">{issue.path}:</span> {issue.message}
                </li>
              ))}
            </ul>
          )}

          {preflight.ok && preflight.productionConfirmation && (
            <div className="mt-5 flex flex-col gap-2">
              <Label htmlFor="production-confirmation">Production confirmation</Label>
              <p className="text-small text-ink-muted">
                Type <code className="rounded bg-page px-1.5 py-0.5 text-ink">{preflight.productionConfirmation}</code>
              </p>
              <Input
                id="production-confirmation"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="off"
              />
            </div>
          )}

          {preflight.ok && (
            <Button
              type="button"
              className="mt-5"
              onClick={createWorkspace}
              disabled={
                busy ||
                Boolean(preflight.productionConfirmation && confirmation !== preflight.productionConfirmation)
              }
            >
              <PackageCheck aria-hidden />
              {phase === "provisioning" ? "Creating workspace…" : "Create workspace"}
            </Button>
          )}
        </section>
      )}

      {receipt && (
        <section className="rounded-card border border-approve-border bg-approve-tint p-5" aria-labelledby="receipt-heading">
          <div className="flex items-center gap-2 text-approve">
            <CheckCircle2 className="size-5" aria-hidden />
            <h2 id="receipt-heading" className="text-h3 font-semibold">Workspace ready</h2>
          </div>
          <p className="mt-2 text-small text-ink">
            Run <code>{receipt.runId}</code> created {Object.keys(receipt.products).length} product(s), {Object.keys(receipt.campaigns).length} campaign(s), and {Object.keys(receipt.assets).length} asset record(s).
          </p>
          <ul className="mt-3 flex flex-col gap-1 text-small text-ink-muted">
            {receipt.setupEmails.map((delivery) => (
              <li key={delivery.email}>
                {delivery.email}: {delivery.sent ? "setup email sent" : `setup email needs resend (${delivery.error})`}
              </li>
            ))}
          </ul>
          {Object.keys(receipt.qaEnvironment).length > 0 && (
            <details className="mt-4 text-small text-ink">
              <summary className="cursor-pointer font-semibold">QA environment values</summary>
              <pre className="mt-2 overflow-x-auto rounded-control bg-surface p-3 text-caption">
                {Object.entries(receipt.qaEnvironment)
                  .map(([name, value]) => `${name}=${value}`)
                  .join("\n")}
              </pre>
            </details>
          )}
        </section>
      )}

      <p className="min-h-5 text-small text-reject" role="status" aria-live="polite">
        {error}
      </p>
    </div>
  );
}
