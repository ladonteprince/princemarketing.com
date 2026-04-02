"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Send, ArrowRight } from "lucide-react";
import { Canvas } from "@/components/dashboard/Canvas";
import { ChatPanel } from "@/components/dashboard/ChatPanel";
import { VideoEditor } from "@/components/dashboard/VideoEditor";
import { KPIBar } from "@/components/dashboard/KPIBar";
import { OnboardingChecklist } from "@/components/dashboard/OnboardingChecklist";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import type { ContentNode, CanvasAction, VideoProject, VideoScene } from "@/types/canvas";

const CANVAS_STORAGE_KEY = "pm-canvas-nodes";
const VIDEO_PROJECTS_STORAGE_KEY = "pm-video-projects";
const ACTIVE_VIDEO_STORAGE_KEY = "pm-active-video-project";

// Helpers to serialize/deserialize Map<string, VideoProject> as JSON
function serializeVideoProjects(map: Map<string, VideoProject>): string {
  return JSON.stringify(Array.from(map.entries()));
}

function deserializeVideoProjects(json: string): Map<string, VideoProject> {
  const entries: [string, VideoProject][] = JSON.parse(json);
  return new Map(entries);
}

export default function DashboardPage() {
  const [nodes, setNodes] = useState<ContentNode[]>(() => {
    if (typeof window === "undefined") return [];
    const saved = localStorage.getItem(CANVAS_STORAGE_KEY);
    if (saved) {
      try { return JSON.parse(saved); } catch { /* ignore */ }
    }
    return [];
  });
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [videoProjects, setVideoProjects] = useState<Map<string, VideoProject>>(() => {
    if (typeof window === "undefined") return new Map();
    const saved = localStorage.getItem(VIDEO_PROJECTS_STORAGE_KEY);
    if (saved) {
      try { return deserializeVideoProjects(saved); } catch { /* ignore */ }
    }
    return new Map();
  });
  const [activeVideoProject, setActiveVideoProject] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(ACTIVE_VIDEO_STORAGE_KEY) || null;
  });

  // Recent assets for quick-links strip
  const [recentAssets, setRecentAssets] = useState<
    { id: string; url: string; type: string; name?: string }[]
  >([]);

  // Persist canvas nodes to localStorage
  useEffect(() => {
    localStorage.setItem(CANVAS_STORAGE_KEY, JSON.stringify(nodes));
  }, [nodes]);

  // Persist video projects to localStorage
  useEffect(() => {
    localStorage.setItem(VIDEO_PROJECTS_STORAGE_KEY, serializeVideoProjects(videoProjects));
  }, [videoProjects]);

  // Persist active video project to localStorage
  useEffect(() => {
    if (activeVideoProject) {
      localStorage.setItem(ACTIVE_VIDEO_STORAGE_KEY, activeVideoProject);
    } else {
      localStorage.removeItem(ACTIVE_VIDEO_STORAGE_KEY);
    }
  }, [activeVideoProject]);

  // Fetch recent assets on mount
  useEffect(() => {
    fetch("/api/user/assets?limit=6")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        const assets = data?.assets ?? data;
        if (Array.isArray(assets) && assets.length > 0) setRecentAssets(assets);
      })
      .catch(() => {});
  }, []);

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
          // Ensure the video project exists before opening the editor
          setVideoProjects((prev) => {
            if (!prev.has(action.videoProjectId)) {
              const next = new Map(prev);
              // Find matching canvas node for metadata
              const matchingNode = nodes.find(
                (n) => n.videoProjectId === action.videoProjectId,
              );
              next.set(action.videoProjectId, {
                id: action.videoProjectId,
                title: matchingNode?.title ?? "Video Project",
                scenes: [],
                referenceImages: [],
                createdAt: matchingNode?.createdAt ?? new Date().toISOString(),
              });
              return next;
            }
            return prev;
          });
          setActiveVideoProject(action.videoProjectId);
          break;
        case "add-video-scene": {
          setVideoProjects((prev) => {
            const next = new Map(prev);
            const project = next.get(action.videoProjectId);
            if (!project) return prev;
            const newScene: VideoScene = {
              id: crypto.randomUUID(),
              prompt: action.scene.prompt,
              duration: action.scene.duration ?? 5,
              trimStart: 0,
              trimEnd: action.scene.duration ?? 5,
              status: "generating",
              mode: (action.scene.mode as VideoScene["mode"]) ?? "t2v",
              referenceImageIds: [],
              versions: [],
            };
            next.set(action.videoProjectId, {
              ...project,
              scenes: [...project.scenes, newScene],
            });
            return next;
          });
          break;
        }
        case "set-video-audio": {
          setVideoProjects((prev) => {
            const next = new Map(prev);
            const project = next.get(action.videoProjectId);
            if (!project) return prev;
            // Store the audio description; downstream components can use it to generate audio
            next.set(action.videoProjectId, {
              ...project,
              audioUrl: action.audioDescription,
            });
            return next;
          });
          break;
        }
        case "generate-video-scene": {
          setVideoProjects((prev) => {
            const next = new Map(prev);
            const project = next.get(action.videoProjectId);
            if (!project) return prev;
            const scenes = [...project.scenes];
            if (scenes[action.sceneIndex]) {
              scenes[action.sceneIndex] = {
                ...scenes[action.sceneIndex],
                status: "generating",
              };
              next.set(action.videoProjectId, { ...project, scenes });
            }
            return next;
          });
          break;
        }
        case "extend-video-scene": {
          setVideoProjects((prev) => {
            const next = new Map(prev);
            const project = next.get(action.videoProjectId);
            if (!project) return prev;
            const scenes = [...project.scenes];
            if (scenes[action.sceneIndex]) {
              scenes[action.sceneIndex] = {
                ...scenes[action.sceneIndex],
                mode: "extend",
                status: "generating",
              };
              next.set(action.videoProjectId, { ...project, scenes });
            }
            return next;
          });
          break;
        }
        case "stitch-video": {
          // Set a flag on the project that the VideoEditor component watches to trigger stitching
          setVideoProjects((prev) => {
            const next = new Map(prev);
            const project = next.get(action.videoProjectId);
            if (!project) return prev;
            next.set(action.videoProjectId, {
              ...project,
              // Convention: audioUrl starting with "__stitch__" signals the VideoEditor to stitch
              audioUrl: project.audioUrl
                ? project.audioUrl
                : "__stitch__" + new Date().toISOString(),
            });
            return next;
          });
          // Ensure the editor is open so the stitch can execute
          setActiveVideoProject(action.videoProjectId);
          break;
        }
        case "set-scene-mode": {
          setVideoProjects((prev) => {
            const next = new Map(prev);
            const project = next.get(action.videoProjectId);
            if (!project) return prev;
            const scenes = [...project.scenes];
            if (scenes[action.sceneIndex]) {
              scenes[action.sceneIndex] = {
                ...scenes[action.sceneIndex],
                mode: action.mode,
              };
              next.set(action.videoProjectId, { ...project, scenes });
            }
            return next;
          });
          break;
        }
        case "add-reference-image": {
          setVideoProjects((prev) => {
            const next = new Map(prev);
            const project = next.get(action.videoProjectId);
            if (!project) return prev;
            const newRef = {
              id: crypto.randomUUID(),
              url: action.url,
              label: action.label,
            };
            next.set(action.videoProjectId, {
              ...project,
              referenceImages: [...project.referenceImages, newRef],
            });
            return next;
          });
          break;
        }
        case "tag-reference-to-scene": {
          setVideoProjects((prev) => {
            const next = new Map(prev);
            const project = next.get(action.videoProjectId);
            if (!project) return prev;
            const ref = project.referenceImages.find(
              (r) => r.label === action.refLabel,
            );
            if (!ref) return prev;
            const scenes = [...project.scenes];
            if (scenes[action.sceneIndex]) {
              scenes[action.sceneIndex] = {
                ...scenes[action.sceneIndex],
                referenceImageIds: [
                  ...scenes[action.sceneIndex].referenceImageIds,
                  ref.id,
                ],
              };
              next.set(action.videoProjectId, { ...project, scenes });
            }
            return next;
          });
          break;
        }
      }
    },
    [nodes],
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
            referenceImages: [],
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

  const videoEditorRef = useRef<HTMLDivElement>(null);

  // Scroll video editor into view when it becomes active
  useEffect(() => {
    if (activeProject && videoEditorRef.current) {
      videoEditorRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [activeProject]);

  return (
    <div className="flex h-screen flex-col">
      {/* KPI summary bar */}
      <KPIBar />

      {/* Onboarding checklist for new users (hide when editor is open) */}
      {!activeProject && <OnboardingChecklist nodes={nodes} />}

      {/* Recent assets quick-links */}
      {recentAssets.length > 0 && (
        <div className="flex items-center gap-3 border-b border-smoke px-4 py-3">
          <span className="shrink-0 text-xs font-semibold text-cloud">Recent Assets</span>
          <div className="flex flex-1 items-center gap-3 overflow-x-auto">
            {recentAssets.map((asset) => {
              const src = asset.url.startsWith("https://princemarketing.ai/")
                ? `/api/proxy/image?url=${encodeURIComponent(asset.url)}`
                : asset.url;
              return (
                <button
                  key={asset.id}
                  onClick={() => {
                    localStorage.setItem(
                      "pm-editor-import",
                      JSON.stringify({ url: asset.url, type: asset.type }),
                    );
                    window.location.href = "/dashboard/video/new";
                  }}
                  className="shrink-0 overflow-hidden rounded-lg transition-transform hover:scale-105 hover:ring-1 hover:ring-royal/40"
                  title={asset.name || "Open in editor"}
                >
                  {asset.type === "video" ? (
                    <video
                      src={src}
                      className="h-16 w-16 rounded-lg object-cover"
                      muted
                      preload="metadata"
                    />
                  ) : (
                    <img
                      src={src}
                      alt={asset.name || "Asset"}
                      className="h-16 w-16 rounded-lg object-cover"
                    />
                  )}
                </button>
              );
            })}
          </div>
          <a
            href="/dashboard/assets"
            className="flex shrink-0 items-center gap-1 text-xs text-ash transition-colors hover:text-royal"
          >
            View All <ArrowRight size={12} />
          </a>
        </div>
      )}

      {/* Main split panel: Canvas + Chat */}
      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        {/* Main content area — Video Editor when active, otherwise Canvas */}
        <div className="flex-1 min-h-[40vh] lg:min-h-0 overflow-y-auto">
          {activeProject ? (
            <div ref={videoEditorRef}>
              <ErrorBoundary>
                <VideoEditor
                  project={activeProject}
                  onUpdateProject={handleUpdateVideoProject}
                  onClose={() => setActiveVideoProject(null)}
                />
              </ErrorBoundary>
            </div>
          ) : (
          <>
          {/* Spatial canvas for desktop */}
          <div className="hidden h-full lg:block">
            <ErrorBoundary>
              <Canvas
                nodes={nodes}
                onNodeClick={handleNodeClick}
                onNodeMove={handleNodeMove}
                onNodeDelete={handleNodeDelete}
              />
            </ErrorBoundary>
          </div>
          {/* Simplified node list for mobile */}
          <div className="flex h-full flex-col overflow-y-auto bg-void p-4 lg:hidden">
            {nodes.length === 0 ? (
              <div className="flex flex-1 items-center justify-center text-center px-6">
                <div className="max-w-xs">
                  <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-royal/15 to-violet-600/10 border border-royal/15">
                    <Send size={22} strokeWidth={1.2} className="text-royal/70" />
                  </div>
                  <h3 className="text-sm font-semibold text-cloud/90 mb-1.5">
                    Start creating
                  </h3>
                  <p className="text-xs text-ash leading-relaxed">
                    Chat with your AI to generate images, videos, and copy. Content cards will appear here.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {nodes.map((node) => (
                  <button
                    key={node.id}
                    onClick={() => handleNodeClick(node)}
                    className="flex flex-col items-start rounded-2xl border border-smoke bg-graphite/95 p-3 text-left transition-all duration-200 hover:border-royal/30 hover:shadow-lg hover:shadow-royal/5 hover:-translate-y-0.5"
                  >
                    {node.thumbnail ? (
                      <img
                        src={node.thumbnail?.startsWith("https://princemarketing.ai/") ? `/api/proxy/image?url=${encodeURIComponent(node.thumbnail)}` : node.thumbnail}
                        alt={node.title}
                        className="mb-2.5 h-24 w-full rounded-xl object-cover"
                      />
                    ) : (
                      <div className="mb-2.5 flex h-24 w-full items-center justify-center rounded-xl bg-slate/50 border border-smoke/30">
                        <span className="text-[10px] uppercase tracking-widest text-ash/40 font-medium">{node.type}</span>
                      </div>
                    )}
                    <p className="truncate text-xs font-medium text-cloud w-full">{node.title}</p>
                    <span className="mt-1 text-[10px] text-ash/60 capitalize">{node.status}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          </>
          )}
        </div>

        {/* Chat panel — full width on mobile, side panel on desktop */}
        <div
          className={`
            w-full shrink-0 transition-[width] duration-300 ease-in-out
            lg:w-auto
            ${chatCollapsed ? "lg:w-12" : "lg:w-[30%] lg:min-w-[320px] lg:max-w-[480px]"}
          `}
        >
          <ErrorBoundary>
            <ChatPanel
              collapsed={chatCollapsed}
              onToggle={() => setChatCollapsed((prev) => !prev)}
              onCanvasAction={handleCanvasAction}
              nodes={nodes}
            />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
