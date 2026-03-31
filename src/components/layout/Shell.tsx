"use client";

import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";

type ShellProps = {
  children: ReactNode;
};

// WHY: Shell provides the sidebar + main content area layout for the dashboard
export function Shell({ children }: ShellProps) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      {/* Main content area offset by sidebar width */}
      <main className="ml-[var(--sidebar-width)] flex-1 transition-[margin] duration-[var(--transition-page)]">
        {children}
      </main>
    </div>
  );
}
