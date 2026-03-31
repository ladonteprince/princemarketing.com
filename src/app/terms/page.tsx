import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-void text-cloud">
      <div className="mx-auto max-w-3xl px-6 py-20">
        <Link
          href="/"
          className="mb-8 inline-block text-sm text-ash hover:text-cloud transition-colors"
        >
          &larr; Back to home
        </Link>

        <h1 className="text-4xl font-bold mb-2">Terms of Service</h1>
        <p className="text-ash mb-12">Last updated: March 31, 2026</p>

        <div className="space-y-8 text-ash leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-cloud mb-3">
              1. Service Description
            </h2>
            <p>
              PrinceMarketing is an AI-powered marketing platform that
              provides marketing strategy, content generation, scheduling,
              and analytics tools for business owners. Access to features
              depends on your subscription tier.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-cloud mb-3">
              2. User Obligations
            </h2>
            <p>By using PrinceMarketing, you agree to:</p>
            <ul className="mt-2 ml-6 list-disc space-y-1">
              <li>Provide accurate account information</li>
              <li>Keep your login credentials secure</li>
              <li>
                Use the platform only for lawful marketing purposes
              </li>
              <li>
                Not attempt to reverse-engineer, scrape, or abuse the
                service
              </li>
              <li>
                Not use AI-generated content to mislead, deceive, or harm
                others
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-cloud mb-3">
              3. Payment Terms
            </h2>
            <p>
              Subscriptions are billed monthly through Stripe. You may cancel
              at any time through the customer portal. Refunds are handled on
              a case-by-case basis. Failure to pay may result in service
              suspension.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-cloud mb-3">
              4. Intellectual Property
            </h2>
            <p>
              Content you create using PrinceMarketing belongs to you. The
              PrinceMarketing platform, brand, and underlying technology
              remain the property of PrinceMarketing. You may not
              redistribute or resell the platform itself.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-cloud mb-3">
              5. Limitation of Liability
            </h2>
            <p>
              PrinceMarketing is provided &quot;as is&quot; without warranty
              of any kind. We are not liable for any indirect, incidental, or
              consequential damages arising from use of the service. Our
              total liability shall not exceed the amount you paid in the
              preceding 12 months.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-cloud mb-3">
              6. Termination
            </h2>
            <p>
              We may suspend or terminate your account if you violate these
              terms. You may delete your account at any time through your
              dashboard settings. Upon termination, your data will be deleted
              within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-cloud mb-3">
              7. Changes to Terms
            </h2>
            <p>
              We may update these terms from time to time. Continued use of
              the service after changes constitutes acceptance of the updated
              terms. We will notify you of material changes via email.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-cloud mb-3">
              8. Contact
            </h2>
            <p>
              For questions about these terms, contact us at{" "}
              <a
                href="mailto:legal@princemarketing.com"
                className="text-royal hover:underline"
              >
                legal@princemarketing.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
