"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CampaignWizard } from "@/components/dashboard/CampaignWizard";
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
  const [showWizard, setShowWizard] = useState(false);

  const fetchCampaigns = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

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
          <div className="flex items-center gap-3">
            <Badge variant="royal">{activeCampaigns.length} active</Badge>
            <Badge>{campaigns.length} total</Badge>
          </div>
          <button
            onClick={() => setShowWizard(true)}
            className="
              flex items-center gap-2 rounded-lg
              bg-gradient-to-r from-royal to-royal-hover
              px-4 py-2.5 text-sm font-semibold text-white
              shadow-md shadow-royal/25
              hover:shadow-lg hover:shadow-royal/30 hover:brightness-110
              active:scale-[0.98]
              transition-all duration-200 cursor-pointer
            "
          >
            <Plus size={16} strokeWidth={2} />
            New campaign
          </button>
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
          <div className="flex flex-col items-center justify-center py-24">
            <div className="
              mb-6 flex h-20 w-20 items-center justify-center rounded-2xl
              bg-gradient-to-br from-royal-muted to-royal/10
              border border-royal/20 shadow-lg shadow-royal/10
            ">
              <Megaphone size={36} strokeWidth={1.5} className="text-royal" />
            </div>
            <h3 className="mb-2 text-xl font-semibold text-cloud">
              No campaigns yet
            </h3>
            <p className="mb-6 max-w-sm text-center text-sm leading-relaxed text-ash">
              Campaigns organize your content around clear marketing goals. Launch your first one to get started.
            </p>
            <button
              onClick={() => setShowWizard(true)}
              className="
                flex items-center gap-2 rounded-lg
                bg-gradient-to-r from-royal to-royal-hover
                px-5 py-2.5 text-sm font-semibold text-white
                shadow-md shadow-royal/25
                hover:shadow-lg hover:shadow-royal/30 hover:brightness-110
                active:scale-[0.98]
                transition-all duration-200 cursor-pointer
              "
            >
              <Plus size={16} strokeWidth={2} />
              Create your first campaign
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {campaigns.map((campaign) => (
              <Card key={campaign.id} padding="md" hover>
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex items-center gap-2.5">
                      <h3 className="text-sm font-semibold text-cloud tracking-tight">
                        {campaign.name}
                      </h3>
                      <Badge variant={STATUS_BADGE_VARIANT[campaign.status]}>
                        {campaign.status.toLowerCase()}
                      </Badge>
                      {campaign._count?.entries != null && campaign._count.entries > 0 && (
                        <span className="text-[10px] text-ash/60 font-medium">
                          {campaign._count.entries} {campaign._count.entries === 1 ? "entry" : "entries"}
                        </span>
                      )}
                    </div>

                    {campaign.description && (
                      <p className="mb-2 text-xs text-ash/80 line-clamp-1 leading-relaxed">
                        {campaign.description}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-ash">
                      {campaign.goal && (
                        <span className="flex items-center gap-1.5 rounded-md bg-slate/40 px-2 py-0.5">
                          <Target size={11} strokeWidth={1.5} className="text-royal/60" />
                          {campaign.goal}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5">
                        <Calendar size={11} strokeWidth={1.5} className="text-ash/50" />
                        {formatDateRange(campaign.startDate, campaign.endDate)}
                      </span>
                    </div>
                  </div>

                  <button
                    className="
                      flex h-9 w-9 items-center justify-center rounded-lg
                      text-ash hover:text-cloud hover:bg-slate
                      border border-transparent hover:border-smoke
                      transition-all duration-200 cursor-pointer
                    "
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

      {showWizard && (
        <CampaignWizard
          onClose={() => setShowWizard(false)}
          onCreated={() => fetchCampaigns()}
        />
      )}
    </div>
  );
}
