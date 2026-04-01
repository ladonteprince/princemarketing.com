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
  MessageSquare,
  Film,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { label: "Workspace", href: "/dashboard", icon: LayoutDashboard },
  { label: "Calendar", href: "/dashboard/calendar", icon: Calendar },
  { label: "Campaigns", href: "/dashboard/campaigns", icon: Megaphone },
  { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { label: "Video Editor", href: "/dashboard/video/new", icon: Film },
  { label: "AI Strategist", href: "/dashboard/chat", icon: MessageSquare },
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
              alt="PrinceMarketing"
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
              <li key={item.href}>
                <Link
                  href={item.href}
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
                  title={collapsed ? item.label : undefined}
                >
                  <Icon size={18} strokeWidth={1.5} className="shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
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
              <li key={item.href}>
                <Link
                  href={item.href}
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
                  title={collapsed ? item.label : undefined}
                >
                  <Icon size={18} strokeWidth={1.5} className="shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              </li>
            );
          })}

          {/* Logout */}
          <li>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className={`
                flex w-full items-center gap-3 rounded-lg px-3 py-2.5
                text-sm font-medium text-ash
                transition-colors duration-[var(--transition-micro)]
                hover:text-cloud hover:bg-slate cursor-pointer
                ${collapsed ? "justify-center px-0" : ""}
              `}
              title={collapsed ? "Sign out" : undefined}
            >
              <LogOut size={18} strokeWidth={1.5} className="shrink-0" />
              {!collapsed && <span>Sign out</span>}
            </button>
          </li>
        </ul>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed((prev) => !prev)}
          className={`
            mt-2 flex w-full items-center justify-center rounded-lg py-2
            text-ash hover:text-cloud hover:bg-slate
            transition-colors duration-[var(--transition-micro)]
            cursor-pointer
          `}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight size={16} strokeWidth={1.5} />
          ) : (
            <ChevronLeft size={16} strokeWidth={1.5} />
          )}
        </button>
      </div>
    </aside>
  );
}
