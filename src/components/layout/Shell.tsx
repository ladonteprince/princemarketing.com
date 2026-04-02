"use client";

import { useState, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";

import { Menu } from "lucide-react";

type ShellProps = {
  children: ReactNode;
};

// WHY: Shell provides the sidebar + main content area layout for the dashboard.
export function Shell({ children }: ShellProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-void/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar: hidden on mobile unless toggled, always visible on md+ */}
      <div
        className={`
          fixed inset-y-0 left-0 z-50 transition-transform duration-[var(--transition-page)] md:translate-x-0
          ${mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <Sidebar onCloseMobile={() => setMobileSidebarOpen(false)} />
      </div>

      {/* Main content area: no left margin on mobile, sidebar offset on md+ */}
      <main className="min-w-0 flex-1 md:ml-[var(--sidebar-width)] transition-[margin] duration-[var(--transition-page)]">
        {/* Mobile top bar with hamburger */}
        <div className="flex h-14 items-center border-b border-smoke px-4 md:hidden">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="
              flex h-11 w-11 items-center justify-center rounded-lg
              text-ash hover:text-cloud hover:bg-slate
              transition-colors duration-[var(--transition-micro)]
              cursor-pointer
            "
            aria-label="Open sidebar"
          >
            <Menu size={22} strokeWidth={1.5} />
          </button>
          <div className="ml-3 flex items-center gap-2">
            <img
              src="/logos/pm-icon.svg"
              alt="PrinceMarketing"
              className="h-6 w-6"
            />
            <span className="text-sm font-semibold text-cloud">
              PrinceMarketing
            </span>
          </div>
        </div>
        {children}
      </main>

      {/* Chat is available via the Workspace page (/dashboard) — no floating widget needed */}
    </div>
  );
}
