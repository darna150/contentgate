"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient, hasSupabaseBrowserConfig } from "@/lib/supabase/client";

type Status =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "sent" }
  | { kind: "error"; message: string };

export function ForgotPasswordForm() {
  const emailId = useId();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function requestReset(event: React.FormEvent) {
    event.preventDefault();
    setStatus({ kind: "busy" });

    if (!hasSupabaseBrowserConfig()) {
      setStatus({
        kind: "error",
        message: "Password recovery is not configured for this environment.",
      });
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      // The email template appends its token hash and flow type to this
      // server endpoint. The server verifies the token before it establishes
      // the recovery session and forwards the browser to the reset form.
      redirectTo: `${window.location.origin}/auth/confirm`,
    });

    if (error) {
      setStatus({
        kind: "error",
        message: "We could not send the reset email. Wait a moment and try again.",
      });
      return;
    }

    setStatus({ kind: "sent" });
  }

  if (status.kind === "sent") {
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="rounded-control border border-approve-border bg-approve-tint px-3.5 py-3 text-[13px] text-approve">
          If an account exists for that address, a password reset link is on its way.
        </p>
        <Link href="/login" className="text-sm font-semibold text-brand underline-offset-4 hover:underline">
          Return to sign in
        </Link>
      </div>
    );
  }

  const busy = status.kind === "busy";

  return (
    <form onSubmit={requestReset} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label
          htmlFor={emailId}
          className="text-[13px] font-semibold normal-case tracking-normal text-ink"
        >
          Work email
        </Label>
        <Input
          id={emailId}
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@company.com"
          className="h-auto py-3 text-sm"
        />
      </div>

      <Button type="submit" size="lg" disabled={busy} className="mt-1">
        {busy ? "Sending…" : "Send reset link"}
      </Button>

      <Link href="/login" className="text-sm font-semibold text-brand underline-offset-4 hover:underline">
        Return to sign in
      </Link>

      {status.kind === "error" && (
        <p role="alert" className="rounded-control border border-reject-border bg-reject-tint px-3.5 py-3 text-[13px] text-reject">
          {status.message}
        </p>
      )}
    </form>
  );
}
