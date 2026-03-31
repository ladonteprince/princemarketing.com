"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 z-50 w-full border-b border-smoke/50 bg-void/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <img
            src="/logos/pm-icon.svg"
            alt="PrinceMarketing"
            className="h-8 w-8"
          />
          <span className="text-sm font-semibold text-cloud">
            PrinceMarketing
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-6 md:flex">
          <Link
            href="#pricing"
            className="text-sm text-ash transition-colors hover:text-cloud"
          >
            Pricing
          </Link>
          <Link
            href="/login"
            className="text-sm text-ash transition-colors hover:text-cloud"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="
              inline-flex h-9 items-center rounded-lg bg-royal px-4
              text-sm font-medium text-white
              transition-colors duration-[var(--transition-micro)]
              hover:bg-royal-hover
            "
          >
            Get started
          </Link>
        </div>

        {/* Mobile hamburger button */}
        <button
          onClick={() => setMobileOpen((prev) => !prev)}
          className="
            flex h-11 w-11 items-center justify-center rounded-lg
            text-ash hover:text-cloud hover:bg-slate
            transition-colors duration-[var(--transition-micro)]
            cursor-pointer md:hidden
          "
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? (
            <X size={22} strokeWidth={1.5} />
          ) : (
            <Menu size={22} strokeWidth={1.5} />
          )}
        </button>
      </div>

      {/* Mobile dropdown menu */}
      {mobileOpen && (
        <div className="border-t border-smoke/50 bg-void/95 backdrop-blur-md md:hidden">
          <div className="flex flex-col gap-1 px-4 py-4">
            <Link
              href="#pricing"
              onClick={() => setMobileOpen(false)}
              className="flex h-11 items-center rounded-lg px-3 text-sm text-ash transition-colors hover:text-cloud hover:bg-slate"
            >
              Pricing
            </Link>
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              className="flex h-11 items-center rounded-lg px-3 text-sm text-ash transition-colors hover:text-cloud hover:bg-slate"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              onClick={() => setMobileOpen(false)}
              className="
                mt-2 flex h-11 items-center justify-center rounded-lg bg-royal
                text-sm font-medium text-white
                transition-colors duration-[var(--transition-micro)]
                hover:bg-royal-hover
              "
            >
              Get started
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
