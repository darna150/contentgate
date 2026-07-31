"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, hasSupabaseBrowserConfig } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Provider errors are never shown verbatim.
 *
 * Supabase distinguishes cases that reveal whether an address is registered —
 * "Email not confirmed" only comes back for an account that exists, while an
 * unknown address gets "Invalid login credentials". Rendering the raw message
 * turns the sign-in form into an account-existence oracle. Every credential
 * outcome collapses to one sentence; only rate limiting, which says nothing
 * about any particular account, is reported distinctly so an operator can tell
 * a lockout from a typo.
 *
 * This changes wording only. Nothing about how the credential is verified,
 * where it is verified, or what the server does with the result is touched.
 */
function signInErrorMessage(error: { message: string; status?: number }) {
  if (error.status === 429 || /rate limit/i.test(error.message)) {
    return "Too many sign-in attempts. Wait a moment and try again.";
  }
  return "That email and password do not match an account. Check both and try again.";
}

export function LoginForm() {
  const router = useRouter();
  const emailId = useId();
  const passwordId = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<
    { kind: "idle" } | { kind: "busy" } | { kind: "sent" } | { kind: "error"; message: string }
  >({ kind: "idle" });

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setStatus({ kind: "busy" });
    if (!hasSupabaseBrowserConfig()) {
      setStatus({
        kind: "error",
        message: "Authentication is not configured for this environment.",
      });
      return;
    }
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setStatus({ kind: "error", message: signInErrorMessage(error) });
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      // Without this the promise rejects on a dropped connection, status stays
      // "busy" forever, and the submit button never re-enables — the form
      // becomes unusable until a full page reload.
      setStatus({
        kind: "error",
        message: "We could not reach the server. Check your connection and try again.",
      });
    }
  }

  const busy = status.kind === "busy";

  return (
    <form onSubmit={signInWithPassword} className="flex flex-col gap-4">
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
          // Pairs with current-password below so password managers recognise
          // this as one credential set and fill both fields.
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          className="h-auto py-3 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-3">
          <Label
            htmlFor={passwordId}
            className="text-[13px] font-semibold normal-case tracking-normal text-ink"
          >
            Password
          </Label>
          <Link
            href="/forgot-password"
            className="text-[13px] font-semibold text-brand underline-offset-4 hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <Input
          id={passwordId}
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="h-auto py-3 text-sm"
        />
      </div>

      <Button type="submit" size="lg" disabled={busy} className="mt-1">
        {busy ? "Entering…" : "Enter workspace"}
      </Button>

      {status.kind === "sent" && (
        <p role="status" className="rounded-control border border-approve-border bg-approve-tint px-3.5 py-3 text-[13px] text-approve">
          Check your inbox — we sent you a sign-in link.
        </p>
      )}
      {status.kind === "error" && (
        <p role="alert" className="rounded-control border border-reject-border bg-reject-tint px-3.5 py-3 text-[13px] text-reject">
          {status.message}
        </p>
      )}
    </form>
  );
}
