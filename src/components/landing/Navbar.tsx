import Link from "next/link";

export function Navbar() {
  return (
    <nav className="fixed top-0 z-50 w-full border-b border-smoke/50 bg-void/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
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

        <div className="flex items-center gap-6">
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
      </div>
    </nav>
  );
}
