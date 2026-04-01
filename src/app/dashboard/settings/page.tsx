"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  User,
  Building2,
  CreditCard,
  Link2,
  Instagram,
  Facebook,
  Linkedin,
  Twitter,
  Music2,
  Youtube,
  BarChart3,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type UserProfile = {
  id: string;
  email: string;
  name: string | null;
  businessName: string | null;
  industry: string | null;
  tier: string;
};

type ConnectedPlatform = {
  id: string;
  type: string;
  accountName: string;
  connected: boolean;
};

const PLATFORM_ICONS: Record<string, LucideIcon> = {
  INSTAGRAM: Instagram,
  FACEBOOK: Facebook,
  LINKEDIN: Linkedin,
  TWITTER: Twitter,
  TIKTOK: Music2,
  YOUTUBE: Youtube,
  GOOGLE_ANALYTICS: BarChart3,
};

const PLATFORM_KEYS: Record<string, string> = {
  INSTAGRAM: "instagram",
  FACEBOOK: "facebook",
  LINKEDIN: "linkedin",
  TWITTER: "twitter",
  TIKTOK: "tiktok",
  YOUTUBE: "youtube",
  GOOGLE_ANALYTICS: "google-analytics",
};

const ALL_PLATFORMS = [
  { type: "INSTAGRAM", name: "Instagram" },
  { type: "FACEBOOK", name: "Facebook" },
  { type: "TWITTER", name: "X (Twitter)" },
  { type: "LINKEDIN", name: "LinkedIn" },
  { type: "TIKTOK", name: "TikTok" },
  { type: "YOUTUBE", name: "YouTube" },
  { type: "GOOGLE_ANALYTICS", name: "Google Analytics" },
];

const TIER_LABELS: Record<string, { name: string; price: string; features: string }> = {
  STARTER: { name: "Starter Plan", price: "$29/month", features: "2 platforms, 20 posts/month" },
  GROWTH: { name: "Growth Plan", price: "$79/month", features: "5 platforms, 60 posts/month" },
  SCALE: { name: "Scale Plan", price: "$199/month", features: "Unlimited platforms, unlimited posts" },
};

export default function SettingsPageWrapper() {
  return (
    <Suspense fallback={<div className="flex flex-col"><Header title="Settings" subtitle="Manage your account and connections" /><div className="flex-1 px-6 py-6"><div className="mx-auto max-w-2xl space-y-6"><Card padding="lg"><div className="h-20 animate-pulse rounded bg-slate" /></Card></div></div></div>}>
      <SettingsPageContent />
    </Suspense>
  );
}

function SettingsPageContent() {
  const searchParams = useSearchParams();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [platforms, setPlatforms] = useState<ConnectedPlatform[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [industry, setIndustry] = useState("");

  // Check for OAuth callback messages
  useEffect(() => {
    const connected = searchParams.get("connected");
    const errorParam = searchParams.get("error");

    if (connected) {
      setSuccess(`Successfully connected ${connected}. Refreshing...`);
      // Reload platforms
      fetchData();
    }
    if (errorParam) {
      const messages: Record<string, string> = {
        invalid_platform: "Invalid platform specified.",
        no_code: "Authorization was not completed.",
        invalid_state: "Security check failed. Please try again.",
        not_configured: "This platform is not configured yet. Contact support.",
        token_exchange_failed: "Failed to connect. Please try again.",
        callback_failed: "Connection failed. Please try again.",
      };
      setError(messages[errorParam] ?? `Connection error: ${errorParam}`);
    }
  }, [searchParams]);

  async function fetchData() {
    try {
      setLoading(true);

      // Fetch profile and platforms in parallel
      const [profileRes, platformsRes] = await Promise.all([
        fetch("/api/user/profile"),
        fetch("/api/user/platforms"),
      ]);

      if (profileRes.ok) {
        const { user } = await profileRes.json();
        setProfile(user);
        setName(user.name ?? "");
        setEmail(user.email ?? "");
        setBusinessName(user.businessName ?? "");
        setIndustry(user.industry ?? "");
      }

      if (platformsRes.ok) {
        const { platforms: p } = await platformsRes.json();
        setPlatforms(p);
      }
    } catch {
      setError("Failed to load settings. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, businessName, industry }),
      });

      if (res.ok) {
        const { user } = await res.json();
        setProfile(user);
        setSuccess("Settings saved successfully.");
      } else {
        const data = await res.json();
        setError(data.error ?? "Failed to save settings.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleConnect(platformKey: string) {
    // Redirect to OAuth flow
    window.location.href = `/api/social/connect/${platformKey}`;
  }

  async function handleDisconnect(platformType: string) {
    const key = PLATFORM_KEYS[platformType];
    if (!key) return;

    setDisconnecting(platformType);
    setError(null);

    try {
      const res = await fetch(`/api/social/disconnect/${key}`, {
        method: "POST",
      });

      if (res.ok) {
        setPlatforms((prev) =>
          prev.map((p) =>
            p.type === platformType ? { ...p, connected: false, accountName: "Disconnected" } : p,
          ),
        );
        setSuccess(`${ALL_PLATFORMS.find((p) => p.type === platformType)?.name ?? platformType} disconnected.`);
      } else {
        const data = await res.json();
        setError(data.error ?? "Failed to disconnect.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setDisconnecting(null);
    }
  }

  const tierInfo = TIER_LABELS[profile?.tier ?? "STARTER"] ?? TIER_LABELS.STARTER;

  return (
    <div className="flex flex-col">
      <Header title="Settings" subtitle="Manage your account and connections" />

      <div className="flex-1 px-6 py-6">
        <div className="mx-auto max-w-2xl space-y-6">
          {/* Status messages */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-coral/30 bg-coral/10 px-4 py-3 text-sm text-coral">
              <AlertCircle size={16} strokeWidth={1.5} />
              {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-400">
              <CheckCircle size={16} strokeWidth={1.5} />
              {success}
            </div>
          )}

          {/* Profile */}
          <Card padding="lg">
            <div className="mb-4 flex items-center gap-2">
              <User size={18} strokeWidth={1.5} className="text-royal" />
              <h2 className="text-base font-semibold text-cloud">Profile</h2>
            </div>

            {loading ? (
              <div className="space-y-4">
                <div className="h-10 animate-pulse rounded-lg bg-slate" />
                <div className="h-10 animate-pulse rounded-lg bg-slate" />
              </div>
            ) : (
              <div className="space-y-4">
                <Input
                  label="Full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                />
                <Input
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@business.com"
                />
              </div>
            )}
          </Card>

          {/* Business info */}
          <Card padding="lg">
            <div className="mb-4 flex items-center gap-2">
              <Building2 size={18} strokeWidth={1.5} className="text-royal" />
              <h2 className="text-base font-semibold text-cloud">Business</h2>
            </div>

            {loading ? (
              <div className="space-y-4">
                <div className="h-10 animate-pulse rounded-lg bg-slate" />
                <div className="h-10 animate-pulse rounded-lg bg-slate" />
              </div>
            ) : (
              <div className="space-y-4">
                <Input
                  label="Business name"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Your business name"
                />
                <Input
                  label="Industry"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  placeholder="e.g. Bakery, Fitness, Consulting"
                />
              </div>
            )}
          </Card>

          {/* Connected platforms */}
          <Card padding="lg">
            <div className="mb-4 flex items-center gap-2">
              <Link2 size={18} strokeWidth={1.5} className="text-royal" />
              <h2 className="text-base font-semibold text-cloud">
                Connected platforms
              </h2>
            </div>

            <div className="space-y-3">
              {ALL_PLATFORMS.map((platform) => {
                const Icon = PLATFORM_ICONS[platform.type] ?? Link2;
                const connected = platforms.find(
                  (p) => p.type === platform.type && p.connected,
                );
                const platformKey = PLATFORM_KEYS[platform.type];

                return (
                  <div
                    key={platform.type}
                    className="flex items-center justify-between rounded-lg border border-smoke bg-slate px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={18} strokeWidth={1.5} className="text-ash" />
                      <div>
                        <p className="text-sm font-medium text-cloud">
                          {platform.name}
                        </p>
                        <p className="text-xs text-ash">
                          {connected ? connected.accountName : "Not connected"}
                        </p>
                      </div>
                    </div>
                    {connected ? (
                      <div className="flex items-center gap-2">
                        <Badge variant="mint">Connected</Badge>
                        <Button
                          variant="danger"
                          size="sm"
                          loading={disconnecting === platform.type}
                          onClick={() => handleDisconnect(platform.type)}
                        >
                          Disconnect
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleConnect(platformKey)}
                      >
                        Connect
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Subscription */}
          <Card padding="lg">
            <div className="mb-4 flex items-center gap-2">
              <CreditCard size={18} strokeWidth={1.5} className="text-royal" />
              <h2 className="text-base font-semibold text-cloud">
                Subscription
              </h2>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-royal/30 bg-royal-muted/30 px-4 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-cloud">{tierInfo.name}</p>
                  <Badge variant="royal">Current</Badge>
                </div>
                <p className="text-xs text-ash">
                  {tierInfo.price} &middot; {tierInfo.features}
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  // Redirect to Stripe customer portal
                  fetch("/api/stripe/portal", { method: "POST" })
                    .then((r) => r.json())
                    .then((data) => {
                      if (data.url) window.location.href = data.url;
                    });
                }}
              >
                Manage
              </Button>
            </div>
          </Card>

          {/* Save button */}
          <div className="flex justify-end">
            <Button loading={saving} onClick={handleSave}>
              Save changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
