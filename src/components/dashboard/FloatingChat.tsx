"use client";

import { useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { MessageSquare, X } from "lucide-react";
import { ChatPanel } from "./ChatPanel";
import type { ContentNode, CanvasAction } from "@/types/canvas";

// WHY: FloatingChat makes the AI Strategist accessible from ALL dashboard pages,
// not just the Workspace. On Workspace (/dashboard), the chat is inline, so this
// component hides itself there. On every other page, it renders a floating button
// in the bottom-right corner that slides out the ChatPanel.

export function FloatingChat() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [nodes, setNodes] = useState<ContentNode[]>([]);

  // Don't render on the workspace page — chat is already built into the layout there
  if (pathname === "/dashboard") return null;

  const handleCanvasAction = (action: CanvasAction) => {
    // In floating mode, we track nodes locally for the chat panel's reference
    // but they won't appear on a canvas since we're not on the workspace page
    switch (action.type) {
      case "add-node":
        setNodes((prev) => [...prev, action.node]);
        break;
      case "remove-node":
        setNodes((prev) => prev.filter((n) => n.id !== action.nodeId));
        break;
      case "update-node":
        setNodes((prev) =>
          prev.map((n) =>
            n.id === action.nodeId ? { ...n, ...action.updates } : n,
          ),
        );
        break;
    }
  };

  return (
    <>
      {/* Slide-over backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-void/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Slide-over chat panel */}
      <div
        className={`
          fixed top-0 right-0 z-50 h-full w-[400px] max-w-[90vw]
          transform transition-transform duration-300 ease-in-out
          ${open ? "translate-x-0" : "translate-x-full"}
        `}
      >
        <ChatPanel
          collapsed={false}
          onToggle={() => setOpen(false)}
          onCanvasAction={handleCanvasAction}
          nodes={nodes}
        />
      </div>

      {/* Floating toggle button — bottom right */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="
            fixed bottom-6 right-6 z-40
            flex h-14 w-14 items-center justify-center
            rounded-full bg-royal text-white shadow-lg
            hover:bg-royal-hover hover:shadow-xl
            transition-all duration-200 cursor-pointer
            group
          "
          aria-label="Open AI Strategist"
        >
          <MessageSquare size={22} strokeWidth={1.5} className="group-hover:scale-110 transition-transform" />
        </button>
      )}
    </>
  );
}
