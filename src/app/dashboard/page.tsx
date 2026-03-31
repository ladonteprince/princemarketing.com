"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  TrendingUp,
  Eye,
  MousePointerClick,
  CalendarCheck,
  ArrowUpRight,
  ArrowDownRight,
  ImageIcon,
  Video,
  FileText,
  Sparkles,
  Clock,
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

// WHY: Placeholder recent generations to show the list pattern before real data flows.
type RecentGeneration = {
  id: string;
  type: "image" | "video" | "copy";
  prompt: string;
  status: "completed" | "processing" | "failed";
  time: string;
};

const RECENT_GENERATIONS: ReadonlyArray<RecentGeneration> = [
  { id: "g1", type: "image", prompt: "Professional plumber at work, modern bathroom", status: "completed", time: "1h ago" },
  { id: "g2", type: "video", prompt: "Quick tip: How to fix a leaky faucet", status: "completed", time: "3h ago" },
  { id: "g3", type: "copy", prompt: "Write Instagram caption for spring promo", status: "completed", time: "5h ago" },
  { id: "g4", type: "image", prompt: "Before/after kitchen renovation", status: "processing", time: "Just now" },
];

const generationTypeIcon: Record<RecentGeneration["type"], LucideIcon> = {
  image: ImageIcon,
  video: Video,
  copy: FileText,
};

const statusBadgeVariant: Record<RecentGeneration["status"], "mint" | "amber" | "coral"> = {
  completed: "mint",
  processing: "amber",
  failed: "coral",
};

// WHY: Generation card component keeps the main page clean
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
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<{ type: string; data: unknown } | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="flex flex-col">
      <Header
        title="Good morning, Marcus"
        subtitle="Here is what is happening with your marketing"
      />

      <div className="flex-1 px-4 py-4 sm:px-6 sm:py-6">
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

        {/* Subscription status */}
        <div className="mb-8">
          <Card padding="md">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-royal-muted">
                  <Sparkles size={20} strokeWidth={1.5} className="text-royal" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-cloud">Pro Plan</h3>
                  <p className="text-xs text-ash">
                    47 of 100 generations used this month
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-2 w-32 overflow-hidden rounded-full bg-smoke">
                  <div
                    className="h-full rounded-full bg-royal transition-all duration-500"
                    style={{ width: "47%" }}
                  />
                </div>
                <Badge variant="royal">Active</Badge>
              </div>
            </div>
          </Card>
        </div>

        {/* Generation cards */}
        <div className="mb-8">
          <h2 className="mb-4 text-base font-semibold text-cloud">
            Create content
          </h2>

          {/* Success / error feedback */}
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

        {/* Recent generations */}
        <div className="mb-8">
          <h2 className="mb-4 text-base font-semibold text-cloud">
            Recent generations
          </h2>
          <Card padding="none">
            <ul className="divide-y divide-smoke">
              {RECENT_GENERATIONS.map((gen) => {
                const Icon = generationTypeIcon[gen.type];
                return (
                  <li key={gen.id} className="flex items-center gap-4 px-4 py-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-royal-muted">
                      <Icon size={16} strokeWidth={1.5} className="text-royal" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-cloud">{gen.prompt}</p>
                      <div className="flex items-center gap-2 text-xs text-ash">
                        <Clock size={12} strokeWidth={1.5} />
                        {gen.time}
                      </div>
                    </div>
                    <Badge variant={statusBadgeVariant[gen.status]}>
                      {gen.status === "completed"
                        ? "Done"
                        : gen.status === "processing"
                          ? "Processing"
                          : "Failed"}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          </Card>
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
