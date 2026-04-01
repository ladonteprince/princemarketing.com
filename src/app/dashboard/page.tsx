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
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas (fills remaining width) */}
        <div className="flex-1">
          <Canvas
            nodes={nodes}
            onNodeClick={handleNodeClick}
            onNodeMove={handleNodeMove}
            onNodeDelete={handleNodeDelete}
          />
        </div>

        {/* Chat panel */}
        <div
          className={`
            shrink-0 transition-[width] duration-300 ease-in-out
            ${chatCollapsed ? "w-12" : "w-[30%] min-w-[320px] max-w-[480px]"}
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
