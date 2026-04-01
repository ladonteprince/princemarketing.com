"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, Circle, X, Rocket } from "lucide-react";
import type { ContentNode } from "@/types/canvas";

const STORAGE_KEY = "pm-onboarding-dismissed";

type OnboardingChecklistProps = {
  nodes: ContentNode[];
};

type OnboardingStep = {
  id: string;
  label: string;
  href?: string;
  done: boolean;
};

export function OnboardingChecklist({ nodes }: OnboardingChecklistProps) {
  const [dismissed, setDismissed] = useState(true); // default hidden to avoid flash

  useEffect(() => {
    // Check localStorage on mount
    const stored = localStorage.getItem(STORAGE_KEY);
    setDismissed(stored === "true");
  }, []);

  const nodesCreated = nodes.length;

  // Build steps dynamically based on current state
  const steps: OnboardingStep[] = [
    {
      id: "connect",
      label: "Connect a social platform",
      href: "/dashboard/settings",
      done: false, // Would check platformsConnected > 0 from a real API
    },
    {
      id: "create",
      label: "Create your first content",
      done: nodesCreated > 0,
    },
    {
      id: "schedule",
      label: "Schedule a post",
      href: "/dashboard/calendar",
      done: false, // Would check postsScheduled > 0 from a real API
    },
    {
      id: "campaign",
      label: "Launch a campaign",
      href: "/dashboard/campaigns",
      done: false, // Would check campaignsCreated > 0 from a real API
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const allDone = completedCount === steps.length;

  // Auto-dismiss when all steps are done
  useEffect(() => {
    if (allDone && !dismissed) {
      localStorage.setItem(STORAGE_KEY, "true");
      setDismissed(true);
    }
  }, [allDone, dismissed]);

  if (dismissed) return null;

  function handleDismiss() {
    localStorage.setItem(STORAGE_KEY, "true");
    setDismissed(true);
  }

  return (
    <div className="fixed bottom-20 left-4 z-50 w-72 rounded-2xl border border-smoke bg-graphite/95 shadow-2xl shadow-black/30 backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-smoke/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <Rocket size={14} className="text-royal" />
          <span className="text-xs font-semibold text-cloud">Get started</span>
          <span className="rounded-full bg-royal/15 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-royal">
            {completedCount}/{steps.length}
          </span>
        </div>
        <button
          onClick={handleDismiss}
          className="flex h-6 w-6 items-center justify-center rounded-md text-ash hover:bg-slate hover:text-cloud transition-colors cursor-pointer"
          aria-label="Dismiss onboarding checklist"
        >
          <X size={12} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="mx-4 mt-3 h-1.5 overflow-hidden rounded-full bg-slate/80">
        <div
          className="h-full rounded-full bg-gradient-to-r from-royal to-violet-500 transition-all duration-500 ease-out"
          style={{ width: `${(completedCount / steps.length) * 100}%` }}
        />
      </div>

      {/* Steps */}
      <ul className="flex flex-col gap-0.5 px-4 py-3">
        {steps.map((step) => {
          const content = (
            <li
              key={step.id}
              className={`
                flex items-center gap-2.5 rounded-lg px-2 py-2 text-xs transition-colors duration-200
                ${step.done ? "text-ash line-through" : "text-cloud"}
                ${!step.done && step.href ? "hover:bg-slate/60 cursor-pointer" : ""}
              `}
            >
              {step.done ? (
                <CheckCircle2 size={14} className="shrink-0 text-emerald-400" />
              ) : (
                <Circle size={14} className="shrink-0 text-ash/40" />
              )}
              <span>{step.label}</span>
            </li>
          );

          if (!step.done && step.href) {
            return (
              <a key={step.id} href={step.href} className="no-underline">
                {content}
              </a>
            );
          }
          return content;
        })}
      </ul>
    </div>
  );
}
