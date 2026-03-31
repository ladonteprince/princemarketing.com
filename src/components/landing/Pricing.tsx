import Link from "next/link";
import { Check } from "lucide-react";

type PlanFeature = {
  text: string;
  included: boolean;
};

type Plan = {
  name: string;
  price: number;
  interval: string;
  description: string;
  features: ReadonlyArray<PlanFeature>;
  highlighted: boolean;
  cta: string;
};

const PLANS: ReadonlyArray<Plan> = [
  {
    name: "Starter",
    price: 29,
    interval: "/month",
    description: "For solo owners just getting started with consistent marketing.",
    features: [
      { text: "AI strategist chat", included: true },
      { text: "Content calendar", included: true },
      { text: "2 platforms", included: true },
      { text: "15 posts/month", included: true },
      { text: "Basic analytics", included: true },
      { text: "Campaign management", included: false },
      { text: "Priority support", included: false },
    ],
    highlighted: false,
    cta: "Get started",
  },
  {
    name: "Growth",
    price: 79,
    interval: "/month",
    description: "For businesses ready to scale their online presence.",
    features: [
      { text: "AI strategist chat", included: true },
      { text: "Content calendar", included: true },
      { text: "5 platforms", included: true },
      { text: "60 posts/month", included: true },
      { text: "Full analytics", included: true },
      { text: "Campaign management", included: true },
      { text: "Priority support", included: false },
    ],
    highlighted: true,
    cta: "Start growing",
  },
  {
    name: "Scale",
    price: 199,
    interval: "/month",
    description: "For businesses that want a full marketing engine on autopilot.",
    features: [
      { text: "AI strategist chat", included: true },
      { text: "Content calendar", included: true },
      { text: "Unlimited platforms", included: true },
      { text: "Unlimited posts", included: true },
      { text: "Advanced analytics", included: true },
      { text: "Campaign management", included: true },
      { text: "Priority support", included: true },
    ],
    highlighted: false,
    cta: "Scale now",
  },
] as const;

export function Pricing() {
  return (
    <section id="pricing" className="border-t border-smoke px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <p className="mb-4 text-center text-sm font-medium uppercase tracking-wider text-royal">
          Pricing
        </p>
        <h2 className="mb-4 text-center text-3xl font-bold text-cloud sm:text-4xl">
          Simple, honest pricing.
        </h2>
        <p className="mx-auto mb-16 max-w-md text-center text-ash">
          No free tier. No hidden fees. Just tools that pay for themselves
          in the first week.
        </p>

        <div className="grid gap-6 md:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`
                relative flex flex-col rounded-xl border p-6
                ${
                  plan.highlighted
                    ? "border-royal bg-graphite"
                    : "border-smoke bg-graphite"
                }
              `}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-royal px-3 py-1 text-xs font-medium text-white">
                    Most popular
                  </span>
                </div>
              )}

              <h3 className="mb-1 text-lg font-semibold text-cloud">
                {plan.name}
              </h3>
              <p className="mb-4 text-sm text-ash">{plan.description}</p>

              <div className="mb-6">
                <span className="font-mono text-4xl font-bold text-cloud">
                  ${plan.price}
                </span>
                <span className="text-sm text-ash">{plan.interval}</span>
              </div>

              <ul className="mb-8 flex flex-1 flex-col gap-3">
                {plan.features.map((feature) => (
                  <li key={feature.text} className="flex items-center gap-2.5">
                    <Check
                      size={16}
                      strokeWidth={1.5}
                      className={feature.included ? "text-royal" : "text-smoke"}
                    />
                    <span
                      className={`text-sm ${
                        feature.included ? "text-cloud" : "text-ash/40"
                      }`}
                    >
                      {feature.text}
                    </span>
                  </li>
                ))}
              </ul>

              <Link
                href="/register"
                className={`
                  flex h-11 items-center justify-center rounded-lg text-sm font-medium
                  transition-colors duration-[var(--transition-micro)]
                  ${
                    plan.highlighted
                      ? "bg-royal text-white hover:bg-royal-hover"
                      : "border border-smoke bg-slate text-cloud hover:bg-smoke"
                  }
                `}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
