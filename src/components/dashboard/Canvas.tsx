"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  ImageIcon,
  Video,
  FileText,
  Send,
  BarChart3,
  GripVertical,
  Trash2,
  Film,
  Sparkles,
  MessageSquarePlus,
  Wand2,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { ContentNode, ContentNodeType } from "@/types/canvas";
import type { LucideIcon } from "lucide-react";

type CanvasProps = {
  nodes: ContentNode[];
  onNodeClick: (node: ContentNode) => void;
  onNodeMove: (nodeId: string, position: { x: number; y: number }) => void;
  onNodeDelete: (nodeId: string) => void;
};

const NODE_ICONS: Record<ContentNodeType, LucideIcon> = {
  image: ImageIcon,
  video: Video,
  copy: FileText,
  post: Send,
  kpi: BarChart3,
};

const NODE_GRADIENT_BORDERS: Record<ContentNodeType, string> = {
  image: "from-violet-500/50 via-violet-500/20 to-transparent",
  video: "from-rose-500/50 via-rose-500/20 to-transparent",
  copy: "from-sky-500/50 via-sky-500/20 to-transparent",
  post: "from-emerald-500/50 via-emerald-500/20 to-transparent",
  kpi: "from-amber-500/50 via-amber-500/20 to-transparent",
};

const NODE_COLORS: Record<ContentNodeType, string> = {
  image: "border-violet-500/30 hover:border-violet-500/60",
  video: "border-rose-500/30 hover:border-rose-500/60",
  copy: "border-sky-500/30 hover:border-sky-500/60",
  post: "border-emerald-500/30 hover:border-emerald-500/60",
  kpi: "border-amber-500/30 hover:border-amber-500/60",
};

const NODE_GLOW: Record<ContentNodeType, string> = {
  image: "hover:shadow-violet-500/15",
  video: "hover:shadow-rose-500/15",
  copy: "hover:shadow-sky-500/15",
  post: "hover:shadow-emerald-500/15",
  kpi: "hover:shadow-amber-500/15",
};

const STATUS_BADGE: Record<string, "default" | "royal" | "mint" | "amber"> = {
  draft: "default",
  scheduled: "amber",
  published: "mint",
};

const STATUS_STYLES: Record<string, string> = {
  draft: "",
  ready: "ring-1 ring-emerald-400/30",
  generating: "ring-1 ring-amber-400/40 animate-pulse",
};

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function NodeCard({
  node,
  onClick,
  onMove,
  onDelete,
}: {
  node: ContentNode;
  onClick: () => void;
  onMove: (pos: { x: number; y: number }) => void;
  onDelete: () => void;
}) {
  const Icon = NODE_ICONS[node.type];
  const dragRef = useRef<{ startX: number; startY: number; nodeX: number; nodeY: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest("[data-action]")) return;
      e.preventDefault();
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        nodeX: node.position.x,
        nodeY: node.position.y,
      };

      const handleMouseMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        const dx = ev.clientX - dragRef.current.startX;
        const dy = ev.clientY - dragRef.current.startY;
        onMove({
          x: dragRef.current.nodeX + dx,
          y: dragRef.current.nodeY + dy,
        });
      };

      const handleMouseUp = () => {
        dragRef.current = null;
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [node.position, onMove],
  );

  return (
    <div
      ref={cardRef}
      onMouseDown={handleMouseDown}
      style={{
        position: "absolute",
        left: node.position.x,
        top: node.position.y,
        width: 240,
      }}
      className={`
        group rounded-2xl border bg-graphite/95 backdrop-blur-md
        shadow-lg shadow-void/60
        transition-all duration-200 ease-out
        hover:shadow-2xl ${NODE_GLOW[node.type]}
        hover:scale-[1.02] hover:-translate-y-0.5
        cursor-grab active:cursor-grabbing select-none
        ${NODE_COLORS[node.type]}
        ${STATUS_STYLES[node.status] ?? ""}
      `}
    >
      {/* Gradient accent line at top */}
      <div className={`absolute inset-x-0 top-0 h-[2px] rounded-t-2xl bg-gradient-to-r ${NODE_GRADIENT_BORDERS[node.type]}`} />

      {/* Thumbnail area */}
      <div
        className="relative flex h-32 items-center justify-center rounded-t-2xl bg-slate/60 overflow-hidden"
        onClick={onClick}
        data-action="open"
      >
        {node.thumbnail ? (
          <>
            <img
              src={node.thumbnail}
              alt={node.title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            {/* Subtle overlay gradient for readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-void/40 via-transparent to-transparent" />
          </>
        ) : node.type === "video" ? (
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/20">
              <Film size={24} strokeWidth={1.2} className="text-rose-400/60" />
            </div>
            <span className="text-[10px] text-ash/50 uppercase tracking-widest">Video</span>
          </div>
        ) : node.type === "copy" ? (
          <div className="px-4 py-3 w-full">
            <p className="text-xs text-ash/60 leading-relaxed line-clamp-3 italic">
              {node.title ? `"${node.title.slice(0, 80)}${node.title.length > 80 ? "..." : ""}"` : "Empty draft"}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-royal-muted border border-royal/20">
              <Icon size={24} strokeWidth={1.2} className="text-ash/40" />
            </div>
            <span className="text-[10px] text-ash/50 uppercase tracking-widest">{node.type}</span>
          </div>
        )}

        {/* Type badge overlay */}
        <div className="absolute top-2.5 left-2.5">
          <Badge variant="royal" className="text-[9px] uppercase tracking-wider backdrop-blur-sm">
            {node.type}
          </Badge>
        </div>

        {/* Delete button */}
        <button
          data-action="delete"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="
            absolute top-2.5 right-2.5 flex h-6 w-6 items-center justify-center
            rounded-lg bg-void/70 backdrop-blur-sm text-ash
            opacity-0 group-hover:opacity-100
            hover:bg-coral/20 hover:text-coral
            transition-all duration-200 cursor-pointer
          "
        >
          <Trash2 size={12} strokeWidth={1.5} />
        </button>

        {/* Video film strip overlay */}
        {node.type === "video" && node.thumbnail && (
          <div className="absolute bottom-2 right-2 flex h-6 w-6 items-center justify-center rounded-md bg-void/60 backdrop-blur-sm">
            <Film size={12} strokeWidth={1.5} className="text-rose-400" />
          </div>
        )}
      </div>

      {/* Info area */}
      <div className="px-3.5 py-3">
        <p className="truncate text-sm font-medium text-cloud leading-tight">{node.title}</p>
        <div className="mt-2 flex items-center justify-between">
          <Badge variant={STATUS_BADGE[node.status] ?? "default"} className="text-[9px]">
            {node.status}
          </Badge>
          <span className="text-[10px] text-ash/60 font-mono">{formatTimeAgo(node.createdAt)}</span>
        </div>
      </div>

      {/* Drag handle */}
      <div className="absolute -top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-70 transition-opacity duration-200">
        <div className="flex h-5 w-8 items-center justify-center rounded-full bg-slate/80 backdrop-blur-sm border border-smoke/50">
          <GripVertical size={12} className="text-ash" />
        </div>
      </div>
    </div>
  );
}

// SVG connection lines between nodes
function ConnectionLines({ nodes }: { nodes: ContentNode[] }) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  const lines: { x1: number; y1: number; x2: number; y2: number; key: string }[] = [];

  for (const node of nodes) {
    for (const targetId of node.connections) {
      const target = nodeMap.get(targetId);
      if (!target) continue;
      // Line from center-right of source to center-left of target
      lines.push({
        x1: node.position.x + 220,
        y1: node.position.y + 80,
        x2: target.position.x,
        y2: target.position.y + 80,
        key: `${node.id}-${targetId}`,
      });
    }
  }

  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full">
      <defs>
        <linearGradient id="line-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--color-royal)" stopOpacity="0.5" />
          <stop offset="50%" stopColor="var(--color-royal)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--color-royal)" stopOpacity="0.1" />
        </linearGradient>
        <filter id="line-glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {lines.map((l) => {
        const midX = (l.x1 + l.x2) / 2;
        return (
          <g key={l.key}>
            {/* Glow layer */}
            <path
              d={`M ${l.x1} ${l.y1} C ${midX} ${l.y1}, ${midX} ${l.y2}, ${l.x2} ${l.y2}`}
              stroke="var(--color-royal)"
              strokeOpacity="0.08"
              strokeWidth={6}
              fill="none"
              filter="url(#line-glow)"
            />
            {/* Main curved line */}
            <path
              d={`M ${l.x1} ${l.y1} C ${midX} ${l.y1}, ${midX} ${l.y2}, ${l.x2} ${l.y2}`}
              stroke="url(#line-gradient)"
              strokeWidth={1.5}
              strokeDasharray="8 4"
              fill="none"
            />
            {/* Endpoint dots */}
            <circle cx={l.x1} cy={l.y1} r="3" fill="var(--color-royal)" fillOpacity="0.4" />
            <circle cx={l.x2} cy={l.y2} r="3" fill="var(--color-royal)" fillOpacity="0.2" />
          </g>
        );
      })}
    </svg>
  );
}

export function Canvas({ nodes, onNodeClick, onNodeMove, onNodeDelete }: CanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });

  // Pan the canvas with middle-click or alt+click
  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        e.preventDefault();
        isPanning.current = true;
        panStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };

        const handleMove = (ev: MouseEvent) => {
          if (!isPanning.current) return;
          setOffset({
            x: ev.clientX - panStart.current.x,
            y: ev.clientY - panStart.current.y,
          });
        };

        const handleUp = () => {
          isPanning.current = false;
          window.removeEventListener("mousemove", handleMove);
          window.removeEventListener("mouseup", handleUp);
        };

        window.addEventListener("mousemove", handleMove);
        window.addEventListener("mouseup", handleUp);
      }
    },
    [offset],
  );

  return (
    <div
      ref={canvasRef}
      onMouseDown={handleCanvasMouseDown}
      className="relative h-full w-full overflow-hidden bg-void"
    >
      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "radial-gradient(circle, var(--color-cloud) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          backgroundPosition: `${offset.x % 32}px ${offset.y % 32}px`,
        }}
      />

      {/* Canvas content with pan offset */}
      <div
        className="absolute inset-0"
        style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
      >
        <ConnectionLines nodes={nodes} />

        {nodes.map((node) => (
          <NodeCard
            key={node.id}
            node={node}
            onClick={() => onNodeClick(node)}
            onMove={(pos) => onNodeMove(node.id, pos)}
            onDelete={() => onNodeDelete(node.id)}
          />
        ))}
      </div>

      {/* Empty state */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center max-w-sm px-6">
            {/* Animated orbiting icons */}
            <div className="relative mx-auto mb-8 h-32 w-32">
              {/* Center icon */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-royal/20 to-violet-600/10 border border-royal/20 shadow-lg shadow-royal/5">
                  <Sparkles size={28} strokeWidth={1.2} className="text-royal" />
                </div>
              </div>
              {/* Orbiting nodes */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10 border border-violet-500/15">
                <ImageIcon size={14} strokeWidth={1.5} className="text-violet-400/60" />
              </div>
              <div className="absolute bottom-2 left-0 flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10 border border-rose-500/15">
                <Video size={14} strokeWidth={1.5} className="text-rose-400/60" />
              </div>
              <div className="absolute bottom-2 right-0 flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 border border-sky-500/15">
                <FileText size={14} strokeWidth={1.5} className="text-sky-400/60" />
              </div>
              {/* Connecting dashed lines */}
              <svg className="absolute inset-0 h-full w-full pointer-events-none" viewBox="0 0 128 128">
                <line x1="64" y1="40" x2="64" y2="32" stroke="var(--color-royal)" strokeOpacity="0.15" strokeWidth="1" strokeDasharray="3 2" />
                <line x1="48" y1="72" x2="16" y2="96" stroke="var(--color-royal)" strokeOpacity="0.15" strokeWidth="1" strokeDasharray="3 2" />
                <line x1="80" y1="72" x2="112" y2="96" stroke="var(--color-royal)" strokeOpacity="0.15" strokeWidth="1" strokeDasharray="3 2" />
              </svg>
            </div>

            <h3 className="text-base font-semibold text-cloud/90 mb-2">
              Your creative canvas awaits
            </h3>
            <p className="text-sm text-ash leading-relaxed mb-6">
              Describe what you need in the chat panel — images, videos, copy, and posts will appear here as visual nodes you can arrange and connect.
            </p>

            {/* Prompt suggestions */}
            <div className="flex flex-col gap-2">
              {[
                { icon: ImageIcon, text: "Generate a hero image for my campaign" },
                { icon: FileText, text: "Write social copy for a product launch" },
                { icon: Video, text: "Create a 15s promo video concept" },
              ].map((suggestion) => {
                const SIcon = suggestion.icon;
                return (
                  <div
                    key={suggestion.text}
                    className="flex items-center gap-2.5 rounded-xl border border-smoke/60 bg-slate/30 px-3.5 py-2.5 text-left transition-all duration-200 hover:border-royal/20 hover:bg-slate/50 cursor-default"
                  >
                    <SIcon size={14} strokeWidth={1.5} className="text-royal/50 shrink-0" />
                    <span className="text-xs text-ash/70">{suggestion.text}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
