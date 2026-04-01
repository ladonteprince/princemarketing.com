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

const NODE_COLORS: Record<ContentNodeType, string> = {
  image: "border-violet-500/40 hover:border-violet-500/70",
  video: "border-rose-500/40 hover:border-rose-500/70",
  copy: "border-sky-500/40 hover:border-sky-500/70",
  post: "border-emerald-500/40 hover:border-emerald-500/70",
  kpi: "border-amber-500/40 hover:border-amber-500/70",
};

const STATUS_BADGE: Record<string, "default" | "royal" | "mint" | "amber"> = {
  draft: "default",
  scheduled: "amber",
  published: "mint",
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
        width: 220,
      }}
      className={`
        group rounded-xl border bg-graphite/90 backdrop-blur-sm
        shadow-lg shadow-void/50
        transition-shadow duration-200
        hover:shadow-xl hover:shadow-royal/10
        cursor-grab active:cursor-grabbing select-none
        ${NODE_COLORS[node.type]}
      `}
    >
      {/* Thumbnail area */}
      <div
        className="relative flex h-28 items-center justify-center rounded-t-xl bg-slate/60 overflow-hidden"
        onClick={onClick}
        data-action="open"
      >
        {node.thumbnail ? (
          <img
            src={node.thumbnail}
            alt={node.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <Icon size={32} strokeWidth={1} className="text-ash/40" />
        )}
        {/* Type badge overlay */}
        <div className="absolute top-2 left-2">
          <Badge variant="royal" className="text-[10px] uppercase tracking-wider">
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
            absolute top-2 right-2 flex h-6 w-6 items-center justify-center
            rounded-md bg-void/60 text-ash opacity-0 group-hover:opacity-100
            hover:bg-coral/20 hover:text-coral
            transition-all duration-150 cursor-pointer
          "
        >
          <Trash2 size={12} strokeWidth={1.5} />
        </button>
      </div>

      {/* Info area */}
      <div className="px-3 py-2.5">
        <p className="truncate text-sm font-medium text-cloud">{node.title}</p>
        <div className="mt-1.5 flex items-center justify-between">
          <Badge variant={STATUS_BADGE[node.status] ?? "default"} className="text-[10px]">
            {node.status}
          </Badge>
          <span className="text-[10px] text-ash">{formatTimeAgo(node.createdAt)}</span>
        </div>
      </div>

      {/* Drag handle */}
      <div className="absolute -top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
        <GripVertical size={14} className="text-ash" />
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
          <stop offset="0%" stopColor="var(--color-royal)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="var(--color-royal)" stopOpacity="0.15" />
        </linearGradient>
      </defs>
      {lines.map((l) => (
        <line
          key={l.key}
          x1={l.x1}
          y1={l.y1}
          x2={l.x2}
          y2={l.y2}
          stroke="url(#line-gradient)"
          strokeWidth={1.5}
          strokeDasharray="6 4"
        />
      ))}
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
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate/60 border border-smoke">
              <Send size={24} strokeWidth={1} className="text-royal/60" />
            </div>
            <p className="text-sm font-medium text-cloud/80">
              Chat with your AI to create content
            </p>
            <p className="mt-1 text-xs text-ash">
              Describe what you need in the chat panel. Content will appear here as visual nodes.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
