import { WelcomeClient } from "./welcome-client";

export default function WelcomePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-page p-6 sm:p-12">
      <div className="flex w-full max-w-[340px] flex-col gap-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-[26px] w-[26px] items-center justify-center rounded-[7px] bg-brand text-[15px] font-extrabold leading-none text-white">
            C
          </span>
          <span className="text-[18px] font-bold tracking-[-0.03em] text-ink">
            contentgate
          </span>
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-h1 text-ink">Welcome aboard</h1>
          <p className="text-body text-ink-muted">
            You&apos;ve been invited to a ContentGate workspace.
          </p>
        </div>
        <WelcomeClient />
      </div>
    </div>
  );
}
