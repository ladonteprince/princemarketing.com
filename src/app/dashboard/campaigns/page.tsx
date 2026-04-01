"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Plus, MoreHorizontal, Target, Calendar, Megaphone } from "lucide-react";
import type { CampaignStatus } from "@/types/campaign";

type Campaign = {
  id: string;
  name: string;
  status: CampaignStatus;
  goal: string | null;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  _count?: { entries: number };
};

const STATUS_BADGE_VARIANT: Record<CampaignStatus, "royal" | "mint" | "amber" | "coral" | "default"> = {
  ACTIVE: "royal",
  COMPLETED: "mint",
  DRAFT: "amber",
  PAUSED: "default",
  ARCHIVED: "default",
};

function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return "Not scheduled";
  const startDate = new Date(start).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (!end) return `From ${startDate}`;
  const endDate = new Date(end).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${startDate} - ${endDate}`;
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCampaigns() {
      try {
        const res = await fetch("/api/campaigns");
        if (res.ok) {
          const data = await res.json();
          setCampaigns(data.campaigns ?? []);
        }
      } catch (err) {
        console.error("Failed to fetch campaigns:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchCampaigns();
  }, []);

  const activeCampaigns = campaigns.filter((c) => c.status === "ACTIVE");

  return (
    <div className="flex flex-col">
      <Header
        title="Campaigns"
        subtitle="Organize your marketing around clear goals"
      />

      <div className="flex-1 px-6 py-6">
        {/* Actions bar */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="royal">{activeCampaigns.length} active</Badge>
            <Badge>{campaigns.length} total</Badge>
          </div>
          <Button size="sm" icon={<Plus size={16} strokeWidth={1.5} />}>
            New campaign
          </Button>
        </div>

        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} padding="md">
                <div className="h-14 animate-pulse rounded bg-slate" />
              </Card>
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-royal-muted">
              <Megaphone size={32} strokeWidth={1.5} className="text-royal" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-cloud">
              No campaigns yet
            </h3>
            <p className="max-w-md text-center text-sm text-ash">
              Create your first campaign to organize your content around a clear marketing goal.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {campaigns.map((campaign) => (
              <Card key={campaign.id} padding="md" hover>
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-cloud">
                        {campaign.name}
                      </h3>
                      <Badge variant={STATUS_BADGE_VARIANT[campaign.status]}>
                        {campaign.status.toLowerCase()}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-ash">
                      {campaign.goal && (
                        <span className="flex items-center gap-1">
                          <Target size={12} strokeWidth={1.5} />
                          {campaign.goal}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar size={12} strokeWidth={1.5} />
                        {formatDateRange(campaign.startDate, campaign.endDate)}
                      </span>
                    </div>
                  </div>

                  <button
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-ash hover:text-cloud hover:bg-slate transition-colors cursor-pointer"
                    aria-label="Campaign options"
                  >
                    <MoreHorizontal size={16} strokeWidth={1.5} />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
