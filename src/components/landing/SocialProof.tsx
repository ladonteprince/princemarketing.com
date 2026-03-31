const TESTIMONIALS = [
  {
    quote:
      "I went from posting once a month to 5 times a week. My bookings doubled in 3 months.",
    name: "Marcus R.",
    role: "Independent Plumber",
    metric: "2x bookings",
  },
  {
    quote:
      "The AI understood my bakery's voice better than the agency I was paying $2,000/month.",
    name: "Priya K.",
    role: "Bakery Owner",
    metric: "12 hours saved/week",
  },
  {
    quote:
      "I just open the app, approve today's posts, and get back to my clients. That is it.",
    name: "David L.",
    role: "Personal Trainer",
    metric: "340% engagement increase",
  },
] as const;

export function SocialProof() {
  return (
    <section className="border-t border-smoke px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <p className="mb-4 text-center text-sm font-medium uppercase tracking-wider text-royal">
          Results
        </p>
        <h2 className="mb-16 text-center text-3xl font-bold text-cloud sm:text-4xl">
          Solo owners who stopped guessing.
        </h2>

        <div className="grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.name}
              className="flex flex-col rounded-xl border border-smoke bg-graphite p-6"
            >
              <p className="mb-6 flex-1 text-sm leading-relaxed text-ash">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="border-t border-smoke pt-4">
                <div className="mb-1 font-mono text-lg font-bold text-royal">
                  {t.metric}
                </div>
                <p className="text-sm font-medium text-cloud">{t.name}</p>
                <p className="text-xs text-ash">{t.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
