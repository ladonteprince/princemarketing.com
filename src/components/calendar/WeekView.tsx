"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  getWeekDates,
  isToday,
  formatDate,
} from "@/utils/date";
import type { ContentStatus, PlatformType } from "@/types/calendar";

// WHY: Mock data that demonstrates Marcus's real use case — 7:15am, see today's content
type MockEntry = {
  id: string;
  title: string;
  platform: PlatformType;
  time: string;
  status: ContentStatus;
  dayOffset: number; // 0 = Monday of current week
};

const MOCK_ENTRIES: ReadonlyArray<MockEntry> = [
  { id: "1", title: "5 plumbing tips every homeowner needs", platform: "INSTAGRAM", time: "9:00 AM", status: "SCHEDULED", dayOffset: 0 },
  { id: "2", title: "Before/after: Kitchen sink replacement", platform: "FACEBOOK", time: "12:30 PM", status: "SCHEDULED", dayOffset: 0 },
  { id: "3", title: "Why regular maintenance saves thousands", platform: "LINKEDIN", time: "8:00 AM", status: "DRAFT", dayOffset: 1 },
  { id: "4", title: "Customer spotlight: The Johnsons", platform: "INSTAGRAM", time: "10:00 AM", status: "PUBLISHED", dayOffset: 2 },
  { id: "5", title: "Emergency winter checklist", platform: "TWITTER", time: "11:00 AM", status: "DRAFT", dayOffset: 2 },
  { id: "6", title: "Video: How to unclog a drain", platform: "TIKTOK", time: "3:00 PM", status: "SCHEDULED", dayOffset: 3 },
  { id: "7", title: "Weekend service availability", platform: "FACEBOOK", time: "9:00 AM", status: "SCHEDULED", dayOffset: 4 },
  { id: "8", title: "Plumbing myths debunked", platform: "INSTAGRAM", time: "11:00 AM", status: "DRAFT", dayOffset: 5 },
];

const PLATFORM_LABELS: Record<PlatformType, string> = {
  INSTAGRAM: "IG",
  FACEBOOK: "FB",
  TWITTER: "X",
  LINKEDIN: "LI",
  TIKTOK: "TT",
  YOUTUBE: "YT",
};

const STATUS_BADGE_VARIANT: Record<ContentStatus, "royal" | "mint" | "amber" | "coral"> = {
  SCHEDULED: "royal",
  PUBLISHED: "mint",
  DRAFT: "amber",
  FAILED: "coral",
};

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export function WeekView() {
  const [weekOffset, setWeekOffset] = useState(0);

  const referenceDate = new Date();
  referenceDate.setDate(referenceDate.getDate() + weekOffset * 7);
  const weekDates = getWeekDates(referenceDate);

  return (
    <div>
      {/* Week navigation */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setWeekOffset((prev) => prev - 1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ash hover:text-cloud hover:bg-slate transition-colors cursor-pointer"
            aria-label="Previous week"
          >
            <ChevronLeft size={16} strokeWidth={1.5} />
          </button>
          <span className="text-sm font-medium text-cloud">
            {formatDate(weekDates[0])} &ndash; {formatDate(weekDates[6])}
          </span>
          <button
            onClick={() => setWeekOffset((prev) => prev + 1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ash hover:text-cloud hover:bg-slate transition-colors cursor-pointer"
            aria-label="Next week"
          >
            <ChevronRight size={16} strokeWidth={1.5} />
          </button>
        </div>

        {weekOffset !== 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setWeekOffset(0)}
          >
            Today
          </Button>
        )}
      </div>

      {/* Week grid */}
      <div className="grid grid-cols-7 gap-3">
        {weekDates.map((date, dayIndex) => {
          const today = isToday(date);
          const dayEntries = MOCK_ENTRIES.filter(
            (e) => e.dayOffset === dayIndex,
          );

          return (
            <div
              key={dayIndex}
              className={`
                min-h-[200px] rounded-xl border p-3
                ${today ? "border-royal/40 bg-royal-muted/30" : "border-smoke bg-graphite"}
              `}
            >
              {/* Day header */}
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-medium text-ash">
                  {DAY_NAMES[dayIndex]}
                </span>
                <span
                  className={`
                    flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium
                    ${today ? "bg-royal text-white" : "text-cloud"}
                  `}
                >
                  {date.getDate()}
                </span>
              </div>

              {/* Entries */}
              <div className="flex flex-col gap-2">
                {dayEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="group cursor-pointer rounded-lg border border-smoke bg-slate p-2 transition-colors hover:border-ash/30"
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[10px] font-mono text-ash">
                        {entry.time}
                      </span>
                      <span className="text-[10px] font-medium text-ash">
                        {PLATFORM_LABELS[entry.platform]}
                      </span>
                    </div>
                    <p className="text-xs leading-snug text-cloud line-clamp-2">
                      {entry.title}
                    </p>
                    <div className="mt-1.5">
                      <Badge variant={STATUS_BADGE_VARIANT[entry.status]}>
                        {entry.status.toLowerCase()}
                      </Badge>
                    </div>
                  </div>
                ))}

                {dayEntries.length === 0 && (
                  <p className="py-4 text-center text-[10px] text-ash/40">
                    No posts
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
