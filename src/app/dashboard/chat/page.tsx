"use client";

import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Header } from "@/components/layout/Header";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { ChatInput } from "@/components/chat/ChatInput";
import { ThinkingDots } from "@/components/ui/ThinkingDots";
import { streamChat } from "@/lib/api";
import { AlertCircle } from "lucide-react";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const INITIAL_MESSAGE: Message = {
  id: "initial",
  role: "assistant",
  content:
    "I'm your marketing strategist. I'll build a plan that fits your business — not a generic template.\n\nLet's start with the basics: What does your business do, and who are your ideal customers?",
};

export default function ChatPage() {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId] = useState(() => crypto.randomUUID());
  const scrollRef = useRef<HTMLDivElement>(null);

  const userName = session?.user?.name ?? "You";

  // Auto-scroll to latest message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isThinking]);

  async function handleSend(content: string) {
    // 1. Add user message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsThinking(true);
    setError(null);

    // 2. Stream AI response
    const assistantId = crypto.randomUUID();
    let fullResponse = "";

    try {
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
        () => {
          setIsThinking(false);
        },
      );
    } catch (err) {
      // Show real error — no mock fallback
      setIsThinking(false);
      const message = err instanceof Error ? err.message : "Failed to connect to AI";
      setError(message);
    }
  }

  return (
    <div className="flex h-screen flex-col">
      <Header
        title="AI Strategist"
        subtitle="Your personal marketing partner"
      />

      {/* Error banner */}
      {error && (
        <div className="mx-6 mt-4 flex items-center gap-2 rounded-lg border border-coral/30 bg-coral/10 px-4 py-3 text-sm text-coral">
          <AlertCircle size={16} strokeWidth={1.5} />
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-coral/60 hover:text-coral cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-6 py-6"
      >
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              role={message.role}
              content={message.content}
              userName={userName}
            />
          ))}

          {isThinking && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-royal-muted">
                <img
                  src="/logos/pm-icon.svg"
                  alt="AI Strategist"
                  className="h-5 w-5"
                />
              </div>
              <div className="rounded-2xl rounded-tl-md bg-graphite px-4 py-3">
                <ThinkingDots />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="mx-auto w-full max-w-2xl">
        <ChatInput onSend={handleSend} disabled={isThinking} />
      </div>
    </div>
  );
}
