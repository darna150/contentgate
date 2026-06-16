import Image from "next/image";
import { LoginForm } from "./login-form";

const PROMISES = [
  "Answers cite approved source documents only",
  "Every claim checked before it ships",
  "Export only what's been approved",
];

export default function LoginPage() {
  return (
    <div className="flex min-h-screen">
      {/* Brand panel */}
      <div className="hidden md:flex w-[44%] flex-col gap-6 bg-brand-dark p-12 text-white">
        <div className="flex flex-col gap-1">
          <Image
            src="/brand/contentgate/logo-horizontal-light.svg"
            alt="ContentGate"
            width={180}
            height={36}
            priority
          />
          <span className="pl-[43px] text-[10px] uppercase tracking-[0.12em] text-sidebar-faint">
            Compliant content
          </span>
        </div>

        <div className="flex max-w-md flex-1 flex-col justify-center gap-5">
          <h1 className="font-serif text-[42px] font-medium leading-[1.16]">
            One source of truth for{" "}
            <span className="italic text-[#A9D3C6]">every market</span>
          </h1>
          <p className="text-[15px] leading-relaxed text-sidebar-text">
            Approved product knowledge, localized content, and compliant
            approvals — in one place.
          </p>
          <ul className="mt-2 flex flex-col gap-3">
            {PROMISES.map((p) => (
              <li
                key={p}
                className="flex items-center gap-2.5 text-[13.5px] text-[#C9DAD3]"
              >
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6.5" stroke="#5B8F84" strokeWidth="1.4" />
                  <path d="M5.2 8.2l2 2 3.6-4" stroke="#5B8F84" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {p}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-[#5B7D75]">© 2026 ContentGate</p>
      </div>

      {/* Sign-in panel */}
      <div className="flex flex-1 items-center justify-center p-12">
        <div className="flex w-[400px] flex-col gap-6">
          <Image
            src="/brand/contentgate/logo-primary.svg"
            alt="ContentGate"
            width={160}
            height={32}
            className="md:hidden"
            priority
          />
          <div className="flex flex-col gap-2">
            <h2 className="font-serif text-[27px] font-semibold">Sign in</h2>
            <p className="text-sm text-ink-muted">
              Welcome back. Use your company credentials.
            </p>
          </div>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
