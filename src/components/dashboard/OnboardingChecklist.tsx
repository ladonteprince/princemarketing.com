"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, Circle, X, Rocket, ChevronUp, ChevronDown } from "lucide-react";
import Link from "next/link";
import type { ContentNode } from "@/types/canvas";

const STORAGE_KEY = "pm-onboarding-dismissed";
const COLLAPSE_KEY = "pm-onboarding-collapsed";

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
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const wasDismissed = localStorage.getItem(STORAGE_KEY);
    const wasCollapsed = localStorage.getItem(COLLAPSE_KEY);
    setDismissed(wasDismissed === "true");
    setCollapsed(wasCollapsed === "true");
  }, []);

  const nodesCreated = nodes.length;

  const steps: OnboardingStep[] = [
    {
      id: "connect",
      label: "Connect a social platform",
      href: "/dashboard/settings",
      done: false, // Real check would use API
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
      done: false,
    },
    {
      id: "campaign",
      label: "Launch a campaign",
      href: "/dashboard/campaigns",
      done: false,
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const allDone = completedCount === steps.length;
  const progress = Math.round((completedCount / steps.length) * 100);

  // Auto-dismiss only when ALL steps are done
  useEffect(() => {
    if (allDone && !dismissed) {
      localStorage.setItem(STORAGE_KEY, "true");
      setDismissed(true);
    }
  }, [allDone, dismissed]);

  function handleDismiss() {
    localStorage.setItem(STORAGE_KEY, "true");
    setDismissed(true);
  }

  function handleToggleCollapse() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(COLLAPSE_KEY, String(next));
  }

  // Show a small "Getting Started" pill when dismissed (so user can re-open)
  if (dismissed) {
    return (
      <button
        onClick={() => {
          localStorage.removeItem(STORAGE_KEY);
          setDismissed(false);
          setCollapsed(false);
        }}
        className="
          hidden md:flex
          fixed bottom-20 left-4 z-40
          items-center gap-2 rounded-full
          bg-royal/20 border border-royal/30
          px-3 py-1.5 text-xs text-royal
          hover:bg-royal/30 hover:border-royal/50
          transition-all duration-200 cursor-pointer
          shadow-lg shadow-royal/10
        "
      >
        <Rocket size={12} />
        <span>Getting Started</span>
      </button>
    );
  }

  return (
    <div className="
      hidden md:block
      fixed bottom-20 left-4 z-50
      w-72 rounded-xl border border-smoke
      bg-graphite/95 backdrop-blur-md
      shadow-xl shadow-void/50
      overflow-hidden
      transition-all duration-300
    ">
      {/* Header — always visible, clickable to collapse */}
      <button
        onClick={handleToggleCollapse}
        className="
          flex w-full items-center justify-between
          px-4 py-3 cursor-pointer
          hover:bg-slate/30 transition-colors
        "
      >
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-royal/20">
            <Rocket size={14} className="text-royal" />
          </div>
          <div className="text-left">
            <h4 className="text-xs font-semibold text-cloud">Getting Started</h4>
            <p className="text-[10px] text-ash">{completedCount}/{steps.length} complete</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {collapsed ? (
            <ChevronUp size={14} className="text-ash" />
          ) : (
            <ChevronDown size={14} className="text-ash" />
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDismiss();
            }}
            className="text-ash hover:text-cloud transition-colors p-0.5"
            title="Dismiss checklist"
          >
            <X size={12} />
          </button>
        </div>
      </button>

      {/* Progress bar */}
      <div className="mx-4 h-1 rounded-full bg-slate/60 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-royal to-emerald-400 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Steps — collapsible */}
      {!collapsed && (
        <div className="px-4 py-3 flex flex-col gap-2">
          {steps.map((step) => {
            const content = (
              <div
                className={`
                  flex items-center gap-2.5 rounded-lg px-2.5 py-2
                  text-xs transition-all duration-200
                  ${step.done
                    ? "text-emerald-400"
                    : step.href
                      ? "text-ash hover:text-cloud hover:bg-slate/50 cursor-pointer"
                      : "text-ash"
                  }
                `}
              >
                {step.done ? (
                  <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                ) : (
                  <Circle size={14} className="text-ash/40 shrink-0" />
                )}
                <span className={step.done ? "line-through opacity-60" : ""}>{step.label}</span>
              </div>
            );

            if (step.href && !step.done) {
              return (
                <Link key={step.id} href={step.href}>
                  {content}
                </Link>
              );
            }

            return <div key={step.id}>{content}</div>;
          })}
        </div>
      )}
    </div>
  );
}
