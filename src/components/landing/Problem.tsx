import { Clock, Brain } from "lucide-react";

export function Problem() {
  return (
    <section className="border-t border-smoke px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <p className="mb-4 text-sm font-medium uppercase tracking-wider text-royal">
          The problem
        </p>
        <h2 className="mb-6 text-3xl font-bold text-cloud sm:text-4xl">
          You started a business, not a media company.
        </h2>
        <p className="mb-16 max-w-2xl text-lg text-ash">
          Solo business owners lose 8+ hours a week on marketing they are not
          sure is working. The result? Inconsistent posting, no strategy, and
          money left on the table.
        </p>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Pain point 1 */}
          <div className="rounded-xl border border-smoke bg-graphite p-6">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-royal-muted">
              <Clock size={20} strokeWidth={1.5} className="text-royal" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-cloud">
              No time to market
            </h3>
            <p className="text-sm leading-relaxed text-ash">
              Between serving customers and running operations, marketing
              becomes the thing you will get to &quot;tomorrow.&quot; Tomorrow never
              comes. Your online presence goes silent for weeks.
            </p>
          </div>

          {/* Pain point 2 */}
          <div className="rounded-xl border border-smoke bg-graphite p-6">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-royal-muted">
              <Brain size={20} strokeWidth={1.5} className="text-royal" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-cloud">
              No idea what works
            </h3>
            <p className="text-sm leading-relaxed text-ash">
              Even when you do post, it feels like shouting into the void.
              No strategy, no data, no feedback loop. Just guessing and hoping
              someone notices.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
