"use client";

// WHY: Production cast / props / environments library. The "featured cast"
// management surface — recurring references the user can pull into any
// storyboard via @handle. Three tabs share the same card grid + add-new
// dialog; the only difference is the AssetKind they filter for.

import { useEffect, useState, useCallback } from "react";
import {
  Sparkles,
  Plus,
  Trash2,
  Loader2,
  Image as ImageIcon,
  AlertCircle,
} from "lucide-react";

type Category = "character" | "prop" | "environment";

type CastMember = {
  id: string;
  handle: string | null;
  category: Category;
  label: string | null;
  sheetImageUrl: string;
  sourcePhotoUrls: string[];
  description: string | null;
  directorDefaults: Record<string, string>;
  projectId: string | null;
  createdAt: string;
};

const TABS: Array<{ key: Category; label: string; hint: string }> = [
  {
    key: "character",
    label: "Cast",
    hint: "Recurring people — yourself, alter-egos, talent. Multi-angle turnaround per member.",
  },
  {
    key: "prop",
    label: "Props",
    hint: "Wardrobe, products, hero objects. Front / side / back / detail views.",
  },
  {
    key: "environment",
    label: "Environments",
    hint: "Locations and sets. Panoramic spatial reference.",
  },
];

// ─── Helper: orchestrate photo upload → sheet generation → save ──────────

async function uploadOnePhoto(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  form.append(
    "metadata",
    JSON.stringify({
      kind: "IMAGE_STILL",
      title: file.name,
    }),
  );
  const res = await fetch("/api/assets/upload", { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `Upload failed (${res.status})`);
  }
  const json = await res.json();
  const url = json?.asset?.publicUrl ?? json?.publicUrl ?? json?.url;
  if (!url) throw new Error("Upload returned no public URL");
  return url;
}

async function generateSheet(
  imageUrls: string[],
  category: Category,
  label: string,
  description?: string,
): Promise<string> {
  const res = await fetch("/api/generate/reference-sheet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imageUrls,
      category,
      label,
      description,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `Sheet API failed (${res.status})`);
  }
  const json = await res.json();
  if (json.imageUrl) return json.imageUrl as string;

  // WHY: Async path — poll the SSE stream URL until the sheet is ready.
  const streamUrl = json.streamUrl ?? json.pollUrl;
  if (!streamUrl) throw new Error("Sheet API returned no imageUrl or streamUrl");
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 2500));
    const pollRes = await fetch(streamUrl);
    if (!pollRes.ok) continue;
    const data = await pollRes.json().catch(() => ({}));
    const url =
      data.imageUrl ?? data.resultUrl ?? data?.data?.imageUrl ?? data?.data?.resultUrl;
    if (url) return url as string;
    if (data.status === "failed") {
      throw new Error(data.error ?? "Sheet generation failed");
    }
  }
  throw new Error("Sheet generation timed out after 2.5 min");
}

// ─── Page ────────────────────────────────────────────────────────────────

export default function CastPage() {
  const [activeTab, setActiveTab] = useState<Category>("character");
  const [cast, setCast] = useState<Record<Category, CastMember[]>>({
    character: [],
    prop: [],
    environment: [],
  });
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const refresh = useCallback(async (cat: Category) => {
    const res = await fetch(`/api/cast?category=${cat}`);
    if (!res.ok) return;
    const json = await res.json();
    setCast((prev) => ({ ...prev, [cat]: (json.cast ?? []) as CastMember[] }));
  }, []);

  useEffect(() => {
    void Promise.all(
      (["character", "prop", "environment"] as const).map(refresh),
    ).finally(() => setLoading(false));
  }, [refresh]);

  const handleDelete = useCallback(
    async (id: string, category: Category) => {
      if (!confirm("Delete this cast member? This can't be undone.")) return;
      const res = await fetch(`/api/cast/${id}`, { method: "DELETE" });
      if (res.ok) {
        setCast((prev) => ({
          ...prev,
          [category]: prev[category].filter((c) => c.id !== id),
        }));
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "Delete failed");
      }
    },
    [],
  );

  const activeHint = TABS.find((t) => t.key === activeTab)?.hint ?? "";
  const activeList = cast[activeTab];

  return (
    <div className="min-h-screen bg-void px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Sparkles size={24} className="text-royal" strokeWidth={1.5} />
            <h1 className="text-2xl font-bold text-cloud">Cast</h1>
          </div>
          <p className="text-sm text-ash max-w-2xl">
            Your production library. Add recurring people, props, and
            environments once — pull them into any storyboard with{" "}
            <code className="text-cloud bg-slate px-1 rounded">@handle</code>.
            Each member gets a canonical multi-angle reference sheet.
          </p>
        </header>

        {/* Tabs */}
        <div className="mb-4 flex items-center gap-1 border-b border-smoke">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`
                px-4 py-2 text-sm font-medium cursor-pointer
                border-b-2 -mb-px transition-colors duration-[var(--transition-micro)]
                ${
                  activeTab === t.key
                    ? "border-royal text-cloud"
                    : "border-transparent text-ash hover:text-cloud"
                }
              `}
            >
              {t.label}
              {cast[t.key].length > 0 && (
                <span className="ml-2 text-xs text-ash/60">
                  {cast[t.key].length}
                </span>
              )}
            </button>
          ))}
          <div className="ml-auto">
            <button
              onClick={() => setShowAdd((v) => !v)}
              className="
                inline-flex items-center gap-1.5 rounded-lg
                bg-royal px-3 py-1.5 text-xs font-medium text-white
                hover:bg-royal/90 cursor-pointer
                transition-colors duration-[var(--transition-micro)]
              "
            >
              <Plus size={12} strokeWidth={2} />
              Add{" "}
              {activeTab === "character"
                ? "cast"
                : activeTab === "prop"
                  ? "prop"
                  : "environment"}
            </button>
          </div>
        </div>

        <p className="mb-4 text-xs text-ash">{activeHint}</p>

        {/* Add-new form (inline) */}
        {showAdd && (
          <AddCastForm
            category={activeTab}
            onCancel={() => setShowAdd(false)}
            onCreated={(member) => {
              setCast((prev) => ({
                ...prev,
                [member.category]: [member, ...prev[member.category]],
              }));
              setShowAdd(false);
            }}
          />
        )}

        {/* Gallery */}
        {loading ? (
          <div className="flex h-32 items-center justify-center text-xs text-ash">
            <Loader2 size={14} className="mr-2 animate-spin" /> Loading…
          </div>
        ) : activeList.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-xs text-ash">
            <ImageIcon size={14} className="mr-2" />
            No {activeTab === "character"
              ? "cast members"
              : activeTab === "prop"
                ? "props"
                : "environments"}{" "}
            yet. Click &quot;Add&quot; above to onboard one.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeList.map((m) => (
              <CastCard
                key={m.id}
                member={m}
                onDelete={() => handleDelete(m.id, m.category)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Cast card ──────────────────────────────────────────────────────── */

function CastCard({
  member,
  onDelete,
}: {
  member: CastMember;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-lg border border-smoke bg-graphite/60 overflow-hidden">
      <div className="aspect-video bg-void overflow-hidden">
        {member.sheetImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={member.sheetImageUrl}
            alt={member.label ?? member.handle ?? "cast member"}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-ash">
            <ImageIcon size={20} />
          </div>
        )}
      </div>
      <div className="p-3 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-cloud truncate">
            {member.label ?? "Untitled"}
          </span>
          {member.handle && (
            <code className="shrink-0 text-[10px] text-royal bg-royal/10 rounded px-1.5 py-0.5">
              @{member.handle}
            </code>
          )}
        </div>
        {member.description && (
          <p className="text-xs text-ash line-clamp-2">{member.description}</p>
        )}
        <div className="flex justify-end">
          <button
            onClick={onDelete}
            className="
              flex items-center gap-1 text-[10px] text-ash hover:text-red-400
              cursor-pointer transition-colors duration-[var(--transition-micro)]
            "
            aria-label="Delete cast member"
          >
            <Trash2 size={10} />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Add-new form ───────────────────────────────────────────────────── */

function AddCastForm({
  category,
  onCancel,
  onCreated,
}: {
  category: Category;
  onCancel: () => void;
  onCreated: (member: CastMember) => void;
}) {
  const [handle, setHandle] = useState("");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [stage, setStage] = useState<
    "idle" | "uploading" | "generating" | "saving" | "done" | "failed"
  >("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async () => {
    setError(null);
    if (!handle.trim()) {
      setError("Handle is required");
      return;
    }
    if (!label.trim()) {
      setError("Label is required");
      return;
    }
    if (files.length === 0) {
      setError("Pick at least one source photo");
      return;
    }
    try {
      setStage("uploading");
      const photoUrls = await Promise.all(files.map(uploadOnePhoto));

      setStage("generating");
      const sheetImageUrl = await generateSheet(
        photoUrls,
        category,
        label.trim(),
        description.trim() || undefined,
      );

      setStage("saving");
      const res = await fetch("/api/cast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle: handle.trim().toLowerCase(),
          category,
          label: label.trim(),
          description: description.trim() || undefined,
          sheetImageUrl,
          sourcePhotoUrls: photoUrls,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Save failed (${res.status})`);
      }
      const json = await res.json();
      setStage("done");
      onCreated(json.cast as CastMember);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      setStage("failed");
    }
  }, [handle, label, description, files, category, onCreated]);

  const busy = ["uploading", "generating", "saving"].includes(stage);

  return (
    <div className="mb-6 rounded-xl border border-smoke bg-graphite/60 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-cloud">
        Onboard new{" "}
        {category === "character"
          ? "cast member"
          : category === "prop"
            ? "prop"
            : "environment"}
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-[10px] text-ash uppercase tracking-wide">
            Handle
          </span>
          <input
            type="text"
            value={handle}
            onChange={(e) =>
              setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))
            }
            placeholder="ladonte"
            className="
              mt-1 w-full bg-void/50 border border-smoke rounded
              px-2 py-1.5 text-xs text-cloud placeholder:text-ash/50
              focus:outline-none focus:border-royal
            "
            disabled={busy}
          />
        </label>
        <label className="block">
          <span className="text-[10px] text-ash uppercase tracking-wide">
            Display label
          </span>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="LaDonte Prince"
            className="
              mt-1 w-full bg-void/50 border border-smoke rounded
              px-2 py-1.5 text-xs text-cloud placeholder:text-ash/50
              focus:outline-none focus:border-royal
            "
            disabled={busy}
          />
        </label>
      </div>

      <label className="block">
        <span className="text-[10px] text-ash uppercase tracking-wide">
          Description (optional)
        </span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Mid-30s, dark complexion, athletic build, often in tailored neutrals…"
          rows={2}
          className="
            mt-1 w-full bg-void/50 border border-smoke rounded
            px-2 py-1.5 text-xs text-cloud placeholder:text-ash/50
            focus:outline-none focus:border-royal resize-none
          "
          disabled={busy}
        />
      </label>

      <label className="block">
        <span className="text-[10px] text-ash uppercase tracking-wide">
          Source photos (1–20)
        </span>
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          className="mt-1 block w-full text-xs text-ash file:mr-2 file:rounded file:border file:border-smoke file:bg-graphite/40 file:px-2 file:py-1 file:text-xs file:text-cloud"
          disabled={busy}
        />
        {files.length > 0 && (
          <p className="mt-1 text-[10px] text-ash">
            {files.length} file{files.length > 1 ? "s" : ""} selected
          </p>
        )}
      </label>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-400/30 bg-red-500/10 p-2 text-xs text-red-300">
          <AlertCircle size={12} strokeWidth={1.5} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-ash">
          {stage === "uploading" && "Uploading source photos…"}
          {stage === "generating" && "Generating multi-angle sheet via Nano Banana Pro… ~30-60s"}
          {stage === "saving" && "Saving to your cast library…"}
          {stage === "done" && "Done."}
          {stage === "idle" && "Onboarding will upload, generate the sheet, then save."}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="
              px-3 py-1.5 text-xs text-ash hover:text-cloud
              disabled:opacity-50 cursor-pointer
              transition-colors duration-[var(--transition-micro)]
            "
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="
              flex items-center gap-1.5 rounded-lg bg-royal px-3 py-1.5
              text-xs font-medium text-white hover:bg-royal/90
              disabled:opacity-50 cursor-pointer
              transition-colors duration-[var(--transition-micro)]
            "
          >
            {busy ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Plus size={12} strokeWidth={2} />
            )}
            {busy ? "Working…" : "Generate + save"}
          </button>
        </div>
      </div>
    </div>
  );
}
