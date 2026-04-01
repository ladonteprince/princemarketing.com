"use client";

import { useState, useEffect } from "react";
import {
  Eye,
  TrendingUp,
  CalendarCheck,
  BarChart3,
  Rocket,
  ArrowRight,
} from "lucide-react";

type KPIData = {
  totalImpressions: number;
  engagementRate: number;
  postsScheduled: number;
  postsPublished: number;
};

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

function isAllZero(data: KPIData): boolean {
  return (
    data.totalImpressions === 0 &&
    data.engagementRate === 0 &&
    data.postsScheduled === 0 &&
    data.postsPublished === 0
  );
}

export function KPIBar() {
  const [data, setData] = useState<KPIData | null>(null);

  useEffect(() => {
    async function fetchKPIs() {
      try {
        const res = await fetch("/api/dashboard");
        if (res.ok) {
          const d = await res.json();
          setData({
            totalImpressions: d.totalImpressions ?? 0,
            engagementRate:
              d.totalImpressions > 0
                ? (d.totalEngagement / d.totalImpressions) * 100
                : 0,
            postsScheduled: d.postsThisWeek ?? 0,
            postsPublished: d.postsPublished ?? 0,
          });
        }
      } catch {
        // Silent fail
      }
    }
    fetchKPIs();
  }, []);

  const items = [
    {
      label: "Impressions",
      value: data ? formatNumber(data.totalImpressions) : "--",
      icon: Eye,
    },
    {
      label: "Engagement",
      value: data ? `${data.engagementRate.toFixed(1)}%` : "--",
      icon: TrendingUp,
    },
    {
      label: "Scheduled",
      value: data ? String(data.postsScheduled) : "--",
      icon: CalendarCheck,
    },
    {
      label: "Published",
      value: data ? String(data.postsPublished) : "--",
      icon: BarChart3,
    },
  ];

  // Onboarding state when all values are zero
  if (data && isAllZero(data)) {
    return (
      <div className="relative overflow-hidden border-b border-smoke bg-gradient-to-r from-graphite via-graphite/95 to-royal/[0.04] backdrop-blur-sm px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-royal-muted border border-royal/15">
            <Rocket size={16} strokeWidth={1.5} className="text-royal" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-cloud/90">
              Getting started
            </p>
            <p className="text-[11px] text-ash leading-snug">
              Create your first post to see metrics here
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-royal/70">
            <span>Chat to begin</span>
            <ArrowRight size={12} strokeWidth={1.5} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden border-b border-smoke bg-gradient-to-r from-graphite via-graphite/95 to-graphite/90 backdrop-blur-sm px-4 py-3 sm:px-5">
      <div className="flex items-center gap-5 overflow-x-auto sm:gap-8">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="group flex shrink-0 items-center gap-3 transition-opacity duration-200 hover:opacity-100 opacity-90"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate/50 border border-smoke/50 transition-colors duration-200 group-hover:border-royal/20 group-hover:bg-royal-muted">
                <Icon size={14} strokeWidth={1.5} className="text-ash transition-colors duration-200 group-hover:text-royal" />
              </div>
              <div className="flex flex-col">
                <span className="font-mono text-lg font-bold leading-tight text-cloud tracking-tight">
                  {item.value}
                </span>
                <span className="text-[10px] text-ash/70 uppercase tracking-wider leading-tight">
                  {item.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
