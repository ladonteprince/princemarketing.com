"use client";

import { useState, useCallback } from "react";
import { Canvas } from "@/components/dashboard/Canvas";
import { ChatPanel } from "@/components/dashboard/ChatPanel";
import { VideoEditor } from "@/components/dashboard/VideoEditor";
import { KPIBar } from "@/components/dashboard/KPIBar";
import type { ContentNode, CanvasAction, VideoProject } from "@/types/canvas";

export default function DashboardPage() {
  const [nodes, setNodes] = useState<ContentNode[]>([]);
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [videoProjects, setVideoProjects] = useState<Map<string, VideoProject>>(new Map());
  const [activeVideoProject, setActiveVideoProject] = useState<string | null>(null);

  const handleCanvasAction = useCallback(
    (action: CanvasAction) => {
      switch (action.type) {
        case "add-node":
          setNodes((prev) => [...prev, action.node]);
          break;
        case "remove-node":
          setNodes((prev) => prev.filter((n) => n.id !== action.nodeId));
          break;
        case "update-node":
          setNodes((prev) =>
            prev.map((n) =>
              n.id === action.nodeId ? { ...n, ...action.updates } : n,
            ),
          );
          break;
        case "connect-nodes":
          setNodes((prev) =>
            prev.map((n) =>
              n.id === action.fromId
                ? { ...n, connections: [...n.connections, action.toId] }
                : n,
            ),
          );
          break;
        case "open-video-editor":
          setActiveVideoProject(action.videoProjectId);
          break;
      }
    },
    [],
  );

  const handleNodeClick = useCallback(
    (node: ContentNode) => {
      if (node.type === "video" && node.videoProjectId) {
        // Check if project exists in memory, otherwise create one
        if (!videoProjects.has(node.videoProjectId)) {
          const project: VideoProject = {
            id: node.videoProjectId,
            title: node.title,
            scenes: [],
            createdAt: node.createdAt,
          };
          setVideoProjects((prev) => new Map(prev).set(project.id, project));
        }
        setActiveVideoProject(node.videoProjectId);
      }
    },
    [videoProjects],
  );

  const handleNodeMove = useCallback(
    (nodeId: string, position: { x: number; y: number }) => {
      setNodes((prev) =>
        prev.map((n) => (n.id === nodeId ? { ...n, position } : n)),
      );
    },
    [],
  );

  const handleNodeDelete = useCallback((nodeId: string) => {
    setNodes((prev) => {
      const filtered = prev.filter((n) => n.id !== nodeId);
      // Also remove connections referencing this node
      return filtered.map((n) => ({
        ...n,
        connections: n.connections.filter((c) => c !== nodeId),
      }));
    });
  }, []);

  const handleUpdateVideoProject = useCallback((project: VideoProject) => {
    setVideoProjects((prev) => new Map(prev).set(project.id, project));
  }, []);

  const activeProject = activeVideoProject
    ? videoProjects.get(activeVideoProject)
    : null;

  return (
    <div className="flex h-screen flex-col">
      {/* KPI summary bar */}
      <KPIBar />

      {/* Video editor overlay */}
      {activeProject && (
        <div className="border-b border-smoke">
          <VideoEditor
            project={activeProject}
            onUpdateProject={handleUpdateVideoProject}
            onClose={() => setActiveVideoProject(null)}
          />
        </div>
      )}

      {/* Main split panel: Canvas + Chat */}
      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        {/* Canvas (fills remaining width) — on mobile show a simplified node list */}
        <div className="flex-1 min-h-[40vh] lg:min-h-0">
          {/* Spatial canvas for desktop */}
          <div className="hidden h-full lg:block">
            <Canvas
              nodes={nodes}
              onNodeClick={handleNodeClick}
              onNodeMove={handleNodeMove}
              onNodeDelete={handleNodeDelete}
            />
          </div>
          {/* Simplified node list for mobile */}
          <div className="flex h-full flex-col overflow-y-auto bg-void p-4 lg:hidden">
            {nodes.length === 0 ? (
              <div className="flex flex-1 items-center justify-center text-center">
                <div>
                  <p className="text-sm font-medium text-cloud/80">
                    Chat with your AI to create content
                  </p>
                  <p className="mt-1 text-xs text-ash">
                    Content will appear here as cards.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {nodes.map((node) => (
                  <button
                    key={node.id}
                    onClick={() => handleNodeClick(node)}
                    className="flex flex-col items-start rounded-xl border border-smoke bg-graphite/90 p-3 text-left transition-colors hover:border-royal/40"
                  >
                    {node.thumbnail ? (
                      <img
                        src={node.thumbnail}
                        alt={node.title}
                        className="mb-2 h-20 w-full rounded-lg object-cover"
                      />
                    ) : (
                      <div className="mb-2 flex h-20 w-full items-center justify-center rounded-lg bg-slate/60">
                        <span className="text-xs uppercase tracking-wider text-ash/40">{node.type}</span>
                      </div>
                    )}
                    <p className="truncate text-xs font-medium text-cloud">{node.title}</p>
                    <span className="mt-1 text-[10px] text-ash">{node.status}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Chat panel — full width on mobile, side panel on desktop */}
        <div
          className={`
            w-full shrink-0 transition-[width] duration-300 ease-in-out
            lg:w-auto
            ${chatCollapsed ? "lg:w-12" : "lg:w-[30%] lg:min-w-[320px] lg:max-w-[480px]"}
          `}
        >
          <ChatPanel
            collapsed={chatCollapsed}
            onToggle={() => setChatCollapsed((prev) => !prev)}
            onCanvasAction={handleCanvasAction}
            nodes={nodes}
          />
        </div>
      </div>
    </div>
  );
}
