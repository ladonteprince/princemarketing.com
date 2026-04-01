"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Send } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  getWeekDates,
  isToday,
  isSameDay,
  formatDate,
  formatTime,
} from "@/utils/date";
import type { ContentStatus, PlatformType } from "@/types/calendar";

type CalendarEntry = {
  id: string;
  title: string;
  content: string;
  platform: PlatformType;
  scheduledAt: string;
  status: ContentStatus;
  mediaUrl: string | null;
};

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
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState<string | null>(null);

  const referenceDate = new Date();
  referenceDate.setDate(referenceDate.getDate() + weekOffset * 7);
  const weekDates = getWeekDates(referenceDate);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const start = weekDates[0].toISOString();
      const end = new Date(weekDates[6].getTime() + 86400000 - 1).toISOString();
      const res = await fetch(`/api/calendar?start=${start}&end=${end}`);

      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries ?? []);
      }
    } catch (err) {
      console.error("Failed to fetch calendar entries:", err);
    } finally {
      setLoading(false);
    }
  }, [weekOffset]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  async function handlePublish(entry: CalendarEntry) {
    setPublishing(entry.id);
    try {
      const platformKey = entry.platform.toLowerCase();
      const res = await fetch("/api/social/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: entry.content,
          platforms: [platformKey],
          mediaUrl: entry.mediaUrl ?? undefined,
          calendarEntryId: entry.id,
        }),
      });

      if (res.ok) {
        // Refresh entries to show updated status
        await fetchEntries();
      } else {
        const data = await res.json();
        alert(data.error ?? "Failed to publish. Check Settings to ensure the platform is connected.");
      }
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setPublishing(null);
    }
  }

  return (
    <div>
      {/* Week navigation */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setWeekOffset((prev) => prev - 1)}
            className="
              flex h-9 w-9 items-center justify-center rounded-lg
              border border-smoke text-ash
              hover:text-cloud hover:bg-slate hover:border-ash/30
              active:scale-95
              transition-all duration-200 cursor-pointer
            "
            aria-label="Previous week"
          >
            <ChevronLeft size={18} strokeWidth={2} />
          </button>
          <span className="text-base font-semibold tracking-tight text-cloud">
            {formatDate(weekDates[0])} &ndash; {formatDate(weekDates[6])}
          </span>
          <button
            onClick={() => setWeekOffset((prev) => prev + 1)}
            className="
              flex h-9 w-9 items-center justify-center rounded-lg
              border border-smoke text-ash
              hover:text-cloud hover:bg-slate hover:border-ash/30
              active:scale-95
              transition-all duration-200 cursor-pointer
            "
            aria-label="Next week"
          >
            <ChevronRight size={18} strokeWidth={2} />
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

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-sm text-ash">Loading calendar...</div>
        </div>
      )}

      {/* Week grid */}
      {!loading && (
        <div className="grid grid-cols-7 gap-3">
          {weekDates.map((date, dayIndex) => {
            const today = isToday(date);
            const dayEntries = entries.filter((e) =>
              isSameDay(new Date(e.scheduledAt), date),
            );

            return (
              <div
                key={dayIndex}
                className={`
                  min-h-[200px] rounded-xl border p-3
                  transition-all duration-200
                  ${today
                    ? "border-royal/50 bg-royal-muted/30 shadow-sm shadow-royal/10 ring-1 ring-royal/20"
                    : "border-smoke bg-graphite hover:border-ash/30 hover:bg-graphite/80"
                  }
                `}
              >
                {/* Day header */}
                <div className="mb-3 flex items-center justify-between">
                  <span className={`text-xs font-medium ${today ? "text-royal" : "text-ash"}`}>
                    {DAY_NAMES[dayIndex]}
                  </span>
                  <span
                    className={`
                      flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold
                      ${today
                        ? "bg-royal text-white shadow-sm shadow-royal/30"
                        : "text-cloud hover:bg-slate/60"
                      }
                      transition-colors duration-200
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
                      className="
                        group cursor-pointer rounded-lg border border-smoke bg-slate p-2.5
                        transition-all duration-200
                        hover:border-royal/30 hover:bg-slate/80 hover:shadow-sm
                      "
                    >
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-[10px] font-mono text-ash/70">
                          {formatTime(entry.scheduledAt)}
                        </span>
                        <span className="text-[10px] font-semibold tracking-wide text-ash/80">
                          {PLATFORM_LABELS[entry.platform]}
                        </span>
                      </div>
                      <p className="text-xs leading-snug text-cloud line-clamp-2">
                        {entry.title}
                      </p>
                      <div className="mt-2 flex items-center justify-between">
                        <Badge variant={STATUS_BADGE_VARIANT[entry.status]}>
                          {entry.status.toLowerCase()}
                        </Badge>
                        {(entry.status === "SCHEDULED" || entry.status === "DRAFT") && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePublish(entry);
                            }}
                            disabled={publishing === entry.id}
                            className="
                              flex items-center gap-1 rounded-md px-1.5 py-0.5
                              text-[10px] font-medium text-royal
                              hover:text-royal-hover hover:bg-royal/10
                              transition-all duration-200 cursor-pointer
                              disabled:opacity-50
                            "
                            title="Publish now"
                          >
                            <Send size={10} strokeWidth={1.5} />
                            {publishing === entry.id ? "..." : "Publish"}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {dayEntries.length === 0 && (
                    <p className="py-6 text-center text-[10px] text-ash/25 italic">
                      No posts scheduled
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
