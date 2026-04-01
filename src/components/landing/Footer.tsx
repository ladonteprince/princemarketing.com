import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-smoke">
      {/* CTA Section */}
      <section className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
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
      <div className="border-t border-smoke px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <img
                  src="/logos/pm-icon.svg"
                  alt="PrinceMarketing"
                  className="h-6 w-6"
                />
                <span className="text-sm font-medium text-cloud">
                  PrinceMarketing
                </span>
              </div>
              <p className="text-sm text-ash/70 leading-relaxed">
                AI-powered marketing for solo business owners. Strategy, content, and scheduling — handled.
              </p>
            </div>

            {/* Product */}
            <div>
              <h4 className="text-sm font-medium text-cloud mb-3">Product</h4>
              <ul className="space-y-2">
                <li><Link href="#how-it-works" className="text-sm text-ash transition-colors hover:text-cloud">How it works</Link></li>
                <li><Link href="#pricing" className="text-sm text-ash transition-colors hover:text-cloud">Pricing</Link></li>
                <li><Link href="/register" className="text-sm text-ash transition-colors hover:text-cloud">Get started</Link></li>
                <li><Link href="/login" className="text-sm text-ash transition-colors hover:text-cloud">Sign in</Link></li>
              </ul>
            </div>

            {/* Developers */}
            <div>
              <h4 className="text-sm font-medium text-cloud mb-3">Developers</h4>
              <ul className="space-y-2">
                <li><a href="https://princemarketing.ai" className="text-sm text-ash transition-colors hover:text-cloud">API Platform</a></li>
                <li><a href="https://princemarketing.ai/docs" className="text-sm text-ash transition-colors hover:text-cloud">API Docs</a></li>
                <li><a href="https://princemarketing.ai/docs/quickstart" className="text-sm text-ash transition-colors hover:text-cloud">Quickstart</a></li>
                <li><a href="https://princemarketing.ai/playground" className="text-sm text-ash transition-colors hover:text-cloud">Playground</a></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-sm font-medium text-cloud mb-3">Company</h4>
              <ul className="space-y-2">
                <li><Link href="/privacy" className="text-sm text-ash transition-colors hover:text-cloud">Privacy Policy</Link></li>
                <li><Link href="/terms" className="text-sm text-ash transition-colors hover:text-cloud">Terms of Service</Link></li>
                <li><a href="mailto:support@princemarketing.com" className="text-sm text-ash transition-colors hover:text-cloud">Support</a></li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-10 pt-6 border-t border-smoke flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-xs text-ash/60">
              &copy; {new Date().getFullYear()} PrinceMarketing. All rights reserved.
            </p>
            <div className="flex items-center gap-1 text-xs text-ash/40">
              <span>Powered by</span>
              <a href="https://princemarketing.ai" className="text-forge-blue hover:text-forge-blue/80 transition-colors font-medium">PrinceMarketing.ai</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
