import Image from "next/image";
import { Bot, PenTool, BarChart3 } from "lucide-react";

const FEATURES = [
  {
    icon: Bot,
    title: "Strategy Agent",
    description:
      "Analyzes your business, competitors, and audience to build a data-backed marketing strategy tailored to your goals. No templates — a real plan.",
    image: "/images/feature-strategy.png",
    alt: "AI Strategy Agent analyzing market data and building a custom marketing plan",
  },
  {
    icon: PenTool,
    title: "Content Agent",
    description:
      "Creates scroll-stopping posts, captions, and visuals in your brand voice. Every piece is on-strategy and ready to publish across platforms.",
    image: "/images/feature-content.png",
    alt: "AI Content Agent creating branded social media posts and visual content",
  },
  {
    icon: BarChart3,
    title: "Analytics Agent",
    description:
      "Tracks what is working, what is not, and why. Adjusts your strategy in real time so every post performs better than the last.",
    image: "/images/feature-analytics.png",
    alt: "AI Analytics Agent displaying performance dashboards and actionable insights",
  },
] as const;

export function Features() {
  return (
    <section
      id="features"
      className="border-t border-smoke px-4 py-16 sm:px-6 sm:py-24 lg:px-8"
    >
      <div className="mx-auto max-w-5xl">
        <p className="mb-4 text-center text-sm font-medium uppercase tracking-wider text-royal">
          Your AI team
        </p>
        <h2 className="mb-6 text-center text-3xl font-bold text-cloud sm:text-4xl">
          Three agents. One mission.
        </h2>
        <p className="mx-auto mb-16 max-w-2xl text-center text-lg text-ash">
          Each agent is a specialist — strategy, content, analytics — working
          together so your marketing never stops improving.
        </p>

        <div className="grid gap-8 md:grid-cols-3">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="group overflow-hidden rounded-xl border border-smoke bg-graphite transition-colors hover:border-royal/30"
              >
                {/* Feature image */}
                <div className="relative aspect-[4/3] w-full overflow-hidden border-b border-smoke">
                  <Image
                    src={feature.image}
                    alt={feature.alt}
                    width={600}
                    height={450}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                </div>

                {/* Feature text */}
                <div className="p-6">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-smoke bg-slate">
                    <Icon
                      size={20}
                      strokeWidth={1.5}
                      className="text-royal"
                    />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-cloud">
                    {feature.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-ash">
                    {feature.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
