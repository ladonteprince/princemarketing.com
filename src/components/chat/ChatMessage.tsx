import { Avatar } from "@/components/ui/Avatar";

type ChatMessageProps = {
  role: "user" | "assistant";
  content: string;
  userName?: string;
};

// WHY: Simple regex-based markdown renderer — avoids adding a dependency.
// Handles bold, italic, numbered lists, and bullet points.
function renderMarkdown(text: string): React.ReactElement[] {
  return text.split("\n").map((line, i) => {
    // Bold: **text** -> <strong>text</strong>
    let html = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Italic: *text* -> <em>text</em>
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Numbered list: 1. text -> styled list item
    html = html.replace(/^(\d+)\.\s/, '<span class="text-royal font-semibold mr-1">$1.</span>');
    // Bullet: - text -> styled bullet
    html = html.replace(/^-\s/, '<span class="text-royal mr-1">\u2022</span>');

    return <p key={i} className="mb-1" dangerouslySetInnerHTML={{ __html: html }} />;
  });
}

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
        {renderMarkdown(content)}
      </div>
    </div>
  );
}
