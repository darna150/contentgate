"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Phase =
  | { kind: "verifying" }
  | { kind: "ready"; email: string | null }
  | { kind: "saving"; email: string | null }
  | { kind: "invalid"; message: string };

// Invite links can arrive as a PKCE `?code=` or as implicit-flow tokens in
// the URL hash depending on how Supabase verified the email link, so both
// are handled explicitly instead of relying on auto-detection.
export function WelcomeClient() {
  const router = useRouter();
  const passwordId = useId();
  const confirmId = useId();
  const [phase, setPhase] = useState<Phase>({ kind: "verifying" });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function establishSession(): Promise<
      { error: string } | { email: string | null }
    > {
      const url = new URL(window.location.href);
      const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
      const failure =
        hashParams.get("error_description") ?? url.searchParams.get("error_description");
      if (failure) return { error: failure };

      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) return { error: error.message };
        window.history.replaceState(null, "", url.pathname);
      } else if (url.searchParams.get("code")) {
        const { error } = await supabase.auth.exchangeCodeForSession(
          window.location.href
        );
        if (error) return { error: error.message };
        window.history.replaceState(null, "", url.pathname);
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return {
          error:
            "This invite link is invalid or has expired. Ask your workspace admin to send a new one.",
        };
      }
      return { email: user.email ?? null };
    }

    establishSession().then((result) => {
      if (cancelled) return;
      if ("error" in result) {
        setPhase({ kind: "invalid", message: result.error });
      } else {
        setPhase({ kind: "ready", email: result.email });
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (phase.kind !== "ready") return;
    if (password.length < 8) {
      setFormError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setFormError("Passwords do not match.");
      return;
    }
    setFormError(null);
    setPhase({ kind: "saving", email: phase.email });
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setFormError(error.message);
      setPhase({ kind: "ready", email: phase.email });
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  if (phase.kind === "verifying") {
    return <p className="text-body text-ink-muted">Verifying your invite…</p>;
  }

  if (phase.kind === "invalid") {
    return (
      <p className="rounded-control border border-reject-border bg-reject-tint px-3.5 py-3 text-[13px] text-reject">
        {phase.message}
      </p>
    );
  }

  const busy = phase.kind === "saving";

  return (
    <form onSubmit={savePassword} className="flex flex-col gap-4">
      {phase.email && (
        <p className="text-body text-ink-muted">
          Signed in as <span className="font-semibold text-ink">{phase.email}</span>.
          Choose a password to finish setting up your account.
        </p>
      )}
      <div className="flex flex-col gap-1.5">
        <Label
          htmlFor={passwordId}
          className="text-[13px] font-semibold normal-case tracking-normal text-ink"
        >
          Password
        </Label>
        <Input
          id={passwordId}
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          className="h-auto py-3 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label
          htmlFor={confirmId}
          className="text-[13px] font-semibold normal-case tracking-normal text-ink"
        >
          Confirm password
        </Label>
        <Input
          id={confirmId}
          type="password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="••••••••"
          className="h-auto py-3 text-sm"
        />
      </div>

      <Button type="submit" size="lg" disabled={busy} className="mt-1">
        {busy ? "Saving…" : "Set password and enter workspace"}
      </Button>

      {formError && (
        <p className="rounded-control border border-reject-border bg-reject-tint px-3.5 py-3 text-[13px] text-reject">
          {formError}
        </p>
      )}
    </form>
  );
}
