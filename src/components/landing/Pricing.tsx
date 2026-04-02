"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
  planKey: string;
};

const PLANS: ReadonlyArray<Plan> = [
  {
    name: "Starter",
    price: 29,
    interval: "/month",
    description: "For solo owners just getting started with consistent marketing.",
    features: [
      { text: "50 AI images/month", included: true },
      { text: "5 AI videos/month", included: true },
      { text: "200 copy generations", included: true },
      { text: "5 audio tracks", included: true },
      { text: "10 AI agent calls", included: true },
      { text: "Analytics dashboard", included: true },
      { text: "Video editor", included: false },
      { text: "Competitor analysis", included: false },
    ],
    highlighted: false,
    cta: "Get started",
    planKey: "STARTER",
  },
  {
    name: "Growth",
    price: 79,
    interval: "/month",
    description: "For businesses ready to scale their online presence.",
    features: [
      { text: "200 AI images/month", included: true },
      { text: "25 AI videos/month", included: true },
      { text: "1,000 copy generations", included: true },
      { text: "20 audio tracks", included: true },
      { text: "50 AI agent calls", included: true },
      { text: "Full analytics + Google Analytics", included: true },
      { text: "Video editor + audio sync", included: true },
      { text: "Competitor analysis", included: false },
    ],
    highlighted: true,
    cta: "Start growing",
    planKey: "GROWTH",
  },
  {
    name: "Scale",
    price: 199,
    interval: "/month",
    description: "For businesses that want a full marketing engine on autopilot.",
    features: [
      { text: "1,000 AI images/month", included: true },
      { text: "100 AI videos/month", included: true },
      { text: "5,000 copy generations", included: true },
      { text: "100 audio tracks", included: true },
      { text: "Unlimited AI agent calls", included: true },
      { text: "Advanced analytics + GA", included: true },
      { text: "Video editor + full production", included: true },
      { text: "Competitor analysis + strategy", included: true },
    ],
    highlighted: false,
    cta: "Scale now",
    planKey: "SCALE",
  },
] as const;

export function Pricing() {
  const { data: session } = useSession();
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  async function handleCheckout(planKey: string) {
    // If not signed in, redirect to register
    if (!session?.user) {
      router.push("/register");
      return;
    }

    setLoadingPlan(planKey);

    try {
      const response = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planKey }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error("No checkout URL returned:", data.error);
      }
    } catch (error) {
      console.error("Checkout failed:", error);
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <section id="pricing" className="border-t border-smoke px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
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

              <button
                onClick={() => handleCheckout(plan.planKey)}
                disabled={loadingPlan === plan.planKey}
                className={`
                  flex h-11 items-center justify-center rounded-lg text-sm font-medium
                  transition-colors duration-[var(--transition-micro)] disabled:opacity-60
                  ${
                    plan.highlighted
                      ? "bg-royal text-white hover:bg-royal-hover"
                      : "border border-smoke bg-slate text-cloud hover:bg-smoke"
                  }
                `}
              >
                {loadingPlan === plan.planKey ? "Redirecting..." : plan.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
