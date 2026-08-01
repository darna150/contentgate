import { LoginForm } from "./login-form";

/**
 * /auth/confirm redirects here with ?error=auth when an email link fails to
 * verify — expired, already used, or malformed. That signal was being dropped,
 * so someone who clicked a stale invite or confirmation link arrived at an
 * ordinary sign-in screen with no idea why, and no idea what to do next.
 *
 * The wording deliberately does not say whether an account exists.
 */
function LinkFailureNotice() {
  return (
    <div
      role="status"
      className="flex flex-col gap-1 rounded-control border border-warn-border bg-warn-tint px-3.5 py-3"
    >
      <p className="text-[13px] font-semibold text-warn">
        That link could not be used
      </p>
      <p className="text-[13px] text-warn">
        Email links expire and can only be used once. Sign in below, or use
        “Forgot password?” to send yourself a new link.
      </p>
    </div>
  );
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main id="main-content" className="flex min-h-screen bg-page" tabIndex={-1}>
      <div className="hidden w-[44%] flex-col bg-brand-dark p-12 text-white md:flex">
        <div className="flex items-center gap-2.5">
          <span className="flex h-[26px] w-[26px] items-center justify-center rounded-[7px] bg-brand text-[15px] font-extrabold leading-none text-white">
            C
          </span>
          <span className="text-[18px] font-bold tracking-[-0.03em] text-white">contentgate</span>
        </div>

        <div className="flex max-w-md flex-1 flex-col justify-center gap-5">
          <h2 className="text-[44px] font-bold leading-[0.98] tracking-[-0.03em] text-white">
            Locked templates. Approved claims. Nothing ships without a sign-off.
          </h2>
          <p className="max-w-sm text-[15px] leading-relaxed text-sidebar-text">
            Generate localized content from governed source knowledge and route every export through approval.
          </p>
        </div>

        <p className="text-xs text-sidebar-faint">© 2026 ContentGate</p>
      </div>

      <div className="flex flex-1 items-center justify-center bg-page p-6 sm:p-12">
        <div className="flex w-full max-w-[340px] flex-col gap-6">
          <div className="flex items-center gap-2.5 md:hidden">
            <span className="flex h-[26px] w-[26px] items-center justify-center rounded-[7px] bg-brand text-[15px] font-extrabold leading-none text-white">
              C
            </span>
            <span className="text-[18px] font-bold tracking-[-0.03em] text-ink">contentgate</span>
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-h1 text-ink">Sign in</h1>
            <p className="text-body text-ink-muted">
              Welcome back. Use your company credentials.
            </p>
          </div>
          {error === "auth" && <LinkFailureNotice />}
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
