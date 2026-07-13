"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<
    { kind: "idle" } | { kind: "busy" } | { kind: "sent" } | { kind: "error"; message: string }
  >({ kind: "idle" });

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setStatus({ kind: "busy" });
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setStatus({ kind: "error", message: error.message });
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  async function sendMagicLink() {
    if (!email) {
      setStatus({ kind: "error", message: "Enter your work email first." });
      return;
    }
    setStatus({ kind: "busy" });
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        shouldCreateUser: false,
      },
    });
    if (error) {
      setStatus({ kind: "error", message: error.message });
      return;
    }
    setStatus({ kind: "sent" });
  }

  return (
    <form onSubmit={signInWithPassword} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold">Work email</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          className="rounded-control border border-edge-strong bg-surface px-3.5 py-3 text-sm outline-none focus:border-brand"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold">Password</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="rounded-control border border-edge-strong bg-surface px-3.5 py-3 text-sm outline-none focus:border-brand"
        />
      </label>

      <button
        type="submit"
        disabled={status.kind === "busy"}
        className="mt-1 rounded-control bg-brand px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {status.kind === "busy" ? "Signing in…" : "Sign in"}
      </button>
      <button
        type="button"
        onClick={sendMagicLink}
        disabled={status.kind === "busy"}
        className="rounded-control border border-edge-strong px-4 py-3 text-sm font-semibold text-ink-muted transition-colors hover:border-brand hover:text-brand disabled:opacity-50"
      >
        Email me a magic link
      </button>

      {status.kind === "sent" && (
        <p className="rounded-control border border-approve-border bg-approve-tint px-3.5 py-3 text-[13px] text-approve">
          Check your inbox — we sent you a sign-in link.
        </p>
      )}
      {status.kind === "error" && (
        <p className="rounded-control border border-reject-border bg-reject-tint px-3.5 py-3 text-[13px] text-reject">
          {status.message}
        </p>
      )}
    </form>
  );
}
