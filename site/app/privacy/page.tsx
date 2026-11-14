import type { Metadata } from "next";
import { ContactLink } from "@/components/ContactLink";
import Link from "next/link";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "What WishingTales stores: guest reading stays in your browser; an optional parent/reader account keeps only an adult email address and the reading state you sync. No child accounts, no ads, no trackers.",
  alternates: { canonical: "/privacy/" },
};

const UPDATED = "9 November 2026";

export default function PrivacyPage() {
  return (
    <div className="page doc">
      <h1>Privacy</h1>
      <p>
        Last updated {UPDATED}. The short version: reading as a guest stays on your device. An
        account is optional, and it holds only what it needs to keep your place.
      </p>

      <h2>What we do not do</h2>
      <ul>
        <li>No advertising and no advertising cookies.</li>
        <li>No social media pixels, no cross-site trackers, no fingerprinting.</li>
        <li>No selling or sharing of personal information.</li>
        <li>
          No child accounts and no collecting anything from children; see <a href="#children">Children</a> below.
        </li>
      </ul>

      <h2>If you read as a guest</h2>
      <p>
        The reader stores your preferences in your browser's local storage: text size, line spacing,
        light or dark theme, how far through each story you have read, and how far through a
        narration you have listened, plus your listening speed. This information stays on your
        device, is never transmitted to us, and disappears if you clear your browser data. Every
        story on the site is readable this way; an account is never required.
      </p>

      <h2 id="account">If you create an account (optional)</h2>
      <p>Accounts are for parents and adult readers. Creating one is optional.</p>
      <ul>
        <li>
          <strong>What we collect:</strong> the email address you sign up with, a username, your
          password (stored only as a hash, never in readable form), an optional display name, and
          the account type you pick (reading with kids, for yourself, or both). Sign-up never asks
          for a child's name, birthdate, or contact details.
        </li>
        <li>
          <strong>What syncs with the account:</strong> how far you are through each story, the
          stories you favourite, and your reader preferences (text size, spacing, theme), only
          while you are signed in. Signing out returns you to browser-only storage.
        </li>
        <li>
          <strong>Account email:</strong> we use your address to confirm it and to reset your
          password when you ask. If you opt in to the newsletter when it launches, you get a weekly
          email, and every message has an unsubscribe link. We send nothing else.
        </li>
        <li>
          <strong>How mail is delivered:</strong> through Resend, our transactional email provider,
          which processes the address only to deliver the message.
        </li>
        <li>
          <strong>The sign-in session:</strong> a token lives in your browser's session storage and
          clears when the tab closes.
        </li>
        <li>
          <strong>Deleting it:</strong> write to <ContactLink /> and we remove the account and its
          synced data. Guest data can be cleared from your browser at any time.
        </li>
      </ul>

      <h2>Analytics</h2>
      <p>
        We use Cloudflare Web Analytics, which counts page views without cookies and without
        identifying individual visitors. It reports aggregate numbers such as which pages were read
        and roughly where in the world readers are. It does not build a profile of you and cannot
        follow you to other sites.
      </p>

      <h2 id="children">Children</h2>
      <p>
        This site is made for children, so we deliberately collect nothing from them. Accounts here
        are <strong>parent/reader accounts only</strong>: the account holder is an adult, and
        sign-up never asks for a child's name, birthdate, or contact details. There are no
        comments, no uploads, and no way for a child to send us personal information through the
        site. If you believe a child has sent us personal information by email, write to us and we
        will delete it.
      </p>

      <h2>Server logs</h2>
      <p>
        Our host, Cloudflare, processes requests in order to serve the site and protect it from
        abuse, and keeps short-lived technical logs for that purpose. We do not use those logs to
        identify readers.
      </p>

      <h2>Changes and contact</h2>
      <p>
        If this policy changes, the date at the top of the page changes with it. Questions go to{" "}
        <ContactLink />. See also the <Link href="/terms/">terms of use</Link>.
      </p>
    </div>
  );
}
