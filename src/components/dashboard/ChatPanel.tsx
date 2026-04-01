"use client";

import { useState, useRef, useEffect } from "react";
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
} from "lucide-react";
import type { ContentNode, CanvasAction } from "@/types/canvas";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  nodeRefs?: string[]; // IDs of nodes created by this message
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
    "I am your creative workspace. Tell me what you need — images, videos, copy, or full campaigns — and I will create them as nodes on your canvas.\n\nTry: \"Create a product photo for my new sneaker launch\" or \"Plan a 30-second ad for Instagram\"",
};

// Parse AI responses for structured content creation actions
function parseContentActions(
  responseText: string,
  userMessage: string,
): { actions: CanvasAction[]; nodeRefs: string[] } {
  const actions: CanvasAction[] = [];
  const nodeRefs: string[] = [];

  // Look for [NODE:...] markers in the AI response
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

  async function handleSend(content: string) {
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsThinking(true);
    setError(null);

    try {
      // Try the create-content endpoint first for structured responses
      const res = await fetch("/api/ai/create-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          message: content,
          existingNodes: nodes.map((n) => ({ id: n.id, type: n.type, title: n.title })),
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to get AI response");
      }

      const data = await res.json();
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.message,
        nodeRefs: [],
      };

      // Process any canvas actions from the structured response
      if (data.nodes && Array.isArray(data.nodes)) {
        const refs: string[] = [];
        let yPos = 60;
        // Find the max Y position of existing nodes to stack below
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

          // If it is a video node, open the video editor
          if (nodeData.type === "video" && nodeData.videoProjectId) {
            node.videoProjectId = nodeData.videoProjectId;
            onCanvasAction({ type: "open-video-editor", videoProjectId: nodeData.videoProjectId });
          }
        }
        assistantMessage.nodeRefs = refs;
      }

      // Also parse inline [NODE:...] markers
      const { actions, nodeRefs } = parseContentActions(data.message, content);
      for (const action of actions) {
        onCanvasAction(action);
      }
      if (nodeRefs.length > 0) {
        assistantMessage.nodeRefs = [...(assistantMessage.nodeRefs ?? []), ...nodeRefs];
      }

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      // Fallback to streaming chat
      try {
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
          <span className="text-sm font-semibold text-cloud">AI Workspace</span>
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
        placeholder="Describe content to create..."
      />
    </div>
  );
}
