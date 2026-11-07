import type { Metadata } from "next";
import { ContactLink } from "@/components/ContactLink";
import Link from "next/link";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms",
  description: "Terms of use for WishingTales: free to read, personal use, AI-assisted stories.",
  alternates: { canonical: "/terms/" },
};

const UPDATED = "10 October 2026";

export default function TermsPage() {
  return (
    <div className="page doc">
      <h1>Terms of use</h1>
      <p>Last updated {UPDATED}. By using {SITE.name} you agree to these terms.</p>

      <h2>Reading the stories</h2>
      <p>
        The stories on this site are free to read for personal, non-commercial use: read them
        yourself, read them aloud to your family, read them in a classroom. You may not republish
        them, sell them, or feed them into another service as your own content. If you want to use a
        story in a way these terms do not cover, ask us first.
      </p>

      <h2>Retold classics</h2>
      <p>
        Our retellings are new text, owned by {SITE.name}, even where the underlying story is in the
        public domain. The public-domain original is free for anyone to use — the{" "}
        <Link href="/sources/">sources page</Link> says where each one came from, so you can go to
        the original instead.
      </p>

      <h2>Written with AI, checked automatically</h2>
      <p>
        Every story is written by an AI model and reviewed by an automated check — mechanical tests
        plus a second model reading it as an editor — before publication. <strong>No person reads a
        story before it is published.</strong> This is disclosed on every story and explained on the{" "}
        <Link href="/about/">about page</Link>. We do not present these stories as the work of a
        human author.
      </p>

      <h2>No warranty</h2>
      <p>
        The site is provided as it is. We try to keep it accurate, available, and suitable for
        readers of any age, but we do not promise that it will always be online or free of
        errors. We are not liable for any loss arising from your use of the site.
      </p>

      <h2>Links to other sites</h2>
      <p>
        Where we link out — to a public-domain source, for example — we are not responsible
        for what is on the other end.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms; the date at the top will change when we do. Questions go to{" "}
        <ContactLink />.
      </p>
    </div>
  );
}
