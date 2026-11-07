import type { Metadata } from "next";
import { ContactLink } from "@/components/ContactLink";
import Link from "next/link";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "WishingTales collects no personal information, has no accounts, no ads, and no tracking cookies.",
  alternates: { canonical: "/privacy/" },
};

const UPDATED = "10 October 2026";

export default function PrivacyPage() {
  return (
    <div className="page doc">
      <h1>Privacy</h1>
      <p>
        Last updated {UPDATED}. This page describes what {SITE.name} does with information. The short
        version: nothing about you leaves your device.
      </p>

      <h2>What we do not do</h2>
      <ul>
        <li>No accounts, no sign-up, no email list.</li>
        <li>No advertising and no advertising cookies.</li>
        <li>No social media pixels, no cross-site trackers, no fingerprinting.</li>
        <li>No selling or sharing of personal information, because we do not collect any.</li>
      </ul>

      <h2>What is stored in your browser</h2>
      <p>
        The reader stores your preferences in your browser's local storage: text size, line spacing,
        light or dark theme, how far through each story you have read, and how far through a
        narration you have listened, plus your listening speed. This information stays on your
        device, is never transmitted to us, and disappears if you clear your browser data.
      </p>

      <h2>Analytics</h2>
      <p>
        We use Cloudflare Web Analytics, which counts page views without cookies and without
        identifying individual visitors. It reports aggregate numbers such as which pages were read
        and roughly where in the world readers are. It does not build a profile of you and cannot
        follow you to other sites.
      </p>

      <h2>Children</h2>
      <p>
        This site is made for children, so we deliberately collect nothing from them. There are no
        accounts, no comments, no uploads, and no way for a child to send us personal information
        through the site. If you believe a child has sent us personal information by email, write to
        us and we will delete it.
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
        <ContactLink />. See also the{" "}
        <Link href="/terms/">terms of use</Link>.
      </p>
    </div>
  );
}
