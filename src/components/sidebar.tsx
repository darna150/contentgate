"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/products", label: "Products" },
  { href: "/content", label: "Content" },
  { href: "/approvals", label: "Approval Queue" },
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

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initials = userName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <aside className="sticky top-0 flex h-screen w-[248px] flex-shrink-0 flex-col gap-4 border-r border-edge bg-surface px-3.5 py-5">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-2 py-1">
        <div className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-brand-dark text-base font-bold text-white">
          +
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold">ContentGate</span>
          {orgIndustry && (
            <span className="text-[10px] uppercase tracking-[0.12em] text-ink-faint">
              {orgIndustry}
            </span>
          )}
        </div>
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
      <nav className="flex flex-col gap-0.5">
        {NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
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

      {/* User */}
      <div className="mt-auto flex items-center gap-2.5 border-t border-edge px-2 pt-3">
        <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-brand-dark text-[11px] font-bold text-white">
          {initials || "?"}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[13px] font-semibold">{userName}</span>
          <span className="text-[11px] capitalize text-ink-faint">{userRole}</span>
        </div>
        <button
          onClick={signOut}
          title="Sign out"
          className="flex h-7 w-7 items-center justify-center rounded-[7px] text-ink-faint transition-colors hover:bg-page hover:text-ink"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
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
    </aside>
  );
}
