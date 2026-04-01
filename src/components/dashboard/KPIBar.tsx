"use client";

import { useState, useEffect } from "react";
import { Eye, TrendingUp, CalendarCheck, BarChart3 } from "lucide-react";

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

  return (
    <div className="flex items-center gap-4 overflow-x-auto border-b border-smoke bg-graphite/80 backdrop-blur-sm px-4 py-2.5 sm:gap-6 sm:px-5">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.label} className="flex shrink-0 items-center gap-2">
            <Icon size={14} strokeWidth={1.5} className="text-ash" />
            <span className="font-mono text-sm font-semibold text-cloud">
              {item.value}
            </span>
            <span className="text-[10px] text-ash">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}
