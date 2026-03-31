import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-void text-cloud">
      <div className="mx-auto max-w-3xl px-6 py-20">
        <Link
          href="/"
          className="mb-8 inline-block text-sm text-ash hover:text-cloud transition-colors"
        >
          &larr; Back to home
        </Link>

        <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-ash mb-12">Last updated: March 31, 2026</p>

        <div className="space-y-8 text-ash leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-cloud mb-3">
              1. Information We Collect
            </h2>
            <p>
              We collect information you provide directly: your name, email
              address, and payment information when you create an account or
              subscribe to a plan. We also collect usage data such as pages
              visited, features used, and AI-generated content requests.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-cloud mb-3">
              2. How We Use Your Information
            </h2>
            <p>
              We use your information to provide and improve PrinceMarketing
              services, process payments, send service-related communications,
              and personalize your experience. AI-generated content is created
              based on your inputs and is not shared with other users.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-cloud mb-3">
              3. Third-Party Services
            </h2>
            <p>
              We use the following third-party services to operate
              PrinceMarketing:
            </p>
            <ul className="mt-2 ml-6 list-disc space-y-1">
              <li>
                <strong className="text-cloud">Stripe</strong> for payment
                processing
              </li>
              <li>
                <strong className="text-cloud">Anthropic (Claude)</strong> for
                AI-powered marketing strategy
              </li>
              <li>
                <strong className="text-cloud">AI generation providers</strong>{" "}
                for image, video, and copy generation
              </li>
            </ul>
            <p className="mt-2">
              Each third-party service has its own privacy policy governing
              their use of your data.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-cloud mb-3">
              4. Cookies
            </h2>
            <p>
              We use essential cookies for authentication and session
              management. We do not use third-party tracking cookies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-cloud mb-3">
              5. Data Security
            </h2>
            <p>
              We implement industry-standard security measures including
              encrypted connections (TLS), hashed passwords, and secure
              session management to protect your data.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-cloud mb-3">
              6. Your Rights
            </h2>
            <p>
              You have the right to access, update, or delete your personal
              data at any time. You can manage your account information
              through your dashboard settings or contact us directly for
              assistance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-cloud mb-3">
              7. Contact
            </h2>
            <p>
              For privacy-related inquiries, contact us at{" "}
              <a
                href="mailto:privacy@princemarketing.com"
                className="text-royal hover:underline"
              >
                privacy@princemarketing.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
