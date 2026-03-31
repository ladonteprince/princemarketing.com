"use client";

import { useState, useRef } from "react";
import { Send } from "lucide-react";

type ChatInputProps = {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
};

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = "Tell me about your business...",
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;

    onSend(trimmed);
    setValue("");

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    // Submit on Enter (without Shift)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  // Auto-resize textarea
  function handleInput() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-end gap-2 border-t border-smoke bg-graphite px-4 py-3"
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          handleInput();
        }}
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
        disabled={disabled || !value.trim()}
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
  );
}
