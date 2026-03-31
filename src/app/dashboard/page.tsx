"use client";

import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  TrendingUp,
  Eye,
  MousePointerClick,
  CalendarCheck,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// WHY: Mock data to demonstrate the dashboard. In production, fetched from API.
type MetricData = {
  label: string;
  value: string;
  change: number;
  icon: LucideIcon;
};

const METRICS: ReadonlyArray<MetricData> = [
  { label: "Total impressions", value: "24.8K", change: 12.3, icon: Eye },
  { label: "Engagement rate", value: "4.2%", change: 0.8, icon: TrendingUp },
  { label: "Link clicks", value: "1,847", change: -2.1, icon: MousePointerClick },
  { label: "Posts this week", value: "12", change: 3, icon: CalendarCheck },
];

type UpcomingPost = {
  id: string;
  title: string;
  platform: string;
  time: string;
  status: "scheduled" | "draft";
};

const UPCOMING_POSTS: ReadonlyArray<UpcomingPost> = [
  {
    id: "1",
    title: "5 plumbing tips every homeowner needs",
    platform: "Instagram",
    time: "Today, 9:00 AM",
    status: "scheduled",
  },
  {
    id: "2",
    title: "Before/after: Kitchen sink replacement",
    platform: "Facebook",
    time: "Today, 12:30 PM",
    status: "scheduled",
  },
  {
    id: "3",
    title: "Why regular maintenance saves you thousands",
    platform: "LinkedIn",
    time: "Tomorrow, 8:00 AM",
    status: "draft",
  },
  {
    id: "4",
    title: "Emergency plumbing checklist for winter",
    platform: "Twitter",
    time: "Tomorrow, 10:00 AM",
    status: "draft",
  },
];

const RECENT_ACTIVITY = [
  { text: "I scheduled 5 posts for this week", time: "2h ago" },
  { text: "Instagram post published: 'Customer spotlight'", time: "5h ago" },
  { text: "New campaign created: 'Spring Promotion'", time: "1d ago" },
  { text: "I updated your content strategy based on last week's results", time: "2d ago" },
];

export default function DashboardPage() {
  return (
    <div className="flex flex-col">
      <Header
        title="Good morning, Marcus"
        subtitle="Here is what is happening with your marketing"
      />

      <div className="flex-1 px-6 py-6">
        {/* Metrics grid */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {METRICS.map((metric) => {
            const Icon = metric.icon;
            const isPositive = metric.change >= 0;

            return (
              <Card key={metric.label} padding="md">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm text-ash">{metric.label}</span>
                  <Icon size={16} strokeWidth={1.5} className="text-ash" />
                </div>
                <div className="flex items-end justify-between">
                  <span className="font-mono text-2xl font-bold text-cloud">
                    {metric.value}
                  </span>
                  <span
                    className={`flex items-center gap-0.5 text-xs font-medium ${
                      isPositive ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {isPositive ? (
                      <ArrowUpRight size={14} strokeWidth={1.5} />
                    ) : (
                      <ArrowDownRight size={14} strokeWidth={1.5} />
                    )}
                    {Math.abs(metric.change)}%
                  </span>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          {/* Upcoming content — left 3 columns */}
          <div className="lg:col-span-3">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-cloud">
                Upcoming content
              </h2>
              <a
                href="/dashboard/calendar"
                className="text-sm text-royal transition-colors hover:text-royal-hover"
              >
                View calendar
              </a>
            </div>

            <div className="flex flex-col gap-3">
              {UPCOMING_POSTS.map((post) => (
                <Card key={post.id} padding="sm" hover>
                  <div className="flex items-center justify-between gap-4 px-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-cloud">
                        {post.title}
                      </p>
                      <p className="text-xs text-ash">
                        {post.platform} &middot; {post.time}
                      </p>
                    </div>
                    <Badge
                      variant={
                        post.status === "scheduled" ? "royal" : "default"
                      }
                    >
                      {post.status === "scheduled" ? "Scheduled" : "Draft"}
                    </Badge>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Activity feed — right 2 columns */}
          <div className="lg:col-span-2">
            <h2 className="mb-4 text-base font-semibold text-cloud">
              Recent activity
            </h2>

            <Card padding="none">
              <ul className="divide-y divide-smoke">
                {RECENT_ACTIVITY.map((activity, i) => (
                  <li key={i} className="px-4 py-3">
                    <p className="text-sm text-cloud">{activity.text}</p>
                    <p className="mt-0.5 text-xs text-ash">{activity.time}</p>
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
