"use client";

import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Plus, MoreHorizontal, Target, Calendar } from "lucide-react";
import type { CampaignStatus } from "@/types/campaign";

type MockCampaign = {
  id: string;
  name: string;
  status: CampaignStatus;
  goal: string;
  posts: number;
  dateRange: string;
};

const MOCK_CAMPAIGNS: ReadonlyArray<MockCampaign> = [
  {
    id: "1",
    name: "Spring Promotion",
    status: "ACTIVE",
    goal: "Increase bookings by 20%",
    posts: 24,
    dateRange: "Mar 1 - Apr 15",
  },
  {
    id: "2",
    name: "Customer Testimonials",
    status: "ACTIVE",
    goal: "Build social proof",
    posts: 12,
    dateRange: "Feb 15 - Mar 31",
  },
  {
    id: "3",
    name: "Winter Emergency Services",
    status: "COMPLETED",
    goal: "Drive emergency calls",
    posts: 18,
    dateRange: "Dec 1 - Feb 28",
  },
  {
    id: "4",
    name: "New Service Launch",
    status: "DRAFT",
    goal: "Announce bathroom renovation services",
    posts: 0,
    dateRange: "Not scheduled",
  },
];

const STATUS_BADGE_VARIANT: Record<CampaignStatus, "royal" | "mint" | "amber" | "coral" | "default"> = {
  ACTIVE: "royal",
  COMPLETED: "mint",
  DRAFT: "amber",
  PAUSED: "default",
  ARCHIVED: "default",
};

export default function CampaignsPage() {
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
            <Badge variant="royal">{MOCK_CAMPAIGNS.filter((c) => c.status === "ACTIVE").length} active</Badge>
            <Badge>{MOCK_CAMPAIGNS.length} total</Badge>
          </div>
          <Button size="sm" icon={<Plus size={16} strokeWidth={1.5} />}>
            New campaign
          </Button>
        </div>

        {/* Campaign list */}
        <div className="flex flex-col gap-3">
          {MOCK_CAMPAIGNS.map((campaign) => (
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
                    <span className="flex items-center gap-1">
                      <Target size={12} strokeWidth={1.5} />
                      {campaign.goal}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar size={12} strokeWidth={1.5} />
                      {campaign.dateRange}
                    </span>
                    <span>{campaign.posts} posts</span>
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
      </div>
    </div>
  );
}
