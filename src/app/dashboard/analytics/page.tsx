"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import {
  Eye,
  TrendingUp,
  MousePointerClick,
  Share2,
  MessageCircle,
  BarChart3,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type AnalyticsSummary = {
  totalImpressions: number;
  totalEngagement: number;
  totalClicks: number;
  totalShares: number;
  totalComments: number;
  postsPublished: number;
  topPosts: {
    id: string;
    title: string;
    platform: string;
    impressions: number;
    engagement: number;
  }[];
};

type MetricDisplay = {
  label: string;
  value: string;
  icon: LucideIcon;
};

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsSummary | null>(null);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const res = await fetch("/api/analytics");
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (err) {
        console.error("Failed to fetch analytics:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, []);

  const metrics: MetricDisplay[] = data
    ? [
        { label: "Impressions", value: formatNumber(data.totalImpressions), icon: Eye },
        {
          label: "Engagement rate",
          value: data.totalImpressions > 0
            ? `${((data.totalEngagement / data.totalImpressions) * 100).toFixed(1)}%`
            : "0%",
          icon: TrendingUp,
        },
        { label: "Link clicks", value: formatNumber(data.totalClicks), icon: MousePointerClick },
        { label: "Shares", value: formatNumber(data.totalShares), icon: Share2 },
        { label: "Comments", value: formatNumber(data.totalComments), icon: MessageCircle },
      ]
    : [];

  return (
    <div className="flex flex-col">
      <Header
        title="Analytics"
        subtitle="Track what is working and optimize your strategy"
      />

      <div className="flex-1 px-6 py-6">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} padding="md">
                <div className="h-16 animate-pulse rounded bg-slate" />
              </Card>
            ))}
          </div>
        ) : !data || data.totalImpressions === 0 ? (
          // No data state — honest, not fake
          <div className="flex flex-col items-center justify-center py-20">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-royal-muted">
              <BarChart3 size={32} strokeWidth={1.5} className="text-royal" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-cloud">
              No analytics data yet
            </h3>
            <p className="max-w-md text-center text-sm text-ash">
              Analytics will appear here once you start publishing content.
              Connect your platforms in Settings, then publish posts from your Content Calendar.
            </p>
          </div>
        ) : (
          <>
            {/* Overview metrics */}
            <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {metrics.map((metric) => {
                const Icon = metric.icon;
                return (
                  <Card key={metric.label} padding="md">
                    <div className="mb-2 flex items-center justify-between">
                      <Icon size={16} strokeWidth={1.5} className="text-ash" />
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
              {/* Posts published count */}
              <div className="lg:col-span-3">
                <Card padding="md">
                  <h3 className="mb-4 text-sm font-semibold text-cloud">
                    Posts published
                  </h3>
                  <div className="font-mono text-3xl font-bold text-cloud">
                    {data.postsPublished}
                  </div>
                  <p className="mt-1 text-xs text-ash">Total published content pieces</p>
                </Card>
              </div>

              {/* Top posts */}
              <div className="lg:col-span-2">
                <Card padding="none">
                  <div className="border-b border-smoke px-4 py-3">
                    <h3 className="text-sm font-semibold text-cloud">
                      Top performing posts
                    </h3>
                  </div>
                  {data.topPosts.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-ash">
                      No published posts with analytics yet.
                    </div>
                  ) : (
                    <ul className="divide-y divide-smoke">
                      {data.topPosts.map((post) => (
                        <li key={post.id} className="px-4 py-3">
                          <p className="mb-1 truncate text-sm text-cloud">
                            {post.title}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-ash">
                            <span>{post.platform}</span>
                            <span className="font-mono">{formatNumber(post.impressions)} views</span>
                            <span className="font-mono text-royal">
                              {post.impressions > 0
                                ? `${((post.engagement / post.impressions) * 100).toFixed(1)}%`
                                : "0%"}{" "}
                              eng.
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
