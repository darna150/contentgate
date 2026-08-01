"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import type { AssuranceLevel } from "@/lib/auth/admin-mfa-policy";

type Phase = "loading" | "setup" | "challenge" | "complete";
type Enrollment = { factorId: string; qrCode: string; secret: string };

function qrDataUrl(svg: string) {
  return svg.startsWith("data:image/svg+xml")
    ? svg
    : `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function MfaSetup({
  required,
  initialLevel,
}: {
  required: boolean;
  initialLevel: AssuranceLevel;
}) {
  const router = useRouter();
  const codeId = useId();
  const [phase, setPhase] = useState<Phase>(
    initialLevel === "aal2" ? "complete" : "loading"
  );
  const [factorId, setFactorId] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialLevel === "aal2") return;
    let cancelled = false;
    const supabase = createClient();

    Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ])
      .then(([factors, assurance]) => {
        if (cancelled) return;
        if (factors.error || assurance.error) {
          setError("We could not load your MFA status. Refresh and try again.");
          setPhase("setup");
          return;
        }
        if (assurance.data.currentLevel === "aal2") {
          setPhase("complete");
          return;
        }
        const verified = factors.data.totp[0];
        if (verified) {
          setFactorId(verified.id);
          setPhase("challenge");
        } else {
          setPhase("setup");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("We could not reach the authentication service. Refresh and try again.");
          setPhase("setup");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [initialLevel]);

  async function beginEnrollment() {
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const factors = await supabase.auth.mfa.listFactors();
      if (factors.error) throw factors.error;
      for (const factor of factors.data.all) {
        if (factor.factor_type === "totp" && factor.status === "unverified") {
          await supabase.auth.mfa.unenroll({ factorId: factor.id });
        }
      }
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "ContentGate admin",
        issuer: "ContentGate",
      });
      if (enrollError) throw enrollError;
      setEnrollment({
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      });
      setFactorId(data.id);
      setPhase("setup");
    } catch {
      setError("We could not start MFA enrollment. Wait a moment and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    if (!factorId || !/^\d{6}$/.test(code)) {
      setError("Enter the current six-digit code from your authenticator app.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error: verifyError } =
        await createClient().auth.mfa.challengeAndVerify({ factorId, code });
      if (verifyError) {
        setError("That code was not accepted. Wait for a new code and try again.");
        return;
      }
      setCode("");
      setPhase("complete");
      router.replace(required ? "/dashboard" : "/settings");
      router.refresh();
    } catch {
      setError("We could not verify the code. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (phase === "loading") {
    return <p role="status" className="text-body text-ink-muted">Checking MFA status…</p>;
  }

  if (phase === "complete") {
    return (
      <div className="flex flex-col gap-4 rounded-card border border-approve-border bg-approve-tint p-5">
        <p role="status" className="font-semibold text-approve">
          This session is verified with MFA.
        </p>
        <Link
          href={required ? "/dashboard" : "/settings"}
          className="text-sm font-semibold text-brand underline-offset-4 hover:underline"
        >
          Continue to ContentGate
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 rounded-card border border-edge bg-surface p-5 shadow-card">
      {phase === "setup" && !enrollment && (
        <div className="flex flex-col gap-3">
          <p className="text-body text-ink-muted">
            Add ContentGate to a TOTP authenticator such as 1Password, Google
            Authenticator, or Microsoft Authenticator.
          </p>
          <Button type="button" onClick={beginEnrollment} disabled={busy}>
            {busy ? "Preparing…" : "Set up authenticator"}
          </Button>
        </div>
      )}

      {enrollment && (
        <div className="flex flex-col gap-4">
          <div className="mx-auto rounded-control border border-edge bg-white p-3">
            <Image
              src={qrDataUrl(enrollment.qrCode)}
              alt="QR code for ContentGate MFA enrollment"
              width={192}
              height={192}
              unoptimized
            />
          </div>
          <div>
            <p className="text-small font-semibold text-ink">Can&apos;t scan it?</p>
            <p className="mt-1 break-all rounded-control bg-page p-3 font-mono text-small text-ink">
              {enrollment.secret}
            </p>
          </div>
        </div>
      )}

      {(phase === "challenge" || enrollment) && (
        <form onSubmit={verify} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={codeId}>Six-digit code</Label>
            <Input
              id={codeId}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              aria-invalid={Boolean(error) || undefined}
              aria-describedby={error ? `${codeId}-error` : undefined}
            />
          </div>
          <Button type="submit" disabled={busy || code.length !== 6}>
            {busy ? "Verifying…" : "Verify and continue"}
          </Button>
        </form>
      )}

      {error && (
        <p
          id={`${codeId}-error`}
          role="alert"
          className="rounded-control border border-reject-border bg-reject-tint px-3.5 py-3 text-small text-reject"
        >
          {error}
        </p>
      )}
    </div>
  );
}
