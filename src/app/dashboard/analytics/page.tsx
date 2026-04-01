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
  Cable,
  ArrowRight,
  Sparkles,
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

      <div className="flex-1 px-6 py-8">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} padding="md">
                <div className="mb-3 h-9 w-9 animate-pulse rounded-xl bg-slate/60" />
                <div className="h-7 w-16 animate-pulse rounded-md bg-slate/50 mb-1.5" />
                <div className="h-3 w-20 animate-pulse rounded bg-slate/40" />
              </Card>
            ))}
          </div>
        ) : !data || data.totalImpressions === 0 ? (
          // No data state — beautiful and inviting
          <div className="flex flex-col items-center justify-center py-24">
            {/* Icon cluster */}
            <div className="relative mb-8">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-royal/15 to-violet-600/10 border border-royal/15 shadow-lg shadow-royal/5">
                <BarChart3 size={36} strokeWidth={1.2} className="text-royal" />
              </div>
              <div className="absolute -top-2 -right-2 flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/15">
                <TrendingUp size={14} strokeWidth={1.5} className="text-emerald-400/60" />
              </div>
              <div className="absolute -bottom-1 -left-3 flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/15">
                <Sparkles size={12} strokeWidth={1.5} className="text-amber-400/50" />
              </div>
            </div>

            <h3 className="mb-2 text-lg font-semibold text-cloud">
              No analytics data yet
            </h3>
            <p className="max-w-sm text-center text-sm text-ash leading-relaxed mb-8">
              Once you publish content, performance metrics will populate here with real-time insights across all your connected platforms.
            </p>

            {/* Steps to get started */}
            <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
              <div className="flex items-center gap-2.5 rounded-xl border border-smoke/60 bg-slate/30 px-4 py-2.5 transition-all duration-200 hover:border-royal/20">
                <Cable size={14} strokeWidth={1.5} className="text-royal/50" />
                <span className="text-xs text-ash">Connect platforms</span>
              </div>
              <ArrowRight size={14} strokeWidth={1.5} className="text-ash/30 hidden sm:block" />
              <div className="flex items-center gap-2.5 rounded-xl border border-smoke/60 bg-slate/30 px-4 py-2.5 transition-all duration-200 hover:border-royal/20">
                <BarChart3 size={14} strokeWidth={1.5} className="text-royal/50" />
                <span className="text-xs text-ash">Publish content</span>
              </div>
              <ArrowRight size={14} strokeWidth={1.5} className="text-ash/30 hidden sm:block" />
              <div className="flex items-center gap-2.5 rounded-xl border border-smoke/60 bg-slate/30 px-4 py-2.5 transition-all duration-200 hover:border-royal/20">
                <TrendingUp size={14} strokeWidth={1.5} className="text-royal/50" />
                <span className="text-xs text-ash">Track results</span>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Overview metrics */}
            <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {metrics.map((metric) => {
                const Icon = metric.icon;
                return (
                  <Card key={metric.label} padding="md">
                    <div className="group transition-all duration-200">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate/50 border border-smoke/50 transition-colors duration-200 group-hover:border-royal/20 group-hover:bg-royal-muted">
                          <Icon size={16} strokeWidth={1.5} className="text-ash transition-colors duration-200 group-hover:text-royal" />
                        </div>
                      </div>
                      <div className="font-mono text-2xl font-bold text-cloud tracking-tight">
                        {metric.value}
                      </div>
                      <div className="mt-0.5 text-[11px] text-ash/70 uppercase tracking-wider">
                        {metric.label}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            <div className="grid gap-6 lg:grid-cols-5">
              {/* Posts published count */}
              <div className="lg:col-span-3">
                <Card padding="md">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/15">
                      <BarChart3 size={16} strokeWidth={1.5} className="text-emerald-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-cloud">
                      Posts published
                    </h3>
                  </div>
                  <div className="font-mono text-4xl font-bold text-cloud tracking-tight">
                    {data.postsPublished}
                  </div>
                  <p className="mt-1.5 text-[11px] text-ash/70 uppercase tracking-wider">Total published content pieces</p>
                </Card>
              </div>

              {/* Top posts */}
              <div className="lg:col-span-2">
                <Card padding="none">
                  <div className="border-b border-smoke px-4 py-3.5 flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-royal-muted">
                      <TrendingUp size={13} strokeWidth={1.5} className="text-royal" />
                    </div>
                    <h3 className="text-sm font-semibold text-cloud">
                      Top performing
                    </h3>
                  </div>
                  {data.topPosts.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <p className="text-sm text-ash/60">No published posts with analytics yet.</p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-smoke/60">
                      {data.topPosts.map((post) => (
                        <li key={post.id} className="px-4 py-3.5 transition-colors duration-200 hover:bg-slate/30">
                          <p className="mb-1.5 truncate text-sm font-medium text-cloud">
                            {post.title}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-ash">
                            <span className="rounded-md bg-slate/50 px-1.5 py-0.5 text-[10px] uppercase tracking-wider">{post.platform}</span>
                            <span className="font-mono">{formatNumber(post.impressions)} views</span>
                            <span className="font-mono text-royal font-medium">
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
