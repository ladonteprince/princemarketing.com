import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-smoke">
      {/* CTA Section */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mb-4 text-3xl font-bold text-cloud sm:text-4xl">
            Ready to stop guessing?
          </h2>
          <p className="mb-8 text-lg text-ash">
            Your first strategy session takes 5 minutes. I will do the rest.
          </p>
          <Link
            href="/register"
            className="
              inline-flex h-12 items-center gap-2 rounded-lg bg-royal px-8
              text-base font-medium text-white
              transition-all duration-[var(--transition-micro)]
              hover:bg-royal-hover
            "
          >
            Start your strategy
            <ArrowRight size={18} strokeWidth={1.5} />
          </Link>
        </div>
      </section>

      {/* Footer links */}
      <div className="border-t border-smoke px-6 py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <img
              src="/logos/pm-icon.svg"
              alt="PrinceMarketing"
              className="h-6 w-6"
            />
            <span className="text-sm text-ash">
              PrinceMarketing
            </span>
          </div>

          <nav className="flex items-center gap-6">
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
          </nav>

          <p className="text-xs text-ash/60">
            &copy; {new Date().getFullYear()} PrinceMarketing. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
