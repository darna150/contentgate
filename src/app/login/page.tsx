import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen bg-page">
      <div className="hidden w-[44%] flex-col bg-brand-dark p-12 text-white md:flex">
        <div className="flex items-center gap-2.5">
          <span className="flex h-[26px] w-[26px] items-center justify-center rounded-[7px] bg-brand text-[15px] font-extrabold leading-none text-white">
            C
          </span>
          <span className="text-[18px] font-bold tracking-[-0.03em] text-white">contentgate</span>
        </div>

        <div className="flex max-w-md flex-1 flex-col justify-center gap-5">
          <h1 className="text-[44px] font-bold leading-[0.98] tracking-[-0.03em] text-white">
            Locked templates. Approved claims. Nothing ships without a sign-off.
          </h1>
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
            <h2 className="text-h1 text-ink">Sign in</h2>
            <p className="text-body text-ink-muted">
              Welcome back. Use your company credentials.
            </p>
          </div>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
