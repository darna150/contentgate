"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useFocusTrap } from "@/lib/use-focus-trap";
import {
  CheckCircle2,
  FileStack,
  Images,
  LayoutDashboard,
  LayoutTemplate,
  LogOut,
  MessageSquareText,
  Rows3,
  Sparkles,
  X,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/products", label: "Products", icon: Sparkles },
  { href: "/content", label: "Content", icon: Rows3 },
  { href: "/approvals", label: "Approvals", icon: CheckCircle2 },
  { href: "/assets", label: "Assets", icon: Images },
  { href: "/ask", label: "Ask", icon: MessageSquareText },
];

// Admin-only: cross-org configuration surfaces, visually separated below.
const ADMIN_NAV = [
  { href: "/knowledge", label: "Source Documents", icon: FileStack },
  { href: "/templates", label: "Template Ops", icon: LayoutTemplate },
];

type Props = {
  orgName: string;
  orgIndustry: string | null;
  userName: string;
  userRole: string;
  pendingCount: number;
};

function initialOf(value: string, fallback = "•") {
  return value.trim().charAt(0).toUpperCase() || fallback;
}

export function Sidebar({ orgName, orgIndustry, userName, userRole, pendingCount }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const mobileNavRef = useRef<HTMLElement>(null);

  useFocusTrap(mobileOpen, mobileNavRef);

  useEffect(() => {
    if (!mobileOpen) return;

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeMobile();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
    };
  }, [mobileOpen]);

  function closeMobile() {
    setMobileOpen(false);
    menuButtonRef.current?.focus();
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initials = userName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const navigation = (onNavigate?: () => void) => (
    <nav className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        {NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-full px-3 py-2.5 text-[13.5px] font-semibold transition-colors",
                active
                  ? "bg-white/[0.08] text-white"
                  : "text-sidebar-text hover:bg-white/5 hover:text-white"
              )}
            >
              <Icon className="size-[15px] shrink-0" aria-hidden />
              <span className="flex-1">{item.label}</span>
              {item.href === "/approvals" && pendingCount > 0 && (
                <span className="rounded-full bg-brand px-[7px] py-px text-[11px] font-bold text-white">
                  {pendingCount}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {userRole === "admin" && (
        <div className="flex flex-col gap-0.5 border-t border-white/10 pt-3">
          <p className="px-3 pb-1 text-label text-sidebar-faint">Admin</p>
          {ADMIN_NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-full px-3 py-2.5 text-[13.5px] font-semibold transition-colors",
                  active
                    ? "bg-white/[0.08] text-white"
                    : "text-sidebar-text hover:bg-white/5 hover:text-white"
                )}
              >
                <Icon className="size-[15px] shrink-0" aria-hidden />
                <span className="flex-1">{item.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );

  const userSummary = (
    <div className="flex items-center gap-2.5 border-t border-white/10 px-2 pt-3">
      <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-bold text-white">
        {initials || "?"}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[13px] font-semibold text-white">{userName || "User"}</span>
        <span className="text-[11px] capitalize text-sidebar-faint">{userRole}</span>
      </div>
      <button
        type="button"
        onClick={signOut}
        title="Sign out"
        aria-label="Sign out"
        className="flex h-7 w-7 items-center justify-center rounded-[7px] text-sidebar-faint transition-colors hover:bg-white/10 hover:text-white"
      >
        <LogOut className="size-3.5" aria-hidden />
      </button>
    </div>
  );

  const workspaceCard = (
    <div className="flex items-center gap-2.5 rounded-[10px] border border-white/10 bg-white/5 px-3 py-2.5">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] bg-brand text-[11px] font-bold text-white">
        {initialOf(orgName, "W")}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-white">{orgName}</p>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-sidebar-faint">
          {userRole === "admin" ? "Admin workspace" : "Member workspace"}
        </p>
      </div>
    </div>
  );

  const logo = (
    <Link href="/dashboard" className="flex items-center gap-2.5" onClick={() => setMobileOpen(false)}>
      <span className="flex h-[26px] w-[26px] items-center justify-center rounded-[7px] bg-brand text-[15px] font-extrabold leading-none text-white">
        C
      </span>
      <span className="text-[18px] font-bold tracking-[-0.03em] text-white">contentgate</span>
    </Link>
  );

  return (
    <>
      <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-edge bg-surface px-4 md:hidden">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="flex h-[26px] w-[26px] items-center justify-center rounded-[7px] bg-brand text-[15px] font-extrabold leading-none text-white">
            C
          </span>
          <span className="text-[17px] font-bold tracking-[-0.03em] text-ink">contentgate</span>
        </Link>
        <button
          ref={menuButtonRef}
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
            onClick={closeMobile}
          />
          <aside
            ref={mobileNavRef}
            id="mobile-navigation"
            aria-label="Mobile navigation"
            className="relative flex h-full w-[min(320px,88vw)] flex-col gap-4 bg-brand-dark px-3.5 py-5 shadow-elevated"
          >
            <div className="flex items-center justify-between px-2 py-1">
              {logo}
              <button
                ref={closeButtonRef}
                type="button"
                onClick={closeMobile}
                aria-label="Close navigation"
                className="flex h-8 w-8 items-center justify-center rounded-[7px] text-sidebar-faint transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            {workspaceCard}

            <div className="min-h-0 flex-1 overflow-y-auto">{navigation(closeMobile)}</div>
            {userSummary}
          </aside>
        </div>
      )}

      <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col gap-4 bg-brand-dark px-3.5 py-5 md:flex">
        <div className="flex flex-col gap-1 px-2 py-1">
          {logo}
          {orgIndustry && (
            <span className="pl-[33px] text-[10px] uppercase tracking-[0.12em] text-sidebar-faint">
              {orgIndustry}
            </span>
          )}
        </div>

        {workspaceCard}

        <div className="min-h-0 flex-1 overflow-y-auto">{navigation()}</div>

        {userSummary}
      </aside>
    </>
  );
}
