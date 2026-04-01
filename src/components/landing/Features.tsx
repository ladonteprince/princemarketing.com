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
    image: "/images/feature-create.png",
    alt: "AI Content Agent creating branded social media posts, email copy, and video content",
  },
  {
    icon: BarChart3,
    title: "Analytics Agent",
    description:
      "Tracks what is working, what is not, and why. Adjusts your strategy in real time so every post performs better than the last.",
    image: "/images/feature-kpi.png",
    alt: "AI Analytics Agent displaying A/B testing dashboards and KPI insights",
  },
] as const;

export function Features() {
  return (
    <section
      id="features"
      className="border-t border-smoke px-4 py-16 sm:px-6 sm:py-24 lg:px-8"
    >
      <div className="mx-auto max-w-6xl">
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

        {/* Cinematic full-width cards */}
        <div className="flex flex-col gap-8">
          {FEATURES.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="group relative overflow-hidden rounded-2xl border border-smoke bg-graphite"
              >
                <div
                  className={`grid gap-0 md:grid-cols-2 ${
                    i % 2 === 1 ? 'md:[direction:rtl]' : ''
                  }`}
                >
                  {/* Image — full width on mobile, half on desktop */}
                  <div className="relative aspect-[16/10] w-full overflow-hidden md:aspect-auto md:min-h-[360px]">
                    <Image
                      src={feature.image}
                      alt={feature.alt}
                      width={800}
                      height={500}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                    {/* Gradient overlay for text readability on mobile */}
                    <div className="absolute inset-0 bg-gradient-to-t from-graphite/80 via-transparent to-transparent md:hidden" />
                  </div>

                  {/* Text */}
                  <div
                    className={`flex flex-col justify-center p-8 md:p-12 ${
                      i % 2 === 1 ? 'md:[direction:ltr]' : ''
                    }`}
                  >
                    <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-smoke bg-slate">
                      <Icon
                        size={24}
                        strokeWidth={1.5}
                        className="text-royal"
                      />
                    </div>
                    <h3 className="mb-3 text-2xl font-bold text-cloud">
                      {feature.title}
                    </h3>
                    <p className="max-w-md text-base leading-relaxed text-ash">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
