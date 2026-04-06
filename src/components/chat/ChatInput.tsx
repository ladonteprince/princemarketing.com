"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Image, Film, Box, MapPin, Paperclip, X, Loader2 } from "lucide-react";

// WHY: Asset type for the @ mention popup. These come from the user's
// uploaded assets, canvas nodes, and reference images — allowing inline
// tagging of characters, props, environments, and products in chat.
type MentionAsset = {
  id: string;
  name: string;
  url: string;
  type: "character" | "prop" | "environment" | "product" | "image" | "video";
  thumbnail?: string;
};

type ChatInputProps = {
  onSend: (message: string, attachments?: UploadedAttachment[]) => void;
  disabled?: boolean;
  placeholder?: string;
  assets?: MentionAsset[];
  onAttachmentsChange?: (attachments: UploadedAttachment[]) => void;
};

// WHY: Attachments uploaded inline from chat — they get persisted via the
// upload endpoint and then attached to the user's message so the AI can
// reference them in the next response (e.g., for character reference sheets).
export type UploadedAttachment = {
  id: string;
  url: string;
  name: string;
  type: "image" | "video";
  thumbnail?: string;
};

const TYPE_ICONS = {
  character: Image,
  prop: Box,
  environment: MapPin,
  product: Box,
  image: Image,
  video: Film,
};

const TYPE_LABELS: Record<string, string> = {
  character: "Char",
  prop: "Prop",
  environment: "Env",
  product: "Product",
  image: "Image",
  video: "Video",
};

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = "Tell me about your business...",
  assets = [],
  onAttachmentsChange,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // WHY: Pending attachments — uploaded but not yet sent. Display as
  // chips above the input. Cleared when the user sends the message.
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [uploading, setUploading] = useState(false);

  const handleFilePick = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const newAttachments: UploadedAttachment[] = [];
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("label", file.name);
        formData.append("category", "reference");
        const res = await fetch("/api/upload/image", { method: "POST", body: formData });
        if (!res.ok) continue;
        const data = await res.json();
        const result = data?.data ?? data;
        if (result?.id && result?.url) {
          newAttachments.push({
            id: result.id,
            url: result.url,
            name: result.label || file.name,
            type: result.type === "video" ? "video" : "image",
            thumbnail: result.url.startsWith("https://princemarketing.ai/")
              ? `/api/proxy/image?url=${encodeURIComponent(result.url)}`
              : result.url,
          });
        }
      }
      if (newAttachments.length > 0) {
        const updated = [...attachments, ...newAttachments];
        setAttachments(updated);
        onAttachmentsChange?.(updated);
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [attachments, onAttachmentsChange]);

  const removeAttachment = useCallback((id: string) => {
    const updated = attachments.filter((a) => a.id !== id);
    setAttachments(updated);
    onAttachmentsChange?.(updated);
  }, [attachments, onAttachmentsChange]);

  // @ mention state
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionStartPos, setMentionStartPos] = useState(-1);
  const mentionRef = useRef<HTMLDivElement>(null);

  // Filter assets by the query after @
  const filteredAssets = mentionQuery
    ? assets.filter(
        (a) =>
          a.name.toLowerCase().includes(mentionQuery.toLowerCase()) ||
          a.type.toLowerCase().includes(mentionQuery.toLowerCase()),
      )
    : assets;

  // Close mentions on click outside
  useEffect(() => {
    if (!showMentions) return;
    function handleClick(e: MouseEvent) {
      if (mentionRef.current && !mentionRef.current.contains(e.target as Node)) {
        setShowMentions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showMentions]);

  // Reset mention index when filtered list changes
  useEffect(() => {
    setMentionIndex(0);
  }, [mentionQuery]);

  const insertMention = useCallback(
    (asset: MentionAsset) => {
      // Replace the @query with @AssetName
      const before = value.slice(0, mentionStartPos);
      const after = value.slice(textareaRef.current?.selectionStart ?? value.length);
      const newValue = `${before}@${asset.name}${after}`;
      setValue(newValue);
      setShowMentions(false);
      setMentionQuery("");
      setMentionStartPos(-1);

      // Focus back on textarea
      setTimeout(() => {
        textareaRef.current?.focus();
        const cursorPos = before.length + asset.name.length + 1;
        textareaRef.current?.setSelectionRange(cursorPos, cursorPos);
      }, 0);
    },
    [value, mentionStartPos],
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    // Allow sending if there's text OR attachments
    if ((!trimmed && attachments.length === 0) || disabled) return;

    onSend(trimmed || `[Uploaded ${attachments.length} file${attachments.length === 1 ? "" : "s"}]`, attachments);
    setValue("");
    setAttachments([]);
    onAttachmentsChange?.([]);
    setShowMentions(false);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    // When mention popup is open, handle navigation
    if (showMentions && filteredAssets.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((prev) => Math.min(prev + 1, filteredAssets.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(filteredAssets[mentionIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowMentions(false);
        return;
      }
    }

    // Submit on Enter (without Shift)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const newValue = e.target.value;
    setValue(newValue);

    // Auto-resize
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }

    // Detect @ mentions
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = newValue.slice(0, cursorPos);

    // Find the last @ that isn't preceded by a word character
    const atMatch = textBeforeCursor.match(/(^|[\s(])@(\w*)$/);
    if (atMatch && assets.length > 0) {
      const startPos = textBeforeCursor.lastIndexOf("@");
      setMentionStartPos(startPos);
      setMentionQuery(atMatch[2]);
      setShowMentions(true);
    } else {
      setShowMentions(false);
    }
  }

  return (
    <div className="relative">
      {/* @ Mention popup */}
      {showMentions && filteredAssets.length > 0 && (
        <div
          ref={mentionRef}
          className="
            absolute bottom-full left-0 right-0 z-50 mb-1 mx-4
            max-h-52 overflow-y-auto rounded-xl
            border border-smoke bg-graphite shadow-xl
          "
        >
          <div className="px-3 py-1.5 text-[9px] uppercase tracking-wider text-ash/50 font-medium">
            Assets — type to filter
          </div>
          {filteredAssets.map((asset, i) => {
            const Icon = TYPE_ICONS[asset.type] ?? Image;
            return (
              <button
                key={asset.id}
                onClick={() => insertMention(asset)}
                className={`
                  flex w-full items-center gap-3 px-3 py-2 text-left
                  transition-colors cursor-pointer
                  ${i === mentionIndex ? "bg-royal/10 text-royal" : "text-ash hover:text-cloud hover:bg-slate/50"}
                `}
              >
                {asset.thumbnail ? (
                  <img
                    src={asset.thumbnail}
                    alt={asset.name}
                    className="h-8 w-8 rounded-lg object-cover shrink-0"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate/50 shrink-0">
                    <Icon size={14} className="text-ash" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium truncate">{asset.name}</div>
                  <div className="text-[10px] text-ash/60">{TYPE_LABELS[asset.type] ?? asset.type}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Attachment chips — show pending uploads above the input */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-smoke bg-graphite/80 px-4 pt-2">
          {attachments.map((att) => (
            <div key={att.id} className="relative group flex items-center gap-2 rounded-lg border border-royal/30 bg-royal/10 px-2 py-1">
              {att.thumbnail ? (
                <img src={att.thumbnail} alt={att.name} className="h-7 w-7 rounded object-cover" />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded bg-slate/50">
                  <Image size={12} className="text-ash" />
                </div>
              )}
              <span className="text-[10px] font-medium text-cloud max-w-[100px] truncate">{att.name}</span>
              <button
                onClick={() => removeAttachment(att.id)}
                className="ml-1 flex h-4 w-4 items-center justify-center rounded-full text-ash hover:text-coral hover:bg-coral/10 cursor-pointer"
                aria-label="Remove attachment"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="flex items-end gap-2 border-t border-smoke bg-graphite px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={handleFilePick}
        />

        {/* Paperclip — upload reference images directly in chat */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ash hover:text-cloud hover:bg-slate/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          aria-label="Upload reference"
          title="Upload reference image"
        >
          {uploading ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} strokeWidth={1.5} />}
        </button>

        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="
            flex-1 resize-none bg-transparent py-2 text-sm text-cloud
            placeholder:text-ash/60
            focus:outline-none
            disabled:opacity-50
          "
        />
        <button
          type="submit"
          disabled={disabled || (!value.trim() && attachments.length === 0)}
          className="
            flex h-9 w-9 shrink-0 items-center justify-center rounded-lg
            bg-royal text-white
            transition-colors duration-[var(--transition-micro)]
            hover:bg-royal-hover
            disabled:opacity-30 disabled:cursor-not-allowed
            cursor-pointer
          "
          aria-label="Send message"
        >
          <Send size={16} strokeWidth={1.5} />
        </button>
      </form>
    </div>
  );
}
