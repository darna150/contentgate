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
import type { GeneratedOnboardingPackage } from "./package-builder";

type PreflightResult = Awaited<ReturnType<typeof preflightStagedOnboardingPackage>>;
type Receipt = Awaited<ReturnType<typeof provisionStagedOnboardingPackage>>;
type Phase = "idle" | "uploading" | "preflighting" | "ready" | "provisioning" | "completed" | "failed";

export function OnboardingPanel({
  environment,
  generatedPackage,
  onGeneratedPackageCleared,
}: {
  environment: string | null;
  generatedPackage: GeneratedOnboardingPackage | null;
  onGeneratedPackageCleared: () => void;
}) {
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
    onGeneratedPackageCleared();
    if (fileInput.current) fileInput.current.value = "";
  }

  async function stageAndPreflight() {
    const file = generatedPackage?.file ?? fileInput.current?.files?.[0];
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
            <p className="text-overline uppercase tracking-[0.16em] text-brand">Validate</p>
            <h2 className="text-h3 font-semibold text-ink">Preflight the reviewed package</h2>
            <p className="mt-1 text-small text-ink-muted">
              Target: <span className="font-semibold text-ink">{environment ?? "not configured"}</span>. ZIP only, 50 MB maximum.
            </p>
          </div>
        </div>

        {generatedPackage ? (
          <div className="rounded-control border border-approve-border bg-approve-tint p-3">
            <p className="text-small font-semibold text-approve">Generated package selected</p>
            <p className="mt-1 text-small text-ink">{generatedPackage.file.name} · {(generatedPackage.file.size / 1024 / 1024).toFixed(2)} MB</p>
            <p className="mt-1 text-caption text-ink-muted">{generatedPackage.workspaceName} · {Object.entries(generatedPackage.counts).map(([name, count]) => `${count} ${name}`).join(" · ")}</p>
          </div>
        ) : <div className="flex flex-col gap-2">
          <Label htmlFor="onboarding-package">Or upload an existing reviewed ZIP</Label>
          <Input
            ref={fileInput}
            id="onboarding-package"
            type="file"
            accept=".zip,application/zip,application/x-zip-compressed"
            disabled={busy || phase === "completed"}
          />
        </div>}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={stageAndPreflight} disabled={busy || phase === "completed"}>
            {phase === "uploading" ? "Uploading…" : phase === "preflighting" ? "Checking…" : "Upload and preflight"}
          </Button>
          {(storagePath || generatedPackage || preflight || phase === "completed") && (
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
            <>
              <Button
                type="button"
                className="mt-5"
                onClick={createWorkspace}
                aria-describedby={
                  preflight.productionConfirmation && confirmation !== preflight.productionConfirmation
                    ? "create-blocked-reason"
                    : undefined
                }
                disabled={
                  busy ||
                  Boolean(preflight.productionConfirmation && confirmation !== preflight.productionConfirmation)
                }
              >
                <PackageCheck aria-hidden />
                {phase === "provisioning" ? "Creating workspace…" : "Create workspace"}
              </Button>
              {preflight.productionConfirmation &&
                confirmation !== preflight.productionConfirmation && (
                  <p id="create-blocked-reason" className="mt-2 text-small text-ink-muted">
                    Type the confirmation phrase above to enable workspace
                    creation.
                  </p>
                )}
              {phase === "provisioning" && (
                // Provisioning writes tenant records and sends real setup email.
                // A changed button label was the only signal that something
                // irreversible was under way.
                <p className="mt-3 text-small text-ink-muted" role="status">
                  Creating the workspace and sending account setup emails. This
                  can take a moment — keep this page open until the receipt
                  appears.
                </p>
              )}
            </>
          )}
        </section>
      )}

      {receipt && (
        <section className="rounded-card border border-approve-border bg-approve-tint p-5" aria-labelledby="receipt-heading">
          <div className="flex items-center gap-2 text-approve">
            <CheckCircle2 className="size-5" aria-hidden />
            <h2 id="receipt-heading" className="text-h3 font-semibold">
              {/* A replayed run and a first run are materially different events.
                  The receipt carries `resumed`, and reporting both as "created"
                  told an operator a re-run had produced a second workspace. */}
              {receipt.resumed ? "Workspace already provisioned" : "Workspace ready"}
            </h2>
          </div>
          <p className="mt-2 text-small text-ink">
            {receipt.resumed ? (
              <>
                Run <code>{receipt.runId}</code> returned the existing completed
                receipt for {Object.keys(receipt.products).length} product(s),{" "}
                {Object.keys(receipt.campaigns).length} campaign(s), and{" "}
                {Object.keys(receipt.assets).length} asset record(s). No
                provisioning steps were rerun and nothing was duplicated.
              </>
            ) : (
              <>
                Run <code>{receipt.runId}</code> created{" "}
                {Object.keys(receipt.products).length} product(s),{" "}
                {Object.keys(receipt.campaigns).length} campaign(s), and{" "}
                {Object.keys(receipt.assets).length} asset record(s).
              </>
            )}
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
              <summary className="cursor-pointer font-semibold">
                QA fixture values (non-secret)
              </summary>
              <pre className="mt-2 overflow-x-auto rounded-control bg-surface p-3 text-caption">
                {Object.entries(receipt.qaEnvironment)
                  .map(([name, value]) => `${name}=${value}`)
                  .join("\n")}
              </pre>
            </details>
          )}
        </section>
      )}

      {/* A failed provisioning run is an error, not a status update, and it may
          have left partial records behind. Saying so — and being explicit that
          the audit trail is not erasable — is the difference between an
          operator who can escalate and one who retries blindly. */}
      {error ? (
        <section
          role="alert"
          className="flex flex-col gap-1 rounded-card border border-reject-border bg-reject-tint p-4"
        >
          <p className="text-small font-semibold text-reject">
            {phase === "failed" ? "Provisioning did not complete" : "That step did not complete"}
          </p>
          <p className="text-small text-reject">{error}</p>
          {phase === "failed" && (
            <p className="mt-1 text-small text-ink-muted">
              The system attempted to remove records created by this run, but
              partial records may remain if cleanup also failed. Do not retry
              blindly: review the immutable audit trail and recovery guidance
              first. A compensated package may need to be rebuilt before it can
              be run again.
            </p>
          )}
        </section>
      ) : (
        <p className="min-h-5" aria-live="polite" />
      )}
    </div>
  );
}
