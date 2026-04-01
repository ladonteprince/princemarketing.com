"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { X, ChevronRight, ChevronLeft, Check, Rocket, Save } from "lucide-react";

type WizardStep = 1 | 2 | 3 | 4;

type CampaignData = {
  name: string;
  goal: string;
  startDate: string;
  endDate: string;
  platforms: string[];
  contentTypes: string[];
  frequency: string;
  tone: string;
};

const GOALS = [
  "Brand Awareness",
  "Lead Generation",
  "Sales",
  "Engagement",
  "Traffic",
];

const PLATFORMS = [
  { id: "instagram", label: "Instagram", connected: true },
  { id: "facebook", label: "Facebook", connected: true },
  { id: "twitter", label: "Twitter", connected: false },
  { id: "linkedin", label: "LinkedIn", connected: true },
  { id: "tiktok", label: "TikTok", connected: false },
  { id: "youtube", label: "YouTube", connected: false },
];

const CONTENT_TYPES = ["Images", "Videos", "Copy"];

const FREQUENCIES = [
  { id: "daily", label: "Daily" },
  { id: "3x-week", label: "3x / week" },
  { id: "weekly", label: "Weekly" },
  { id: "custom", label: "Custom" },
];

const TONES = ["Professional", "Casual", "Bold", "Empathetic"];

const STEP_LABELS = ["Basics", "Platforms", "Content", "Review"];

type CampaignWizardProps = {
  onClose: () => void;
  onCreated?: () => void;
};

export function CampaignWizard({ onClose, onCreated }: CampaignWizardProps) {
  const [step, setStep] = useState<WizardStep>(1);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<CampaignData>({
    name: "",
    goal: "",
    startDate: "",
    endDate: "",
    platforms: [],
    contentTypes: [],
    frequency: "",
    tone: "",
  });

  function update<K extends keyof CampaignData>(key: K, value: CampaignData[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  function toggleArrayItem(key: "platforms" | "contentTypes", item: string) {
    setData((prev) => {
      const arr = prev[key];
      return {
        ...prev,
        [key]: arr.includes(item) ? arr.filter((v) => v !== item) : [...arr, item],
      };
    });
  }

  function canAdvance(): boolean {
    if (step === 1) return data.name.trim().length > 0 && data.goal !== "";
    if (step === 2) return data.platforms.length > 0;
    if (step === 3) return data.contentTypes.length > 0 && data.frequency !== "" && data.tone !== "";
    return true;
  }

  async function submit(asDraft: boolean) {
    setSubmitting(true);
    try {
      const description = JSON.stringify({
        platforms: data.platforms,
        contentTypes: data.contentTypes,
        frequency: data.frequency,
        tone: data.tone,
      });

      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          goal: data.goal,
          description,
          startDate: data.startDate ? new Date(data.startDate).toISOString() : undefined,
          endDate: data.endDate ? new Date(data.endDate).toISOString() : undefined,
          status: asDraft ? "DRAFT" : "ACTIVE",
        }),
      });

      if (res.ok) {
        onCreated?.();
        onClose();
      }
    } catch (err) {
      console.error("Failed to create campaign:", err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-void/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-smoke bg-graphite shadow-2xl shadow-void/60">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-smoke px-6 py-4">
          <h2 className="text-lg font-semibold text-cloud">New Campaign</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ash hover:text-cloud hover:bg-slate transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-2 px-6 pt-5 pb-2">
          {([1, 2, 3, 4] as WizardStep[]).map((s) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div
                className={`
                  flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors
                  ${s < step ? "bg-royal text-white" : ""}
                  ${s === step ? "bg-royal text-white ring-2 ring-royal/30" : ""}
                  ${s > step ? "bg-slate text-ash border border-smoke" : ""}
                `}
              >
                {s < step ? <Check size={14} /> : s}
              </div>
              <span
                className={`text-xs font-medium hidden sm:block ${
                  s === step ? "text-cloud" : "text-ash/60"
                }`}
              >
                {STEP_LABELS[s - 1]}
              </span>
              {s < 4 && (
                <div
                  className={`h-px flex-1 ${
                    s < step ? "bg-royal/40" : "bg-smoke"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="px-6 py-5 min-h-[280px]">
          {/* Step 1: Campaign Basics */}
          {step === 1 && (
            <div className="flex flex-col gap-5">
              <Input
                label="Campaign name"
                placeholder="e.g. Summer Launch 2026"
                value={data.name}
                onChange={(e) => update("name", e.target.value)}
              />

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-cloud">Goal</label>
                <select
                  value={data.goal}
                  onChange={(e) => update("goal", e.target.value)}
                  className="
                    h-10 w-full rounded-lg border border-smoke bg-graphite px-3 text-sm text-cloud
                    transition-colors focus:outline-none focus:ring-2 focus:ring-royal focus:border-transparent
                    cursor-pointer appearance-none
                  "
                >
                  <option value="" disabled className="text-ash">
                    Select a goal...
                  </option>
                  {GOALS.map((g) => (
                    <option key={g} value={g} className="bg-graphite text-cloud">
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Start date"
                  type="date"
                  value={data.startDate}
                  onChange={(e) => update("startDate", e.target.value)}
                />
                <Input
                  label="End date"
                  type="date"
                  value={data.endDate}
                  onChange={(e) => update("endDate", e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Step 2: Platforms */}
          {step === 2 && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-ash">
                Select the platforms you want this campaign to publish on.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {PLATFORMS.map((p) => {
                  const selected = data.platforms.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={!p.connected}
                      onClick={() => toggleArrayItem("platforms", p.id)}
                      className={`
                        flex items-center justify-between rounded-xl border px-4 py-3
                        text-sm font-medium transition-all cursor-pointer
                        disabled:opacity-40 disabled:cursor-not-allowed
                        ${
                          selected
                            ? "border-royal bg-royal/10 text-cloud"
                            : "border-smoke bg-slate/30 text-ash hover:border-ash/40 hover:text-cloud"
                        }
                      `}
                    >
                      <span>{p.label}</span>
                      <Badge variant={p.connected ? "mint" : "default"}>
                        {p.connected ? "connected" : "not linked"}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 3: Content Strategy */}
          {step === 3 && (
            <div className="flex flex-col gap-5">
              {/* Content types */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-cloud">Content types</label>
                <div className="flex gap-3">
                  {CONTENT_TYPES.map((ct) => {
                    const selected = data.contentTypes.includes(ct);
                    return (
                      <button
                        key={ct}
                        type="button"
                        onClick={() => toggleArrayItem("contentTypes", ct)}
                        className={`
                          flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium
                          transition-all cursor-pointer
                          ${
                            selected
                              ? "border-royal bg-royal/10 text-cloud"
                              : "border-smoke bg-slate/30 text-ash hover:border-ash/40 hover:text-cloud"
                          }
                        `}
                      >
                        {ct}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Frequency */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-cloud">Posting frequency</label>
                <div className="grid grid-cols-2 gap-3">
                  {FREQUENCIES.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => update("frequency", f.id)}
                      className={`
                        rounded-lg border px-4 py-2.5 text-sm font-medium
                        transition-all cursor-pointer
                        ${
                          data.frequency === f.id
                            ? "border-royal bg-royal/10 text-cloud"
                            : "border-smoke bg-slate/30 text-ash hover:border-ash/40 hover:text-cloud"
                        }
                      `}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tone */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-cloud">Tone</label>
                <div className="grid grid-cols-2 gap-3">
                  {TONES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => update("tone", t)}
                      className={`
                        rounded-lg border px-4 py-2.5 text-sm font-medium
                        transition-all cursor-pointer
                        ${
                          data.tone === t
                            ? "border-royal bg-royal/10 text-cloud"
                            : "border-smoke bg-slate/30 text-ash hover:border-ash/40 hover:text-cloud"
                        }
                      `}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Review & Launch */}
          {step === 4 && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-ash mb-1">Review your campaign before launching.</p>

              <div className="rounded-xl border border-smoke bg-slate/20 p-4 flex flex-col gap-3">
                <ReviewRow label="Name" value={data.name} />
                <ReviewRow label="Goal" value={data.goal} />
                <ReviewRow
                  label="Dates"
                  value={
                    data.startDate
                      ? `${data.startDate}${data.endDate ? ` to ${data.endDate}` : ""}`
                      : "Not scheduled"
                  }
                />
                <ReviewRow
                  label="Platforms"
                  value={
                    data.platforms
                      .map((id) => PLATFORMS.find((p) => p.id === id)?.label ?? id)
                      .join(", ") || "None"
                  }
                />
                <ReviewRow label="Content" value={data.contentTypes.join(", ") || "None"} />
                <ReviewRow
                  label="Frequency"
                  value={FREQUENCIES.find((f) => f.id === data.frequency)?.label ?? "Not set"}
                />
                <ReviewRow label="Tone" value={data.tone || "Not set"} />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-smoke px-6 py-4">
          <div>
            {step > 1 && (
              <Button
                variant="ghost"
                size="sm"
                icon={<ChevronLeft size={14} />}
                onClick={() => setStep((s) => (s - 1) as WizardStep)}
              >
                Back
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {step === 4 ? (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Save size={14} />}
                  onClick={() => submit(true)}
                  loading={submitting}
                >
                  Save as Draft
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Rocket size={14} />}
                  onClick={() => submit(false)}
                  loading={submitting}
                >
                  Launch Campaign
                </Button>
              </>
            ) : (
              <Button
                variant="primary"
                size="sm"
                icon={<ChevronRight size={14} />}
                onClick={() => setStep((s) => (s + 1) as WizardStep)}
                disabled={!canAdvance()}
              >
                Next
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs font-medium text-ash shrink-0">{label}</span>
      <span className="text-sm text-cloud text-right">{value}</span>
    </div>
  );
}
