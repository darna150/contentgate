"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const NAV = [
  { href: "/ask", label: "Knowledge Hub" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/products", label: "Products" },
  { href: "/assets", label: "Asset Library" },
  { href: "/content", label: "Content" },
  { href: "/approvals", label: "Approval Queue" },
];

// Admin-only: the cross-product source-document library.
const ADMIN_NAV = [
  { href: "/knowledge", label: "Source Documents" },
  { href: "/templates", label: "Template Ops" },
];

type Props = {
  orgName: string;
  orgIndustry: string | null;
  userName: string;
  userRole: string;
  pendingCount: number;
};

export function Sidebar({ orgName, orgIndustry, userName, userRole, pendingCount }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
    };
  }, [mobileOpen]);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const productsIndex = NAV.findIndex((item) => item.href === "/products") + 1;
  const items =
    userRole === "admin"
      ? [...NAV.slice(0, productsIndex), ...ADMIN_NAV, ...NAV.slice(productsIndex)]
      : NAV;

  const initials = userName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const navigation = (onNavigate?: () => void) => (
    <nav className="flex flex-col gap-0.5">
      {items.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-2.5 rounded-full px-3 py-2.5 text-[13.5px] font-semibold transition-colors ${
              active
                ? "bg-brand-tint text-brand"
                : "text-ink-muted hover:bg-page hover:text-ink"
            }`}
          >
            <span className="flex-1">{item.label}</span>
            {item.href === "/approvals" && pendingCount > 0 && (
              <span className="rounded-full bg-brand-dark px-[7px] py-px text-[11px] font-bold text-white">
                {pendingCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  const userSummary = (
    <div className="flex items-center gap-2.5 border-t border-edge px-2 pt-3">
      <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-brand-dark text-[11px] font-bold text-white">
        {initials || "?"}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[13px] font-semibold">{userName}</span>
        <span className="text-[11px] capitalize text-ink-faint">{userRole}</span>
      </div>
      <button
        type="button"
        onClick={signOut}
        title="Sign out"
        aria-label="Sign out"
        className="flex h-7 w-7 items-center justify-center rounded-[7px] text-ink-faint transition-colors hover:bg-page hover:text-ink"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M6 2.5H4a1.5 1.5 0 00-1.5 1.5v8A1.5 1.5 0 004 13.5h2M10.5 11l3-3-3-3M13.5 8H6"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );

  return (
    <>
      <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-edge bg-surface px-4 md:hidden">
        <Image
          src="/brand/contentgate/logo-primary.svg"
          alt="ContentGate"
          width={135}
          height={27}
          priority
        />
        <button
          type="button"
          aria-label="Open navigation"
          aria-expanded={mobileOpen}
          aria-controls="mobile-navigation"
          onClick={() => setMobileOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-control border border-edge text-ink-muted transition-colors hover:border-brand hover:text-brand"
        >
          <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
            <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            tabIndex={-1}
            className="absolute inset-0 bg-ink/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            id="mobile-navigation"
            aria-label="Mobile navigation"
            className="relative flex h-full w-[min(320px,88vw)] flex-col gap-4 border-r border-edge bg-surface px-3.5 py-5 shadow-xl"
          >
            <div className="flex items-center justify-between px-2 py-1">
              <Image
                src="/brand/contentgate/logo-primary.svg"
                alt="ContentGate"
                width={140}
                height={28}
                priority
              />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
                className="flex h-8 w-8 items-center justify-center rounded-[7px] text-ink-faint transition-colors hover:bg-page hover:text-ink"
              >
                <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden="true">
                  <path d="M3.5 3.5l9 9m0-9l-9 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="flex items-center gap-2.5 rounded-[10px] border border-edge bg-page px-3 py-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-brand-dark text-[11px] font-bold text-white">
                {orgName[0]}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold">{orgName}</p>
                <p className="text-[11px] text-ink-faint">Workspace</p>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {navigation(() => setMobileOpen(false))}
            </div>
            {userSummary}
          </aside>
        </div>
      )}

      <aside className="sticky top-0 hidden h-screen w-[248px] flex-shrink-0 flex-col gap-4 border-r border-edge bg-surface px-3.5 py-5 md:flex">
      {/* Logo */}
      <div className="flex flex-col gap-1 px-2 py-1">
        <Image
          src="/brand/contentgate/logo-primary.svg"
          alt="ContentGate"
          width={140}
          height={28}
          priority
        />
        {orgIndustry && (
          <span className="pl-[33px] text-[10px] uppercase tracking-[0.12em] text-ink-faint">
            {orgIndustry}
          </span>
        )}
      </div>

      {/* Workspace card */}
      <div className="flex items-center gap-2.5 rounded-[10px] border border-edge bg-page px-3 py-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-brand-dark text-[11px] font-bold text-white">
          {orgName[0]}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold">{orgName}</p>
          <p className="text-[11px] text-ink-faint">Workspace</p>
        </div>
      </div>

      {/* Nav */}
      {navigation()}

      {/* User */}
      <div className="mt-auto">{userSummary}</div>
      </aside>
    </>
  );
}
