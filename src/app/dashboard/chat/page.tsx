"use client";

import { useState, useRef, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { ChatInput } from "@/components/chat/ChatInput";
import { ThinkingDots } from "@/components/ui/ThinkingDots";
import { streamChat } from "@/lib/api";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

// WHY: The initial greeting starts the conversational onboarding flow
const INITIAL_MESSAGE: Message = {
  id: "initial",
  role: "assistant",
  content:
    "I'm your marketing strategist. I'll build a plan that fits your business — not a generic template.\n\nLet's start with the basics: What does your business do, and who are your ideal customers?",
};

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [isThinking, setIsThinking] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());
  const scrollRef = useRef<HTMLDivElement>(null);

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
    } catch {
      // Fallback: simulate a response if API is not connected
      setIsThinking(false);
      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          role: "assistant",
          content: generateMockResponse(content),
        },
      ]);
    }
  }

  return (
    <div className="flex h-screen flex-col">
      <Header
        title="AI Strategist"
        subtitle="Your personal marketing partner"
      />

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
              userName="Marcus"
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

// WHY: Mock responses for demo/development when Claude API is not connected
function generateMockResponse(userMessage: string): string {
  const lower = userMessage.toLowerCase();

  if (lower.includes("plumb") || lower.includes("pipe") || lower.includes("fix")) {
    return "A plumbing business — that is a service people need urgently but rarely think about until something breaks. That gives us a great content angle.\n\nHere is what I am thinking for your strategy:\n\n1. Educational content that positions you as the expert (tips, maintenance checklists)\n2. Before/after project photos — these perform extremely well on Instagram and Facebook\n3. Emergency service availability posts — time-sensitive content gets high engagement\n\nWhich platforms are you currently using, or where do your customers spend time online?";
  }

  if (lower.includes("bake") || lower.includes("cake") || lower.includes("food")) {
    return "A bakery is a dream to market — your product is visually stunning and emotionally connected to celebrations.\n\nI would focus your strategy on:\n\n1. Behind-the-scenes content (the process is as compelling as the result)\n2. Customer celebration stories (weddings, birthdays, milestones)\n3. Limited-time seasonal offers that create urgency\n\nWhat platforms are you most interested in? Instagram and TikTok tend to work best for visual food content.";
  }

  if (lower.includes("instagram") || lower.includes("facebook") || lower.includes("tiktok") || lower.includes("platform")) {
    return "Good choices. I will build your content calendar around those platforms with posting times optimized for your audience.\n\nFor the first week, I will prepare:\n- 3 Instagram posts (mix of carousel tips and visual content)\n- 2 Facebook posts (longer-form, community-focused)\n- 1 LinkedIn article (position you as an industry expert)\n\nI will have your first week ready in the Content Calendar. You can review and approve each post before it goes live.\n\nWhat is your biggest marketing challenge right now?";
  }

  return "That is helpful context. Based on what you have told me, I am building a content strategy tailored to your business.\n\nI will focus on:\n- Consistent posting schedule (so your audience knows when to expect content)\n- A mix of educational and promotional content (the 80/20 rule)\n- Platform-specific formats (what works on Instagram is different from LinkedIn)\n\nYour first week of content will appear in the Content Calendar tab. You will be able to review, edit, and approve each post with one tap.\n\nIs there anything specific you want to focus on first?";
}
