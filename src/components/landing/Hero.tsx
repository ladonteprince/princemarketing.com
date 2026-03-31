import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { SplineBackground } from "@/components/SplineBackground";

export function Hero() {
  return (
    <section className="relative flex min-h-[90vh] flex-col items-center justify-center px-4 text-center sm:px-6 lg:px-8 overflow-hidden">
      {/* Spline 3D animated background — subtle atmosphere */}
      <SplineBackground />

      {/* Subtle gradient — only used on marketing hero per brand spec */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40 z-[1]"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 40%, rgba(99, 102, 241, 0.15) 0%, transparent 70%)",
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto max-w-3xl">
        {/* Tagline chip */}
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-smoke bg-graphite px-4 py-1.5">
          <span className="royal-dot" />
          <span className="text-sm text-ash">AI-powered marketing for solo businesses</span>
        </div>

        <h1 className="mb-6 text-3xl font-bold leading-tight tracking-tight text-cloud sm:text-5xl md:text-6xl lg:text-7xl">
          Your marketing,
          <br />
          <span className="text-royal">handled.</span>
        </h1>

        <p className="mx-auto mb-10 max-w-xl text-base leading-relaxed text-ash sm:text-lg">
          Stop guessing what to post. PrinceMarketing builds your strategy,
          creates your content, and schedules it across every platform.
          You run your business. I handle the rest.
        </p>

        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
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
          <Link
            href="#how-it-works"
            className="
              inline-flex h-12 items-center rounded-lg px-8
              text-base font-medium text-ash
              transition-colors duration-[var(--transition-micro)]
              hover:text-cloud
            "
          >
            See how it works
          </Link>
        </div>
      </div>

      {/* Agent pipeline hero image */}
      <div className="relative z-10 mx-auto mt-12 max-w-5xl sm:mt-16">
        <div className="relative overflow-hidden rounded-xl border border-smoke/30 shadow-2xl shadow-royal/10">
          <Image
            src="/images/hero-pipeline.png"
            alt="AI marketing agents working together in a pipeline — Strategy, Content, Image, Video, Critic, Distribution"
            width={1200}
            height={675}
            className="w-full"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-void/60 via-transparent to-transparent" />
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
        <div className="flex flex-col items-center gap-2 text-ash/40">
          <div className="h-8 w-[1px] bg-gradient-to-b from-transparent to-ash/20" />
        </div>
      </div>
    </section>
  );
}
