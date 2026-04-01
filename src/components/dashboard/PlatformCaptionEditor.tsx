"use client";

import { useState, useCallback } from "react";

// Platform character limits
const PLATFORM_LIMITS: Record<string, { label: string; maxChars: number; note?: string }> = {
  twitter: { label: "Twitter / X", maxChars: 280 },
  tiktok: { label: "TikTok", maxChars: 150 },
  instagram: { label: "Instagram", maxChars: 2200, note: "Hashtags recommended" },
  facebook: { label: "Facebook", maxChars: 63206 },
  linkedin: { label: "LinkedIn", maxChars: 3000 },
  youtube: { label: "YouTube", maxChars: 5000, note: "Title (100 chars) + Description" },
};

const YOUTUBE_TITLE_LIMIT = 100;

type PlatformContentValue = string | { title: string; description: string };

type PlatformCaptionEditorProps = {
  platforms: string[];
  defaultContent: string;
  onChange: (platformContent: Record<string, PlatformContentValue>) => void;
};

export default function PlatformCaptionEditor({
  platforms,
  defaultContent,
  onChange,
}: PlatformCaptionEditorProps) {
  // Track which platform overrides are expanded
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // Track per-platform content overrides
  const [overrides, setOverrides] = useState<Record<string, PlatformContentValue>>({});
  // YouTube gets separate title + description
  const [ytTitle, setYtTitle] = useState("");
  const [ytDescription, setYtDescription] = useState("");

  const toggleExpanded = useCallback((platform: string) => {
    setExpanded((prev) => ({ ...prev, [platform]: !prev[platform] }));
  }, []);

  const updateOverride = useCallback(
    (platform: string, value: PlatformContentValue) => {
      const next = { ...overrides, [platform]: value };
      // Remove empty overrides so they fall back to default
      if (typeof value === "string" && value.trim() === "") {
        delete next[platform];
      }
      setOverrides(next);
      onChange(next);
    },
    [overrides, onChange],
  );

  const handleYouTubeChange = useCallback(
    (field: "title" | "description", value: string) => {
      const newTitle = field === "title" ? value : ytTitle;
      const newDesc = field === "description" ? value : ytDescription;
      if (field === "title") setYtTitle(value);
      if (field === "description") setYtDescription(value);

      const next = { ...overrides };
      if (newTitle.trim() === "" && newDesc.trim() === "") {
        delete next.youtube;
      } else {
        next.youtube = { title: newTitle, description: newDesc || defaultContent };
      }
      setOverrides(next);
      onChange(next);
    },
    [overrides, onChange, ytTitle, ytDescription, defaultContent],
  );

  const charCount = (text: string, max: number) => {
    const len = text.length;
    const isOver = len > max;
    return (
      <span className={isOver ? "text-red-500 font-semibold" : "text-gray-400"}>
        {len}/{max}
      </span>
    );
  };

  return (
    <div className="space-y-3">
      {/* Default caption */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Default Caption (used when no platform override is set)
        </label>
        <textarea
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-y"
          rows={3}
          value={defaultContent}
          readOnly
          aria-label="Default caption"
        />
      </div>

      {/* Per-platform overrides */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-700">Platform Overrides</p>
        {platforms.map((platform) => {
          const config = PLATFORM_LIMITS[platform];
          if (!config) return null;
          const isExpanded = expanded[platform] ?? false;
          const isYouTube = platform === "youtube";

          return (
            <div
              key={platform}
              className="border border-gray-200 rounded-lg overflow-hidden"
            >
              {/* Collapsible header */}
              <button
                type="button"
                onClick={() => toggleExpanded(platform)}
                className="flex items-center justify-between w-full px-4 py-2.5 text-sm font-medium text-left bg-gray-50 hover:bg-gray-100 transition-colors"
                aria-expanded={isExpanded}
              >
                <span className="flex items-center gap-2">
                  <span>{config.label}</span>
                  {config.note && (
                    <span className="text-xs text-gray-400">({config.note})</span>
                  )}
                </span>
                <span className="flex items-center gap-3">
                  {overrides[platform] && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                      Custom
                    </span>
                  )}
                  <svg
                    className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </span>
              </button>

              {/* Expanded editor */}
              {isExpanded && (
                <div className="px-4 py-3 bg-white space-y-2">
                  {isYouTube ? (
                    <>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">
                          Video Title {charCount(ytTitle || "", YOUTUBE_TITLE_LIMIT)}
                        </label>
                        <input
                          type="text"
                          className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          placeholder="Leave empty to auto-extract from caption"
                          maxLength={YOUTUBE_TITLE_LIMIT}
                          value={ytTitle}
                          onChange={(e) => handleYouTubeChange("title", e.target.value)}
                          aria-label="YouTube title"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">
                          Description {charCount(ytDescription || defaultContent, config.maxChars)}
                        </label>
                        <textarea
                          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-y"
                          rows={4}
                          placeholder={defaultContent}
                          value={ytDescription}
                          onChange={(e) => handleYouTubeChange("description", e.target.value)}
                          aria-label="YouTube description"
                        />
                      </div>
                    </>
                  ) : (
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-xs text-gray-500">
                          Custom caption for {config.label}
                        </label>
                        {charCount(
                          typeof overrides[platform] === "string"
                            ? (overrides[platform] as string)
                            : defaultContent,
                          config.maxChars,
                        )}
                      </div>
                      <textarea
                        className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-y"
                        rows={3}
                        placeholder={defaultContent}
                        value={
                          typeof overrides[platform] === "string"
                            ? (overrides[platform] as string)
                            : ""
                        }
                        onChange={(e) => updateOverride(platform, e.target.value)}
                        aria-label={`Custom caption for ${config.label}`}
                      />
                    </div>
                  )}
                  {/* Clear button */}
                  {overrides[platform] && (
                    <button
                      type="button"
                      onClick={() => {
                        const next = { ...overrides };
                        delete next[platform];
                        setOverrides(next);
                        onChange(next);
                        if (isYouTube) {
                          setYtTitle("");
                          setYtDescription("");
                        }
                      }}
                      className="text-xs text-red-500 hover:text-red-700 transition-colors"
                    >
                      Clear override (use default caption)
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
