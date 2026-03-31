"use client";

import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import {
  Eye,
  TrendingUp,
  MousePointerClick,
  Share2,
  MessageCircle,
  ArrowUpRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type MetricCard = {
  label: string;
  value: string;
  change: string;
  icon: LucideIcon;
};

const OVERVIEW_METRICS: ReadonlyArray<MetricCard> = [
  { label: "Impressions", value: "124.5K", change: "+18.3%", icon: Eye },
  { label: "Engagement rate", value: "4.2%", change: "+0.8%", icon: TrendingUp },
  { label: "Link clicks", value: "8,294", change: "+12.1%", icon: MousePointerClick },
  { label: "Shares", value: "1,847", change: "+24.6%", icon: Share2 },
  { label: "Comments", value: "3,421", change: "+9.2%", icon: MessageCircle },
];

type TopPost = {
  title: string;
  platform: string;
  impressions: string;
  engagement: string;
};

const TOP_POSTS: ReadonlyArray<TopPost> = [
  {
    title: "5 plumbing tips every homeowner needs",
    platform: "Instagram",
    impressions: "12.4K",
    engagement: "6.2%",
  },
  {
    title: "Before/after: Kitchen sink replacement",
    platform: "Facebook",
    impressions: "8.7K",
    engagement: "5.1%",
  },
  {
    title: "Why regular maintenance saves thousands",
    platform: "LinkedIn",
    impressions: "6.2K",
    engagement: "4.8%",
  },
  {
    title: "Customer spotlight: The Johnsons",
    platform: "Instagram",
    impressions: "5.9K",
    engagement: "7.3%",
  },
  {
    title: "Emergency winter checklist",
    platform: "Twitter",
    impressions: "4.1K",
    engagement: "3.9%",
  },
];

// WHY: Simple bar representation using inline styles for the analytics chart
// A full charting library would be added in production
type WeekData = { label: string; value: number };

const WEEKLY_DATA: ReadonlyArray<WeekData> = [
  { label: "Mon", value: 65 },
  { label: "Tue", value: 82 },
  { label: "Wed", value: 71 },
  { label: "Thu", value: 94 },
  { label: "Fri", value: 88 },
  { label: "Sat", value: 45 },
  { label: "Sun", value: 38 },
];

export default function AnalyticsPage() {
  const maxValue = Math.max(...WEEKLY_DATA.map((d) => d.value));

  return (
    <div className="flex flex-col">
      <Header
        title="Analytics"
        subtitle="Track what is working and optimize your strategy"
      />

      <div className="flex-1 px-6 py-6">
        {/* Overview metrics */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {OVERVIEW_METRICS.map((metric) => {
            const Icon = metric.icon;
            return (
              <Card key={metric.label} padding="md">
                <div className="mb-2 flex items-center justify-between">
                  <Icon size={16} strokeWidth={1.5} className="text-ash" />
                  <span className="flex items-center gap-0.5 text-xs font-medium text-emerald-400">
                    <ArrowUpRight size={12} strokeWidth={1.5} />
                    {metric.change}
                  </span>
                </div>
                <div className="font-mono text-xl font-bold text-cloud">
                  {metric.value}
                </div>
                <div className="text-xs text-ash">{metric.label}</div>
              </Card>
            );
          })}
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          {/* Weekly engagement chart — left 3 cols */}
          <div className="lg:col-span-3">
            <Card padding="md">
              <h3 className="mb-6 text-sm font-semibold text-cloud">
                Weekly engagement
              </h3>
              <div className="flex items-end justify-between gap-2" style={{ height: 180 }}>
                {WEEKLY_DATA.map((day) => {
                  const height = (day.value / maxValue) * 100;
                  return (
                    <div
                      key={day.label}
                      className="flex flex-1 flex-col items-center gap-2"
                    >
                      <span className="font-mono text-[10px] text-ash">
                        {day.value}
                      </span>
                      <div
                        className="w-full rounded-t-md bg-royal/60 transition-all hover:bg-royal"
                        style={{ height: `${height}%` }}
                      />
                      <span className="text-[10px] text-ash">{day.label}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* Top posts — right 2 cols */}
          <div className="lg:col-span-2">
            <Card padding="none">
              <div className="border-b border-smoke px-4 py-3">
                <h3 className="text-sm font-semibold text-cloud">
                  Top performing posts
                </h3>
              </div>
              <ul className="divide-y divide-smoke">
                {TOP_POSTS.map((post, i) => (
                  <li key={i} className="px-4 py-3">
                    <p className="mb-1 truncate text-sm text-cloud">
                      {post.title}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-ash">
                      <span>{post.platform}</span>
                      <span className="font-mono">{post.impressions} views</span>
                      <span className="font-mono text-royal">
                        {post.engagement} eng.
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
