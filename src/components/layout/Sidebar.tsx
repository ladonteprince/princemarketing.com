"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Calendar,
  Megaphone,
  BarChart3,
  Film,
  FolderOpen,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  X,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

// WHY: Sidebar order reflects the production SOP — brief → plan → produce → manage
// → schedule → publish → measure. Workspace is where the user briefs / chats with
// the strategist. Storyboard is the cheap-keyframe approval gate before video gen.
// Video Editor is where scenes get refined. Assets is the reference library.
// Calendar / Campaigns / Analytics tail the workflow as distribution + measurement.
const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { label: "Workspace", href: "/dashboard", icon: LayoutDashboard },
  { label: "Storyboard", href: "/dashboard/storyboard", icon: Sparkles },
  { label: "Video Editor", href: "/dashboard/video/new", icon: Film },
  { label: "Assets", href: "/dashboard/assets", icon: FolderOpen },
  { label: "Calendar", href: "/dashboard/calendar", icon: Calendar },
  { label: "Campaigns", href: "/dashboard/campaigns", icon: Megaphone },
  { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
] as const;

const BOTTOM_ITEMS: ReadonlyArray<NavItem> = [
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
] as const;

type SidebarProps = {
  onCloseMobile?: () => void;
};

export function Sidebar({ onCloseMobile }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <aside
      className={`
        fixed top-0 left-0 z-30 flex h-screen flex-col
        border-r border-smoke bg-graphite
        transition-[width] duration-[var(--transition-page)]
        ${collapsed ? "w-[var(--sidebar-collapsed)]" : "w-[var(--sidebar-width)]"}
      `}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-4">
        {!collapsed && (
          <Link href="/" className="flex items-center gap-2">
            <img
              src="/logos/pm-icon.svg"
              alt="PrinceMarketing"
              className="h-8 w-8"
            />
            <span className="text-sm font-semibold text-cloud">
              PrinceMarketing
            </span>
          </Link>
        )}
        {collapsed && (
          <Link href="/" className="mx-auto">
            <img
              src="/logos/pm-icon.svg"
              alt="P."
              className="h-8 w-8"
            />
          </Link>
        )}
        {/* Mobile close button */}
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="
              flex h-11 w-11 items-center justify-center rounded-lg
              text-ash hover:text-cloud hover:bg-slate
              transition-colors duration-[var(--transition-micro)]
              cursor-pointer md:hidden
            "
            aria-label="Close sidebar"
          >
            <X size={20} strokeWidth={1.5} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2">
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <li key={item.href} className="relative group">
                <Link
                  href={item.href}
                  onClick={() => onCloseMobile?.()}
                  className={`
                    flex items-center gap-3 rounded-lg px-3 py-2.5
                    text-sm font-medium
                    transition-colors duration-[var(--transition-micro)]
                    ${
                      isActive
                        ? "bg-royal-muted text-royal"
                        : "text-ash hover:text-cloud hover:bg-slate"
                    }
                    ${collapsed ? "justify-center px-0" : ""}
                  `}
                >
                  <Icon size={18} strokeWidth={1.5} className="shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
                {/* Tooltip on hover when collapsed */}
                {collapsed && (
                  <div className="
                    pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2
                    whitespace-nowrap rounded-md bg-void px-2.5 py-1.5
                    text-xs font-medium text-cloud shadow-lg
                    opacity-0 group-hover:opacity-100
                    transition-opacity duration-150
                    z-50
                  ">
                    {item.label}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Bottom section */}
      <div className="border-t border-smoke px-3 py-3">
        <ul className="flex flex-col gap-1">
          {BOTTOM_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <li key={item.href} className="relative group">
                <Link
                  href={item.href}
                  onClick={() => onCloseMobile?.()}
                  className={`
                    flex items-center gap-3 rounded-lg px-3 py-2.5
                    text-sm font-medium
                    transition-colors duration-[var(--transition-micro)]
                    ${
                      isActive
                        ? "bg-royal-muted text-royal"
                        : "text-ash hover:text-cloud hover:bg-slate"
                    }
                    ${collapsed ? "justify-center px-0" : ""}
                  `}
                >
                  <Icon size={18} strokeWidth={1.5} className="shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
                {collapsed && (
                  <div className="
                    pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2
                    whitespace-nowrap rounded-md bg-void px-2.5 py-1.5
                    text-xs font-medium text-cloud shadow-lg
                    opacity-0 group-hover:opacity-100
                    transition-opacity duration-150
                    z-50
                  ">
                    {item.label}
                  </div>
                )}
              </li>
            );
          })}

          {/* Logout */}
          <li className="relative group">
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className={`
                flex w-full items-center gap-3 rounded-lg px-3 py-2.5
                text-sm font-medium text-ash
                transition-colors duration-[var(--transition-micro)]
                hover:text-cloud hover:bg-slate cursor-pointer
                ${collapsed ? "justify-center px-0" : ""}
              `}
            >
              <LogOut size={18} strokeWidth={1.5} className="shrink-0" />
              {!collapsed && <span>Sign out</span>}
            </button>
            {collapsed && (
              <div className="
                pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2
                whitespace-nowrap rounded-md bg-void px-2.5 py-1.5
                text-xs font-medium text-cloud shadow-lg
                opacity-0 group-hover:opacity-100
                transition-opacity duration-150
                z-50
              ">
                Sign out
              </div>
            )}
          </li>
        </ul>

        {/* Collapse toggle — clean chevron icon button */}
        <button
          onClick={() => setCollapsed((prev) => !prev)}
          className="
            mt-3 flex h-8 w-full items-center justify-center rounded-lg
            border border-smoke/50
            text-ash hover:text-cloud hover:bg-slate hover:border-smoke
            transition-all duration-[var(--transition-micro)]
            cursor-pointer
          "
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight size={14} strokeWidth={2} />
          ) : (
            <ChevronLeft size={14} strokeWidth={2} />
          )}
        </button>
      </div>
    </aside>
  );
}
