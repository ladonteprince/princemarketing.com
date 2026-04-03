"use client";

import { useState, useCallback, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { ChatPanel } from "@/components/dashboard/ChatPanel";
import { ErrorBoundary } from "@/components/ErrorBoundary";

import { Menu, MessageSquare } from "lucide-react";
import type { CanvasAction, ContentNode } from "@/types/canvas";

type ShellProps = {
  children: ReactNode;
};

// WHY: Shell provides the sidebar + main content area + global chat panel for the dashboard.
export function Shell({ children }: ShellProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const pathname = usePathname();

  // On the Workspace page, ChatPanel is rendered inline (not in Shell)
  const isWorkspace = pathname === "/dashboard";

  // Stub handler — the global chat doesn't control the canvas (only Workspace does)
  const handleCanvasAction = useCallback((action: CanvasAction) => {
    // For non-workspace pages, canvas actions are no-ops
    // The chat can still generate content, schedule posts, get analytics, etc.
  }, []);

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-void/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar: always visible on md+, toggle on mobile */}
      <div className="hidden md:block fixed inset-y-0 left-0 z-50">
        <Sidebar />
      </div>
      {mobileSidebarOpen && (
        <div className="fixed inset-y-0 left-0 z-50 md:hidden">
          <Sidebar onCloseMobile={() => setMobileSidebarOpen(false)} />
        </div>
      )}

      {/* Main content area */}
      <main className="min-w-0 flex-1 flex flex-col md:ml-[var(--sidebar-width)] transition-[margin] duration-[var(--transition-page)]">
        {/* Mobile top bar with hamburger + chat button */}
        <div className="flex h-14 items-center justify-between border-b border-smoke px-4 md:hidden">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="
                flex h-10 w-10 items-center justify-center rounded-lg
                text-ash hover:text-cloud hover:bg-slate
                transition-colors duration-[var(--transition-micro)]
                cursor-pointer
              "
              aria-label="Open sidebar"
            >
              <Menu size={22} strokeWidth={1.5} />
            </button>
            <img
              src="/logos/pm-icon.svg"
              alt="PrinceMarketing"
              className="h-6 w-6"
            />
            <span className="text-sm font-semibold text-cloud">
              PrinceMarketing
            </span>
          </div>
          {/* Chat button on right */}
          {!isWorkspace && (
            <button
              onClick={() => setChatOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-royal hover:bg-royal/10 transition-colors cursor-pointer"
            >
              <MessageSquare size={20} strokeWidth={1.5} />
            </button>
          )}
        </div>
        <div className="flex-1 min-h-0">
          {children}
        </div>
      </main>

      {/* Global Chat Panel — collapsible right panel on desktop, full-screen overlay on mobile */}
      {!isWorkspace && (
        <>
          {/* Desktop: docked right panel */}
          <div
            className={`
              hidden lg:block shrink-0 transition-[width] duration-300 ease-in-out
              ${chatOpen ? "w-[30%] min-w-[320px] max-w-[480px]" : "w-12"}
            `}
          >
            <ErrorBoundary>
              <ChatPanel
                collapsed={!chatOpen}
                onToggle={() => setChatOpen((prev) => !prev)}
                onCanvasAction={handleCanvasAction}
                nodes={[]}
              />
            </ErrorBoundary>
          </div>

          {/* Mobile: full-screen chat overlay (no floating button) */}
          <div className="lg:hidden">
            {chatOpen && (
              <div className="fixed inset-0 z-50 bg-graphite">
                <ErrorBoundary>
                  <ChatPanel
                    collapsed={false}
                    onToggle={() => setChatOpen(false)}
                    onCanvasAction={handleCanvasAction}
                    nodes={[]}
                  />
                </ErrorBoundary>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
