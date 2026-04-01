"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { ChatInput } from "@/components/chat/ChatInput";
import { ThinkingDots } from "@/components/ui/ThinkingDots";
import { Badge } from "@/components/ui/Badge";
import {
  PanelRightClose,
  PanelRightOpen,
  AlertCircle,
  ImageIcon,
  Video,
  FileText,
  Check,
  Loader2,
  Calendar,
  Send as SendIcon,
  BarChart3,
} from "lucide-react";
import type { ContentNode, CanvasAction } from "@/types/canvas";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  nodeRefs?: string[]; // IDs of nodes created by this message
  actionStatuses?: ActionStatus[];
};

type ActionStatus = {
  action: string;
  label: string;
  status: "pending" | "running" | "done" | "error";
  detail?: string;
  progress?: number; // 0-100 for progress bar
  stage?: string;    // Current stage name for display
};

type AgentAction = {
  action: string;
  prompt?: string;
  style?: string;
  scenes?: Array<{ prompt: string; duration: number }>;
  type?: string;
  title?: string;
  content?: string;
  platform?: string;
  platforms?: string[];
  scheduledAt?: string;
  period?: string;
  mode?: string;
  sourceImage?: string;
  sourceVideo?: string;
};

type ChatPanelProps = {
  collapsed: boolean;
  onToggle: () => void;
  onCanvasAction: (action: CanvasAction) => void;
  nodes: ContentNode[];
};

const INITIAL_MESSAGE: Message = {
  id: "initial",
  role: "assistant",
  content:
    "I am your marketing command center. Tell me what to do and I will execute it.\n\nI can create images, videos, copy, schedule posts, publish to your socials, and pull analytics. Try:\n\n- \"Create a product photo for my sneaker launch\"\n- \"Schedule an Instagram post for tomorrow at 9am\"\n- \"Show me this week's analytics\"\n- \"Plan a 30-second ad for Instagram\"",
};

type StatusUpdate = { progress?: number; stage?: string; detail?: string };

// WHY: Execute agentic actions returned by Claude against the platform APIs.
// Each action type maps to a specific API call and canvas operation.
// statusCallback provides real-time progress for long-running actions (SSE streaming).
async function executeAction(
  action: AgentAction,
  onCanvasAction: (action: CanvasAction) => void,
  nodes: ContentNode[],
  statusCallback?: (update: StatusUpdate) => void,
): Promise<{ success: boolean; detail: string; nodeRef?: string }> {
  switch (action.action) {
    case "CREATE_IMAGE": {
      try {
        const res = await fetch("/api/generate/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: action.prompt,
            style: action.style ?? "social",
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          const errMsg = typeof data.error === "string" ? data.error : data.error?.message ?? "Image generation failed";
          throw new Error(errMsg);
        }

        const id = crypto.randomUUID();
        let yPos = 60;
        for (const n of nodes) {
          if (n.position.y + 200 > yPos) yPos = n.position.y + 200;
        }

        const node: ContentNode = {
          id,
          type: "image",
          title: action.prompt?.slice(0, 50) ?? "Generated Image",
          thumbnail: data.url ?? data.imageUrl ?? data.data?.imageUrl,
          status: "draft",
          prompt: action.prompt,
          createdAt: new Date().toISOString(),
          connections: [],
          position: { x: 60, y: yPos },
        };
        onCanvasAction({ type: "add-node", node });
        return { success: true, detail: "Image created", nodeRef: id };
      } catch (err) {
        return { success: false, detail: err instanceof Error ? err.message : "Failed" };
      }
    }

    case "CREATE_VIDEO": {
      try {
        const id = crypto.randomUUID();
        const videoProjectId = crypto.randomUUID();
        let yPos = 60;
        for (const n of nodes) {
          if (n.position.y + 200 > yPos) yPos = n.position.y + 200;
        }

        const node: ContentNode = {
          id,
          type: "video",
          title: action.prompt?.slice(0, 50) ?? "Video Project",
          status: "draft",
          prompt: action.prompt,
          videoProjectId,
          createdAt: new Date().toISOString(),
          connections: [],
          position: { x: 60, y: yPos },
        };
        onCanvasAction({ type: "add-node", node });

        // Always open the video editor for the new project
        onCanvasAction({ type: "open-video-editor", videoProjectId });

        // Trigger video generation and stream progress via SSE
        if (action.prompt) {
          // Detect video generation mode from action data
          const videoMode = action.mode
            ?? (action.sourceImage ? 'i2v' : undefined)
            ?? (action.sourceVideo ? 'extend' : undefined)
            ?? 't2v';

          const videoPayload: Record<string, unknown> = {
            prompt: action.prompt,
            duration: action.scenes?.[0]?.duration ?? 5,
            aspectRatio: "16:9",
            mode: videoMode,
          };
          if (action.sourceImage) videoPayload.sourceImage = action.sourceImage;
          if (action.sourceVideo) videoPayload.sourceVideo = action.sourceVideo;

          const res = await fetch("/api/generate/video", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(videoPayload),
          });
          const data = await res.json();

          if (res.ok && data.generationId) {
            // Open SSE stream for real-time progress
            const { streamGeneration } = await import("@/lib/api");

            return new Promise((resolve) => {
              const cancel = streamGeneration(data.generationId, {
                onProgress: (event) => {
                  // Update via the statusCallback if provided
                  if (statusCallback) {
                    statusCallback({
                      progress: event.data.progress,
                      stage: event.data.stage,
                      detail: event.data.message,
                    });
                  }
                },
                onCompleted: (event) => {
                  resolve({
                    success: true,
                    detail: `Video ready — scored ${event.data.score?.toFixed(1) ?? "?"}/10`,
                    nodeRef: id,
                  });
                },
                onFailed: (event) => {
                  resolve({
                    success: false,
                    detail: event.data.error ?? "Video generation failed",
                  });
                },
                onError: (error) => {
                  resolve({
                    success: false,
                    detail: error.message,
                  });
                },
              });

              // Safety timeout: cancel SSE after 30 minutes
              setTimeout(() => {
                cancel();
                resolve({
                  success: false,
                  detail: "Video generation timed out",
                });
              }, 30 * 60 * 1000);
            });
          }
        }

        return { success: true, detail: `Video project created with ${action.scenes?.length ?? 0} scenes`, nodeRef: id };
      } catch (err) {
        return { success: false, detail: err instanceof Error ? err.message : "Failed" };
      }
    }

    case "CREATE_COPY": {
      try {
        const res = await fetch("/api/generate/copy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: action.prompt,
            type: action.type ?? "social",
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Copy generation failed");

        const id = crypto.randomUUID();
        let yPos = 60;
        for (const n of nodes) {
          if (n.position.y + 200 > yPos) yPos = n.position.y + 200;
        }

        const node: ContentNode = {
          id,
          type: "copy",
          title: action.prompt?.slice(0, 50) ?? "Generated Copy",
          status: "draft",
          prompt: action.prompt,
          createdAt: new Date().toISOString(),
          connections: [],
          position: { x: 60, y: yPos },
        };
        onCanvasAction({ type: "add-node", node });
        return { success: true, detail: data.copy ? "Copy generated" : "Copy created", nodeRef: id };
      } catch (err) {
        return { success: false, detail: err instanceof Error ? err.message : "Failed" };
      }
    }

    case "SCHEDULE_POST": {
      try {
        const res = await fetch("/api/calendar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: action.title ?? "Scheduled Post",
            content: action.content ?? "",
            platform: action.platform ?? "instagram",
            scheduledAt: action.scheduledAt ?? new Date(Date.now() + 86400000).toISOString(),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Scheduling failed");
        return { success: true, detail: `Scheduled for ${new Date(action.scheduledAt ?? Date.now()).toLocaleDateString()}` };
      } catch (err) {
        return { success: false, detail: err instanceof Error ? err.message : "Failed" };
      }
    }

    case "PUBLISH_NOW": {
      try {
        const res = await fetch("/api/social/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: action.content ?? "",
            platforms: action.platforms ?? [],
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Publishing failed");

        const results = data.results ?? {};
        const successes = Object.values(results).filter((r: unknown) => (r as { success: boolean }).success).length;
        const total = Object.keys(results).length;
        return { success: successes > 0, detail: `Published to ${successes}/${total} platforms` };
      } catch (err) {
        return { success: false, detail: err instanceof Error ? err.message : "Failed" };
      }
    }

    case "GET_ANALYTICS": {
      try {
        const res = await fetch("/api/analytics");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Analytics fetch failed");

        const summary = [
          `Posts: ${data.postsPublished ?? 0}`,
          `Impressions: ${data.totalImpressions?.toLocaleString() ?? 0}`,
          `Engagement: ${data.totalEngagement?.toLocaleString() ?? 0}`,
          `Clicks: ${data.totalClicks?.toLocaleString() ?? 0}`,
        ].join(" | ");
        return { success: true, detail: summary };
      } catch (err) {
        return { success: false, detail: err instanceof Error ? err.message : "Failed" };
      }
    }

    // WHY: New video modes delegate to CREATE_VIDEO logic with mode pre-set.
    // This keeps backward compatibility while supporting i2v, extend, and video-edit.
    case "ANIMATE_IMAGE": {
      const i2vAction: AgentAction = {
        ...action,
        action: "CREATE_VIDEO",
        mode: "i2v",
      };
      return executeAction(i2vAction, onCanvasAction, nodes, statusCallback);
    }

    case "EXTEND_VIDEO": {
      const extendAction: AgentAction = {
        ...action,
        action: "CREATE_VIDEO",
        mode: "extend",
      };
      return executeAction(extendAction, onCanvasAction, nodes, statusCallback);
    }

    case "EDIT_VIDEO": {
      const editAction: AgentAction = {
        ...action,
        action: "CREATE_VIDEO",
        mode: "video-edit",
      };
      return executeAction(editAction, onCanvasAction, nodes, statusCallback);
    }

    default:
      return { success: false, detail: `Unknown action: ${action.action}` };
  }
}

const ACTION_LABELS: Record<string, { label: string; icon: typeof ImageIcon }> = {
  CREATE_IMAGE: { label: "Generating image", icon: ImageIcon },
  CREATE_VIDEO: { label: "Creating video project", icon: Video },
  ANIMATE_IMAGE: { label: "Animating image to video", icon: Video },
  EXTEND_VIDEO: { label: "Extending video", icon: Video },
  EDIT_VIDEO: { label: "Editing video", icon: Video },
  CREATE_COPY: { label: "Generating copy", icon: FileText },
  SCHEDULE_POST: { label: "Scheduling post", icon: Calendar },
  PUBLISH_NOW: { label: "Publishing", icon: SendIcon },
  GET_ANALYTICS: { label: "Fetching analytics", icon: BarChart3 },
};

// Parse AI responses for structured content creation actions (legacy [NODE:...] markers)
function parseContentActions(
  responseText: string,
  userMessage: string,
): { actions: CanvasAction[]; nodeRefs: string[] } {
  const actions: CanvasAction[] = [];
  const nodeRefs: string[] = [];

  const nodePattern = /\[NODE:(\w+)\|([^\]]+)\]/g;
  let match;
  let xPos = 60;

  while ((match = nodePattern.exec(responseText)) !== null) {
    const type = match[1].toLowerCase() as ContentNode["type"];
    const title = match[2];
    const id = crypto.randomUUID();

    const node: ContentNode = {
      id,
      type,
      title,
      status: "draft",
      prompt: userMessage,
      createdAt: new Date().toISOString(),
      connections: nodeRefs.length > 0 ? [nodeRefs[nodeRefs.length - 1]] : [],
      position: { x: xPos, y: 60 + nodeRefs.length * 200 },
    };

    actions.push({ type: "add-node", node });
    nodeRefs.push(id);
    xPos += 260;
  }

  return { actions, nodeRefs };
}

export function ChatPanel({ collapsed, onToggle, onCanvasAction, nodes }: ChatPanelProps) {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId] = useState(() => crypto.randomUUID());
  const scrollRef = useRef<HTMLDivElement>(null);

  const userName = session?.user?.name ?? "You";

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isThinking]);

  // WHY: Process agentic actions returned by the AI and update the message with live status
  const processActions = useCallback(
    async (
      agentActions: AgentAction[],
      messageId: string,
    ): Promise<string[]> => {
      const allNodeRefs: string[] = [];

      // Initialize action statuses
      const statuses: ActionStatus[] = agentActions.map((a) => ({
        action: a.action,
        label: ACTION_LABELS[a.action]?.label ?? a.action,
        status: "pending" as const,
      }));

      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, actionStatuses: [...statuses] } : m,
        ),
      );

      // Execute actions sequentially so each can reference prior canvas state
      for (let i = 0; i < agentActions.length; i++) {
        // Mark current as running
        statuses[i].status = "running";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId ? { ...m, actionStatuses: [...statuses] } : m,
          ),
        );

        // Progress callback for SSE-streamed actions (video generation)
        const statusCallback = (update: StatusUpdate) => {
          statuses[i].progress = update.progress;
          statuses[i].stage = update.stage;
          if (update.detail) statuses[i].detail = update.detail;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === messageId ? { ...m, actionStatuses: [...statuses] } : m,
            ),
          );
        };

        const result = await executeAction(agentActions[i], onCanvasAction, nodes, statusCallback);

        statuses[i].status = result.success ? "done" : "error";
        statuses[i].detail = result.detail;
        statuses[i].progress = undefined; // Clear progress bar on completion
        if (result.nodeRef) allNodeRefs.push(result.nodeRef);

        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, actionStatuses: [...statuses], nodeRefs: [...allNodeRefs] }
              : m,
          ),
        );
      }

      return allNodeRefs;
    },
    [onCanvasAction, nodes],
  );

  async function handleSend(content: string) {
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsThinking(true);
    setError(null);

    // Build conversation history from existing messages (exclude initial greeting)
    const history = messages
      .filter((m) => m.id !== "initial")
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch("/api/ai/create-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          message: content,
          history,
          existingNodes: nodes.map((n) => ({ id: n.id, type: n.type, title: n.title })),
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to get AI response");
      }

      const data = await res.json();
      const assistantId = crypto.randomUUID();
      const assistantMessage: Message = {
        id: assistantId,
        role: "assistant",
        content: data.message,
        nodeRefs: [],
        actionStatuses: [],
      };

      // Process legacy canvas node responses
      if (data.nodes && Array.isArray(data.nodes) && data.nodes.length > 0) {
        const refs: string[] = [];
        let yPos = 60;
        for (const n of nodes) {
          if (n.position.y + 200 > yPos) yPos = n.position.y + 200;
        }

        for (let i = 0; i < data.nodes.length; i++) {
          const nodeData = data.nodes[i];
          const id = crypto.randomUUID();
          const node: ContentNode = {
            id,
            type: nodeData.type ?? "copy",
            title: nodeData.title ?? "Untitled",
            thumbnail: nodeData.thumbnail,
            status: "draft",
            prompt: nodeData.prompt ?? content,
            createdAt: new Date().toISOString(),
            connections: refs.length > 0 ? [refs[refs.length - 1]] : [],
            position: { x: 60 + i * 260, y: yPos },
          };
          onCanvasAction({ type: "add-node", node });
          refs.push(id);

          if (nodeData.type === "video" && nodeData.videoProjectId) {
            node.videoProjectId = nodeData.videoProjectId;
            onCanvasAction({ type: "open-video-editor", videoProjectId: nodeData.videoProjectId });
          }
        }
        assistantMessage.nodeRefs = refs;
      }

      // Parse inline [NODE:...] markers
      const { actions: nodeActions, nodeRefs } = parseContentActions(data.message, content);
      for (const action of nodeActions) {
        onCanvasAction(action);
      }
      if (nodeRefs.length > 0) {
        assistantMessage.nodeRefs = [...(assistantMessage.nodeRefs ?? []), ...nodeRefs];
      }

      setMessages((prev) => [...prev, assistantMessage]);
      setIsThinking(false);

      // Process agentic actions (the new system)
      if (data.actions && Array.isArray(data.actions) && data.actions.length > 0) {
        const actionRefs = await processActions(data.actions, assistantId);
        if (actionRefs.length > 0) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, nodeRefs: [...(m.nodeRefs ?? []), ...actionRefs] }
                : m,
            ),
          );
        }
      }
    } catch {
      // Fallback to streaming chat
      try {
        setIsThinking(true);
        const { streamChat } = await import("@/lib/api");
        const assistantId = crypto.randomUUID();
        let fullResponse = "";

        await streamChat(
          sessionId,
          content,
          (chunk) => {
            fullResponse += chunk;
            setMessages((prev) => {
              const existing = prev.find((m) => m.id === assistantId);
              if (existing) {
                return prev.map((m) =>
                  m.id === assistantId ? { ...m, content: fullResponse } : m,
                );
              }
              return [
                ...prev,
                { id: assistantId, role: "assistant" as const, content: fullResponse },
              ];
            });
          },
          () => {},
          history,
        );
      } catch (streamErr) {
        const message = streamErr instanceof Error ? streamErr.message : "Failed to connect to AI";
        setError(message);
      }
    } finally {
      setIsThinking(false);
    }
  }

  if (collapsed) {
    return (
      <div className="flex h-full w-12 flex-col items-center border-l border-smoke bg-graphite pt-4">
        <button
          onClick={onToggle}
          className="
            flex h-9 w-9 items-center justify-center rounded-lg
            text-ash hover:text-cloud hover:bg-slate
            transition-colors duration-200 cursor-pointer
          "
          aria-label="Open chat panel"
        >
          <PanelRightOpen size={18} strokeWidth={1.5} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col border-l border-smoke bg-graphite">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-smoke px-4">
        <div className="flex items-center gap-2">
          <img src="/logos/pm-icon.svg" alt="AI" className="h-5 w-5" />
          <span className="text-sm font-semibold text-cloud">AI Strategist</span>
          <div className="thinking-dots flex items-center gap-0.5">
            <span className="royal-dot royal-dot-animate h-1.5 w-1.5" />
          </div>
        </div>
        <button
          onClick={onToggle}
          className="
            flex h-8 w-8 items-center justify-center rounded-lg
            text-ash hover:text-cloud hover:bg-slate
            transition-colors duration-200 cursor-pointer
          "
          aria-label="Close chat panel"
        >
          <PanelRightClose size={16} strokeWidth={1.5} />
        </button>
      </div>

      {/* Node references bar */}
      {nodes.length > 0 && (
        <div className="flex items-center gap-2 border-b border-smoke/50 px-4 py-2 overflow-x-auto">
          <span className="shrink-0 text-[10px] uppercase tracking-wider text-ash">Canvas:</span>
          {nodes.slice(-5).map((node) => {
            const icons: Record<string, typeof ImageIcon> = { image: ImageIcon, video: Video, copy: FileText };
            const Icon = icons[node.type] ?? FileText;
            return (
              <div
                key={node.id}
                className="flex shrink-0 items-center gap-1 rounded-md bg-slate/60 px-2 py-0.5"
              >
                <Icon size={10} className="text-royal" />
                <span className="text-[10px] text-ash truncate max-w-[80px]">{node.title}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mx-3 mt-3 flex items-center gap-2 rounded-lg border border-coral/30 bg-coral/10 px-3 py-2 text-xs text-coral">
          <AlertCircle size={14} strokeWidth={1.5} />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-coral/60 hover:text-coral cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        <div className="flex flex-col gap-3">
          {messages.map((msg) => (
            <div key={msg.id}>
              <ChatMessage role={msg.role} content={msg.content} userName={userName} />

              {/* Action status indicators */}
              {msg.actionStatuses && msg.actionStatuses.length > 0 && (
                <div className="mt-2 ml-11 flex flex-col gap-1.5">
                  {msg.actionStatuses.map((as, i) => {
                    const actionMeta = ACTION_LABELS[as.action];
                    const Icon = actionMeta?.icon ?? FileText;
                    const hasProgress = as.status === "running" && as.progress != null && as.progress > 0;
                    return (
                      <div key={i} className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 rounded-lg bg-slate/40 px-3 py-1.5 text-xs">
                          {as.status === "running" ? (
                            <Loader2 size={12} className="animate-spin text-royal" />
                          ) : as.status === "done" ? (
                            <Check size={12} className="text-emerald-400" />
                          ) : as.status === "error" ? (
                            <AlertCircle size={12} className="text-coral" />
                          ) : (
                            <Icon size={12} className="text-ash" />
                          )}
                          <span className={`flex-1 ${as.status === "done" ? "text-cloud" : as.status === "error" ? "text-coral" : "text-ash"}`}>
                            {as.status === "done" || as.status === "error"
                              ? as.detail ?? as.label
                              : as.stage
                                ? `${as.stage}...`
                                : `${as.label}...`}
                          </span>
                          {hasProgress && (
                            <span className="text-[10px] tabular-nums text-ash/70">{as.progress}%</span>
                          )}
                        </div>
                        {/* Progress bar for SSE-streamed actions */}
                        {hasProgress && (
                          <div className="mx-3 h-1 overflow-hidden rounded-full bg-slate/60">
                            <div
                              className="h-full rounded-full bg-royal transition-all duration-500 ease-out"
                              style={{ width: `${as.progress}%` }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Node reference chips */}
              {msg.nodeRefs && msg.nodeRefs.length > 0 && (
                <div className="mt-1 ml-11 flex flex-wrap gap-1">
                  {msg.nodeRefs.map((ref) => {
                    const node = nodes.find((n) => n.id === ref);
                    return node ? (
                      <Badge key={ref} variant="royal" className="text-[10px]">
                        {node.type}: {node.title}
                      </Badge>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          ))}

          {isThinking && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-royal-muted">
                <img src="/logos/pm-icon.svg" alt="AI" className="h-5 w-5" />
              </div>
              <div className="rounded-2xl rounded-tl-md bg-slate px-4 py-3">
                <ThinkingDots />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        disabled={isThinking}
        placeholder="Tell me what to do..."
      />
    </div>
  );
}
