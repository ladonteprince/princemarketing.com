import { Avatar } from "@/components/ui/Avatar";

type ChatMessageProps = {
  role: "user" | "assistant";
  content: string;
  userName?: string;
};

export function ChatMessage({ role, content, userName }: ChatMessageProps) {
  const isAssistant = role === "assistant";

  return (
    <div
      className={`flex gap-3 ${isAssistant ? "" : "flex-row-reverse"}`}
    >
      {/* Avatar */}
      {isAssistant ? (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-royal-muted">
          <img
            src="/logos/pm-icon.svg"
            alt="AI Strategist"
            className="h-5 w-5"
          />
        </div>
      ) : (
        <Avatar name={userName ?? "You"} size="sm" />
      )}

      {/* Message bubble */}
      <div
        className={`
          max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed
          ${
            isAssistant
              ? "bg-graphite text-cloud rounded-tl-md"
              : "bg-royal text-white rounded-tr-md"
          }
        `}
      >
        {/* WHY: Render line breaks in AI responses for readability */}
        {content.split("\n").map((line, i) => (
          <p key={i} className={i > 0 ? "mt-2" : ""}>
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}
