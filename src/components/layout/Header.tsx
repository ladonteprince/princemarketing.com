"use client";

import { Bell, Search } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";

type HeaderProps = {
  title: string;
  subtitle?: string;
};

export function Header({ title, subtitle }: HeaderProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-smoke px-4 sm:px-6">
      <div>
        <h1 className="text-lg font-semibold text-cloud">{title}</h1>
        {subtitle && (
          <p className="text-sm text-ash">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Search */}
        <button
          className="
            flex h-9 w-9 items-center justify-center rounded-lg
            text-ash hover:text-cloud hover:bg-slate
            transition-colors duration-[var(--transition-micro)]
            cursor-pointer
          "
          aria-label="Search"
        >
          <Search size={18} strokeWidth={1.5} />
        </button>

        {/* Notifications */}
        <button
          className="
            relative flex h-9 w-9 items-center justify-center rounded-lg
            text-ash hover:text-cloud hover:bg-slate
            transition-colors duration-[var(--transition-micro)]
            cursor-pointer
          "
          aria-label="Notifications"
        >
          <Bell size={18} strokeWidth={1.5} />
          {/* Notification indicator */}
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-royal" />
        </button>

        {/* User avatar */}
        <Avatar name="Marcus" size="sm" />
      </div>
    </header>
  );
}
