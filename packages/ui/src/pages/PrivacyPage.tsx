export default function PrivacyPage() {
  return (
    <article className="prose prose-invert prose-lg max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-2">Privacy Policy</h2>
      <p className="text-gray-400 text-sm mb-8">
        Effective date: May 7, 2026. Applies to Chrometria at{' '}
        <a href="https://symmetry.tendrid.us" className="text-indigo-400 hover:text-indigo-300">
          symmetry.tendrid.us
        </a>{' '}
        and the Chrometria Android app (us.tendrid.chrometria).
      </p>

      <section className="mb-10">
        <h3 className="text-xl font-semibold text-indigo-300 mb-3">1. What Data We Collect</h3>

        <h4 className="text-base font-semibold text-gray-200 mb-2">Free tier (no account required)</h4>
        <ul className="list-disc ml-6 space-y-1 text-gray-300">
          <li>No personally identifiable information is collected.</li>
          <li>
            On the website only, Google AdSense may set cookies and collect usage data as described in{' '}
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 hover:text-indigo-300"
            >
              Google's Privacy Policy
            </a>
            . The Android app does not show ads and does not load AdSense.
          </li>
          <li>Standard server access logs (IP address, timestamp, page path) retained for 30 days for security purposes.</li>
        </ul>

        <h4 className="text-base font-semibold text-gray-200 mb-2 mt-4">Pro and Research tiers (account required)</h4>
        <ul className="list-disc ml-6 space-y-1 text-gray-300">
          <li>
            <strong>Email address</strong> — collected when you sign in via magic link. Used only for
            authentication and transactional emails (login links, receipts).
          </li>
          <li>
            <strong>Payment information</strong> — billing is handled entirely by Stripe. We never see or
            store your full card number; we only retain a Stripe customer ID and subscription status.
          </li>
          <li>
            <strong>API usage</strong> — request counts and timestamps are stored per account to enforce
            tier limits and display usage statistics on your dashboard.
          </li>
          <li>
            <strong>Saved collections and assignments</strong> — pitch-class sets, progressions, and
            assignment data you explicitly save are stored in our database and associated with your account.
          </li>
          <li>
            <strong>Session tokens</strong> — a short-lived session token is stored server-side to keep
            you logged in. It expires automatically after inactivity.
          </li>
        </ul>

        <h4 className="text-base font-semibold text-gray-200 mb-2 mt-4">Classroom mode</h4>
        <p className="text-gray-300">
          Real-time collaboration data (chord selections, cursor positions) is transmitted over WebSocket
          during an active session. This data is ephemeral — it is never written to disk and is discarded
          when the session ends.
        </p>
      </section>

      <section className="mb-10">
        <h3 className="text-xl font-semibold text-indigo-300 mb-3">2. How We Use Your Data</h3>
        <ul className="list-disc ml-6 space-y-1 text-gray-300">
          <li>To authenticate you and maintain your session.</li>
          <li>To process subscription payments and send transactional emails (login links, receipts).</li>
          <li>To enforce API rate limits and display your usage on the dashboard.</li>
          <li>To persist collections and assignments you explicitly save.</li>
          <li>To diagnose server errors using access logs.</li>
        </ul>
        <p className="text-gray-300 mt-3">
          We do not sell, rent, or share your personal data with third parties for marketing purposes.
          We do not use your data to build advertising profiles. On the website we use{' '}
          <a
            href="https://plausible.io/data-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-400 hover:text-indigo-300"
          >
            Plausible
          </a>
          , a privacy-friendly, cookieless analytics service that collects aggregate page-view
          statistics without tracking individuals across sites. Plausible is not loaded in the
          Android app. We use no other third-party analytics (no Google Analytics, no Mixpanel,
          no Amplitude).
        </p>
      </section>

      <section className="mb-10">
        <h3 className="text-xl font-semibold text-indigo-300 mb-3">3. Third-Party Services</h3>

        <div className="mb-5">
          <h4 className="text-base font-semibold text-gray-200 mb-1">Stripe (payment processing)</h4>
          <p className="text-gray-300">
            Stripe handles all payment card data. When you subscribe, you are interacting with Stripe's
            secure checkout. We receive only a customer ID, subscription status, and non-sensitive billing
            metadata. Stripe's privacy policy:{' '}
            <a
              href="https://stripe.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 hover:text-indigo-300"
            >
              stripe.com/privacy
            </a>
            .
          </p>
        </div>

        <div className="mb-5">
          <h4 className="text-base font-semibold text-gray-200 mb-1">Resend (transactional email)</h4>
          <p className="text-gray-300">
            Magic-link login emails are sent via Resend. Your email address is transmitted to Resend's
            servers solely to deliver the login link. Resend's privacy policy:{' '}
            <a
              href="https://resend.com/legal/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 hover:text-indigo-300"
            >
              resend.com/legal/privacy-policy
            </a>
            .
          </p>
        </div>

        <div className="mb-5">
          <h4 className="text-base font-semibold text-gray-200 mb-1">Google AdSense (website free tier only)</h4>
          <p className="text-gray-300">
            On the website, free-tier users see ads served by Google AdSense (publisher ID:
            ca-pub-9760203099492988). The Android app is ad-free and does not load AdSense.
            Google may use cookies and device identifiers to serve personalized ads based on your
            browsing history. You can opt out of personalized ads at{' '}
            <a
              href="https://adssettings.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 hover:text-indigo-300"
            >
              adssettings.google.com
            </a>
            . Ads are not shown to Pro or Research subscribers.
          </p>
        </div>
      </section>

      <section className="mb-10">
        <h3 className="text-xl font-semibold text-indigo-300 mb-3">4. Microphone Access</h3>
        <p className="text-gray-300">
          The Live Detection page requests access to your device's microphone for real-time pitch
          detection. Microphone audio is processed entirely on your device using the Web Audio API.
          Audio samples are <strong>never transmitted to any server</strong> — not ours, not anyone
          else's. Granting microphone permission is optional; all other pages function without it.
          You can revoke microphone access at any time through your browser or device settings.
        </p>
      </section>

      <section className="mb-10">
        <h3 className="text-xl font-semibold text-indigo-300 mb-3">5. Data Retention</h3>
        <ul className="list-disc ml-6 space-y-1 text-gray-300">
          <li>
            <strong>Access logs</strong> — deleted automatically after 30 days.
          </li>
          <li>
            <strong>Account data</strong> (email, session tokens, API usage) — retained for as long as
            your account is active. Deleted within 30 days of account deletion.
          </li>
          <li>
            <strong>Saved collections and assignments</strong> — retained until you delete them or close
            your account.
          </li>
          <li>
            <strong>Stripe billing records</strong> — retained as required by financial regulations
            (typically 7 years). Stripe handles this retention independently.
          </li>
          <li>
            <strong>Classroom session data</strong> — ephemeral; never persisted.
          </li>
        </ul>
        <p className="text-gray-300 mt-3">
          To request deletion of your account and associated data, email us at the address below.
        </p>
      </section>

      <section className="mb-10">
        <h3 className="text-xl font-semibold text-indigo-300 mb-3">6. Your Rights</h3>
        <p className="text-gray-300">
          Depending on your jurisdiction, you may have the right to access, correct, or delete personal
          data we hold about you, or to object to certain processing. To exercise any of these rights,
          contact us at the address below. We will respond within 30 days.
        </p>
      </section>

      <section className="mb-10">
        <h3 className="text-xl font-semibold text-indigo-300 mb-3">7. Children's Privacy</h3>
        <p className="text-gray-300">
          Chrometria is not directed at children under 13. We do not knowingly collect personal
          information from children under 13. If you believe a child has provided us personal
          information, please contact us and we will delete it promptly.
        </p>
      </section>

      <section className="mb-10">
        <h3 className="text-xl font-semibold text-indigo-300 mb-3">8. Changes to This Policy</h3>
        <p className="text-gray-300">
          We may update this policy occasionally. When we do, we will revise the effective date at the
          top of this page. Continued use of the app after changes constitutes acceptance of the
          updated policy.
        </p>
      </section>

      <section className="mb-10">
        <h3 className="text-xl font-semibold text-indigo-300 mb-3">9. Contact</h3>
        <p className="text-gray-300">
          Questions or requests regarding this privacy policy can be sent to:
        </p>
        <p className="mt-2">
          <a
            href="mailto:tenerjenkins@gmail.com"
            className="text-indigo-400 hover:text-indigo-300 font-medium"
          >
            tenerjenkins@gmail.com
          </a>
        </p>
      </section>
    </article>
  );
}
