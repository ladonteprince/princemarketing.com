"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  Eye,
  TrendingUp,
  CalendarCheck,
  Sparkles,
  Clock,
  ImageIcon,
  Video,
  FileText,
  BarChart3,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type DashboardData = {
  userName: string;
  tier: string;
  totalImpressions: number;
  totalEngagement: number;
  postsThisWeek: number;
  postsPublished: number;
  upcomingEntries: {
    id: string;
    title: string;
    platform: string;
    scheduledAt: string;
    status: string;
  }[];
};

const TIER_NAMES: Record<string, string> = {
  STARTER: "Starter Plan",
  GROWTH: "Growth Plan",
  SCALE: "Scale Plan",
};

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function GenerationCard({
  title,
  description,
  icon: Icon,
  type,
  onGenerate,
  loading,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  type: "image" | "video" | "copy";
  onGenerate: (type: string, prompt: string) => void;
  loading: string | null;
}) {
  const [prompt, setPrompt] = useState("");

  return (
    <Card padding="md" className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-royal-muted">
          <Icon size={20} strokeWidth={1.5} className="text-royal" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-cloud">{title}</h3>
          <p className="text-xs text-ash">{description}</p>
        </div>
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={`Describe what you want to ${type === "copy" ? "write" : "create"}...`}
        rows={3}
        className="
          w-full resize-none rounded-lg border border-smoke bg-void px-3 py-2
          text-sm text-cloud placeholder:text-ash/60
          focus:border-royal focus:outline-none
          transition-colors duration-[var(--transition-micro)]
        "
      />

      <Button
        variant="primary"
        size="sm"
        loading={loading === type}
        disabled={!prompt.trim() || loading !== null}
        onClick={() => onGenerate(type, prompt)}
        icon={<Sparkles size={14} strokeWidth={1.5} />}
      >
        Generate
      </Button>
    </Card>
  );
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [dashData, setDashData] = useState<DashboardData | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<{ type: string; data: unknown } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await fetch("/api/dashboard");
        if (res.ok) {
          const data = await res.json();
          setDashData(data);
        }
      } catch {
        // Silent fail — will show empty states
      } finally {
        setPageLoading(false);
      }
    }
    fetchDashboard();
  }, []);

  async function handleGenerate(type: string, prompt: string) {
    setLoading(type);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/generate/${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Generation failed");
      } else {
        setResult({ type, data });
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  const userName = dashData?.userName ?? session?.user?.name ?? "there";
  const tier = dashData?.tier ?? (session?.user as { tier?: string })?.tier ?? "STARTER";
  const greeting = getGreeting();

  return (
    <div className="flex flex-col">
      <Header
        title={`${greeting}, ${userName}`}
        subtitle="Here is what is happening with your marketing"
      />

      <div className="flex-1 px-4 py-4 sm:px-6 sm:py-6">
        {/* Metrics grid */}
        {pageLoading ? (
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} padding="md">
                <div className="h-16 animate-pulse rounded bg-slate" />
              </Card>
            ))}
          </div>
        ) : (
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card padding="md">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm text-ash">Total impressions</span>
                <Eye size={16} strokeWidth={1.5} className="text-ash" />
              </div>
              <span className="font-mono text-2xl font-bold text-cloud">
                {formatNumber(dashData?.totalImpressions ?? 0)}
              </span>
            </Card>
            <Card padding="md">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm text-ash">Engagement rate</span>
                <TrendingUp size={16} strokeWidth={1.5} className="text-ash" />
              </div>
              <span className="font-mono text-2xl font-bold text-cloud">
                {dashData && dashData.totalImpressions > 0
                  ? `${((dashData.totalEngagement / dashData.totalImpressions) * 100).toFixed(1)}%`
                  : "0%"}
              </span>
            </Card>
            <Card padding="md">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm text-ash">Posts this week</span>
                <CalendarCheck size={16} strokeWidth={1.5} className="text-ash" />
              </div>
              <span className="font-mono text-2xl font-bold text-cloud">
                {dashData?.postsThisWeek ?? 0}
              </span>
            </Card>
            <Card padding="md">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm text-ash">Total published</span>
                <BarChart3 size={16} strokeWidth={1.5} className="text-ash" />
              </div>
              <span className="font-mono text-2xl font-bold text-cloud">
                {dashData?.postsPublished ?? 0}
              </span>
            </Card>
          </div>
        )}

        {/* Subscription status */}
        <div className="mb-8">
          <Card padding="md">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-royal-muted">
                  <Sparkles size={20} strokeWidth={1.5} className="text-royal" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-cloud">
                    {TIER_NAMES[tier] ?? "Starter Plan"}
                  </h3>
                  <p className="text-xs text-ash">
                    {dashData?.postsPublished ?? 0} posts published total
                  </p>
                </div>
              </div>
              <Badge variant="royal">Active</Badge>
            </div>
          </Card>
        </div>

        {/* Generation cards */}
        <div className="mb-8">
          <h2 className="mb-4 text-base font-semibold text-cloud">
            Create content
          </h2>

          {error && (
            <div className="mb-4 rounded-lg border border-coral/30 bg-coral/10 px-4 py-3 text-sm text-coral">
              {error}
            </div>
          )}
          {result && (
            <div className="mb-4 rounded-lg border border-mint/30 bg-mint/10 px-4 py-3 text-sm text-mint">
              {result.type.charAt(0).toUpperCase() + result.type.slice(1)} generation submitted successfully.
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <GenerationCard
              title="Image"
              description="Marketing visuals, product photos, social graphics"
              icon={ImageIcon}
              type="image"
              onGenerate={handleGenerate}
              loading={loading}
            />
            <GenerationCard
              title="Video"
              description="Short-form video, reels, promo clips"
              icon={Video}
              type="video"
              onGenerate={handleGenerate}
              loading={loading}
            />
            <GenerationCard
              title="Copy"
              description="Captions, blog posts, ad copy, emails"
              icon={FileText}
              type="copy"
              onGenerate={handleGenerate}
              loading={loading}
            />
          </div>
        </div>

        {/* Upcoming content */}
        <div>
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

          {pageLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} padding="sm">
                  <div className="h-12 animate-pulse rounded bg-slate" />
                </Card>
              ))}
            </div>
          ) : !dashData?.upcomingEntries?.length ? (
            <Card padding="md">
              <div className="flex flex-col items-center py-6">
                <Clock size={24} strokeWidth={1.5} className="mb-2 text-ash" />
                <p className="text-sm text-ash">
                  Nothing scheduled yet. Create content and add it to your calendar.
                </p>
              </div>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {dashData.upcomingEntries.map((entry) => (
                <Card key={entry.id} padding="sm" hover>
                  <div className="flex items-center justify-between gap-4 px-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-cloud">
                        {entry.title}
                      </p>
                      <p className="text-xs text-ash">
                        {entry.platform} &middot;{" "}
                        {new Date(entry.scheduledAt).toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <Badge
                      variant={entry.status === "SCHEDULED" ? "royal" : "default"}
                    >
                      {entry.status === "SCHEDULED" ? "Scheduled" : "Draft"}
                    </Badge>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
