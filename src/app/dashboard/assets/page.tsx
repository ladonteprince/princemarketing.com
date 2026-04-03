"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  ImageIcon,
  Video,
  Music,
  FileText,
  Download,
  Trash2,
  Search,
  Filter,
  Loader2,
  AlertCircle,
  ExternalLink,
  Film,
  Upload,
} from "lucide-react";

type AssetType = "image" | "video" | "audio" | "copy";

type Asset = {
  id: string;
  type: AssetType;
  status: string;
  url?: string;
  content?: string;
  prompt: string;
  createdAt: string;
  score?: number;
  category?: string; // "character" | "prop" | "environment"
};

const TYPE_FILTERS: { label: string; value: AssetType | "all"; icon: React.ElementType }[] = [
  { label: "All", value: "all", icon: Filter },
  { label: "Images", value: "image", icon: ImageIcon },
  { label: "Videos", value: "video", icon: Video },
  { label: "Audio", value: "audio", icon: Music },
  { label: "Copy", value: "copy", icon: FileText },
];

function proxyUrl(url: string): string {
  if (!url) return "";
  // Route through our proxy to avoid CORS issues with .ai domain
  if (url.startsWith("https://princemarketing.ai/")) {
    return `/api/proxy/image?url=${encodeURIComponent(url)}`;
  }
  return url;
}

function handleUseInEditor(asset: Asset) {
  if (asset.type === "video" && asset.url) {
    localStorage.setItem("pm-editor-import", JSON.stringify({
      type: "video",
      url: asset.url,
      prompt: asset.prompt,
    }));
  } else if (asset.type === "image" && asset.url) {
    localStorage.setItem("pm-editor-import", JSON.stringify({
      type: "image",
      url: asset.url,
      prompt: asset.prompt,
    }));
  }
  window.location.href = "/dashboard/video/new";
}

const CATEGORY_TAGS: { value: string; label: string; activeClass: string }[] = [
  { value: "character", label: "Char", activeClass: "bg-royal/20 text-royal" },
  { value: "prop", label: "Prop", activeClass: "bg-amber-500/20 text-amber-400" },
  { value: "environment", label: "Env", activeClass: "bg-emerald-500/20 text-emerald-400" },
];

function AssetCard({
  asset,
  onDownload,
  onDelete,
  onSetCategory,
}: {
  asset: Asset;
  onDownload: (asset: Asset) => void;
  onDelete: (asset: Asset) => void;
  onSetCategory: (assetId: string, category: string | null) => void;
}) {
  const typeIcon: Record<AssetType, React.ElementType> = {
    image: ImageIcon,
    video: Video,
    audio: Music,
    copy: FileText,
  };

  const Icon = typeIcon[asset.type] ?? FileText;
  const displayUrl = asset.url ? proxyUrl(asset.url) : null;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-smoke bg-graphite transition-all duration-200 hover:border-royal/30 hover:shadow-lg hover:shadow-royal/5" data-video-playing="false">
      {/* Thumbnail / Preview */}
      <div className="relative aspect-square w-full overflow-hidden bg-slate/30">
        {asset.type === "image" && displayUrl ? (
          <img
            src={displayUrl}
            alt={asset.prompt}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : asset.type === "video" && displayUrl ? (
          <div className="relative h-full w-full group/video">
            <video
              ref={(el) => {
                if (!el) return;
                el.dataset.assetId = asset.id;
                const card = el.closest('[data-video-playing]') as HTMLElement;
                const overlay = card?.querySelector('[data-play-overlay]') as HTMLElement;
                el.onplay = () => {
                  if (card) card.dataset.videoPlaying = "true";
                };
                el.onpause = () => {
                  if (card) card.dataset.videoPlaying = "false";
                  if (overlay) overlay.style.display = "";
                  el.controls = false;
                };
                el.onended = () => {
                  el.currentTime = 0;
                  if (card) card.dataset.videoPlaying = "false";
                  if (overlay) overlay.style.display = "";
                  el.controls = false;
                };
              }}
              src={displayUrl}
              className="h-full w-full object-cover"
              playsInline
              preload="auto"
            />
            {/* Clickable play button — no native controls until playing */}
            <button
              data-play-overlay
              onClick={(e) => {
                e.stopPropagation();
                const btn = e.currentTarget as HTMLElement;
                const video = btn.closest('[data-video-playing]')?.querySelector("video") as HTMLVideoElement;
                if (video) {
                  video.controls = true;
                  btn.style.display = "none";
                  video.play().catch(() => { btn.style.display = ""; video.controls = false; });
                }
              }}
              className="absolute inset-0 z-10 flex items-center justify-center bg-void/30 transition-opacity cursor-pointer hover:bg-void/20"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-royal/90 shadow-lg shadow-royal/30 transition-transform hover:scale-110">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21" /></svg>
              </div>
            </button>
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Icon size={32} strokeWidth={1.2} className="text-ash/40" />
          </div>
        )}

        {/* Copy content preview for "copy" type */}
        {asset.type === "copy" && asset.content && (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <p className="line-clamp-6 text-xs leading-relaxed text-cloud/80">
              {asset.content}
            </p>
          </div>
        )}

        {/* Hover overlay with actions — hidden while video is playing */}
        <div className="absolute top-0 right-0 z-20 flex items-start justify-end gap-1.5 p-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-data-[video-playing=true]:!hidden">
          {displayUrl && (
            <>
              {(asset.type === "video" || asset.type === "image") && (
                <button
                  onClick={() => handleUseInEditor(asset)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-graphite/90 text-cloud backdrop-blur-sm transition-colors hover:bg-royal cursor-pointer"
                  title="Use in Video Editor"
                >
                  <Film size={14} strokeWidth={1.5} />
                </button>
              )}
              <button
                onClick={() => onDownload(asset)}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-graphite/90 text-cloud backdrop-blur-sm transition-colors hover:bg-royal cursor-pointer"
                title="Download"
              >
                <Download size={14} strokeWidth={1.5} />
              </button>
              <a
                href={displayUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-graphite/90 text-cloud backdrop-blur-sm transition-colors hover:bg-royal"
                title="Open in new tab"
              >
                <ExternalLink size={14} strokeWidth={1.5} />
              </a>
              <button
                onClick={() => onDelete(asset)}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-graphite/90 text-cloud backdrop-blur-sm transition-colors hover:bg-red-500/80 cursor-pointer"
                title="Delete"
              >
                <Trash2 size={14} strokeWidth={1.5} />
              </button>
            </>
          )}
        </div>

        {/* Score badge */}
        {asset.score != null && asset.score > 0 && (
          <div className="absolute left-2 top-2 rounded-md bg-void/80 px-1.5 py-0.5 text-[10px] font-semibold text-cloud backdrop-blur-sm">
            {asset.score}/10
          </div>
        )}

        {/* Status badge */}
        {asset.status && asset.status !== "completed" && (
          <div className="absolute right-2 top-2 rounded-md bg-amber-500/80 px-1.5 py-0.5 text-[10px] font-semibold text-void backdrop-blur-sm capitalize">
            {asset.status}
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="flex flex-col gap-1 p-3">
        <div className="flex items-center gap-1.5">
          <Icon size={12} strokeWidth={1.5} className="shrink-0 text-ash/60" />
          <span className="text-[10px] uppercase tracking-widest text-ash/60 font-medium">
            {asset.type}
          </span>
          <span className="ml-auto text-[10px] text-ash/40">
            {new Date(asset.createdAt).toLocaleDateString()}
          </span>
        </div>
        {/* Category tags */}
        <div className="flex items-center gap-1">
          {CATEGORY_TAGS.map((cat) => (
            <button
              key={cat.value}
              onClick={(e) => {
                e.stopPropagation();
                onSetCategory(asset.id, asset.category === cat.value ? null : cat.value);
              }}
              className={`rounded-full px-1.5 py-0 text-[8px] font-medium transition-colors cursor-pointer ${
                asset.category === cat.value
                  ? cat.activeClass
                  : "bg-slate/30 text-ash/40 hover:text-ash"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
        <p className="line-clamp-2 text-xs text-cloud/80 leading-relaxed">
          {asset.prompt}
        </p>
      </div>
    </div>
  );
}

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<AssetType | "all">("all");
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function fetchAssets() {
      try {
        setLoading(true);
        const res = await fetch("/api/user/assets?limit=100");
        if (!res.ok) {
          throw new Error("Failed to load assets");
        }
        const data = await res.json();
        setAssets(data.assets ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load assets");
      } finally {
        setLoading(false);
      }
    }
    fetchAssets();
  }, []);

  const filtered = useMemo(() => {
    let result = assets;
    if (activeFilter !== "all") {
      result = result.filter((a) => a.type === activeFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((a) => a.prompt.toLowerCase().includes(q));
    }
    return result;
  }, [assets, activeFilter, search]);

  const handleSetCategory = async (assetId: string, category: string | null) => {
    // Optimistically update the UI
    setAssets((prev) =>
      prev.map((a) => (a.id === assetId ? { ...a, category: category ?? undefined } : a)),
    );
    try {
      const res = await fetch(`/api/user/assets/${assetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category }),
      });
      if (!res.ok) {
        // Revert on failure
        setAssets((prev) =>
          prev.map((a) => (a.id === assetId ? { ...a, category: undefined } : a)),
        );
      }
    } catch {
      // Revert on error
      setAssets((prev) =>
        prev.map((a) => (a.id === assetId ? { ...a, category: undefined } : a)),
      );
    }
  };

  const handleDelete = async (asset: Asset) => {
    if (!window.confirm("Delete this asset?")) return;
    try {
      const res = await fetch(`/api/user/assets/${asset.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete asset");
      setAssets((prev) => prev.filter((a) => a.id !== asset.id));
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const blobUrl = URL.createObjectURL(file);
      const isVideo = file.type.startsWith("video/");
      const newAsset: Asset = {
        id: crypto.randomUUID(),
        type: isVideo ? "video" : "image",
        status: "completed",
        url: blobUrl,
        prompt: file.name,
        createdAt: new Date().toISOString(),
      };
      setAssets((prev) => [newAsset, ...prev]);
    } finally {
      setUploading(false);
      if (uploadInputRef.current) uploadInputRef.current.value = "";
    }
  };

  const handleDownload = (asset: Asset) => {
    if (!asset.url) return;
    const a = document.createElement("a");
    a.href = proxyUrl(asset.url);
    a.download = `${asset.type}-${asset.id}`;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Count per type for badges
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: assets.length };
    for (const a of assets) {
      c[a.type] = (c[a.type] ?? 0) + 1;
    }
    return c;
  }, [assets]);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-smoke px-6 py-5">
        <h1 className="text-lg font-semibold text-cloud">Assets</h1>
        <p className="mt-1 text-sm text-ash">
          Browse and reuse all your generated content
        </p>
      </div>

      {/* Toolbar: filters + search */}
      <div className="shrink-0 border-b border-smoke px-6 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Type filters */}
          <div className="flex items-center gap-1.5">
            {TYPE_FILTERS.map((f) => {
              const Icon = f.icon;
              const isActive = activeFilter === f.value;
              const count = counts[f.value] ?? 0;

              return (
                <button
                  key={f.value}
                  onClick={() => setActiveFilter(f.value)}
                  className={`
                    flex items-center gap-1.5 rounded-lg px-3 py-1.5
                    text-xs font-medium transition-colors duration-150 cursor-pointer
                    ${
                      isActive
                        ? "bg-royal-muted text-royal"
                        : "text-ash hover:text-cloud hover:bg-slate"
                    }
                  `}
                >
                  <Icon size={14} strokeWidth={1.5} />
                  <span>{f.label}</span>
                  {count > 0 && (
                    <span
                      className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] leading-none ${
                        isActive ? "bg-royal/20 text-royal" : "bg-smoke text-ash"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Search + Upload */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search
                size={14}
                strokeWidth={1.5}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-ash"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by prompt..."
                className="
                  w-full rounded-lg border border-smoke bg-slate/30 py-1.5 pl-8 pr-3
                  text-xs text-cloud placeholder:text-ash/50
                  outline-none transition-colors focus:border-royal/40 focus:bg-slate/50
                  sm:w-64
                "
              />
            </div>
            <input
              ref={uploadInputRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={handleUpload}
            />
            <button
              onClick={() => uploadInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 rounded-lg bg-royal px-3 py-1.5 text-xs font-medium text-cloud transition-colors hover:bg-royal/80 disabled:opacity-50 cursor-pointer"
            >
              {uploading ? (
                <Loader2 size={14} strokeWidth={1.5} className="animate-spin" />
              ) : (
                <Upload size={14} strokeWidth={1.5} />
              )}
              <span>Upload</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 size={24} className="animate-spin text-royal" />
          </div>
        ) : error ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
            <AlertCircle size={28} strokeWidth={1.2} className="text-red-400" />
            <p className="text-sm text-ash">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 rounded-lg bg-royal px-4 py-1.5 text-xs font-medium text-cloud transition-colors hover:bg-royal/80 cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
            <ImageIcon size={32} strokeWidth={1} className="text-ash/30" />
            <p className="text-sm text-ash">
              {assets.length === 0
                ? "No assets yet. Generate content from the Workspace to see it here."
                : "No assets match your filters."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {filtered.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                onDownload={handleDownload}
                onDelete={handleDelete}
                onSetCategory={handleSetCategory}
              />
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
