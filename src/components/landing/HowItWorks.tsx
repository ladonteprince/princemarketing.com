import { MessageSquare, CalendarDays, Send } from "lucide-react";

const STEPS = [
  {
    number: "01",
    icon: MessageSquare,
    title: "Talk",
    description:
      "Tell me about your business. I will ask the right questions to understand your customers, your voice, and what makes you different.",
  },
  {
    number: "02",
    icon: CalendarDays,
    title: "Plan",
    description:
      "I build a complete content strategy: what to post, when to post, and on which platforms. Your calendar is never empty.",
  },
  {
    number: "03",
    icon: Send,
    title: "Publish",
    description:
      "Review and approve with one tap. I schedule everything across your platforms. You open the app, see today's content, and move on.",
  },
] as const;

export function HowItWorks() {
  return (
    <section id="how-it-works" className="border-t border-smoke px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <p className="mb-4 text-sm font-medium uppercase tracking-wider text-royal">
          How it works
        </p>
        <h2 className="mb-16 text-3xl font-bold text-cloud sm:text-4xl">
          3 steps. Zero blank canvases.
        </h2>

        <div className="grid gap-8 md:grid-cols-3">
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.number} className="relative">
                <span className="mb-4 block font-mono text-xs text-ash/40">
                  {step.number}
                </span>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-smoke bg-slate">
                  <Icon size={22} strokeWidth={1.5} className="text-royal" />
                </div>
                <h3 className="mb-2 text-xl font-semibold text-cloud">
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed text-ash">
                  {step.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
