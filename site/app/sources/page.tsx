import type { Metadata } from "next";
import { ContactLink } from "@/components/ContactLink";
import Link from "next/link";
import { getKidsClassics } from "@/lib/content";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Sources",
  description:
    "Where every retold classic on WishingTales comes from, with author, publication year, and the edition used.",
  alternates: { canonical: "/sources/" },
};

/**
 * A year as a reader should see it.
 *
 * Aesop has no year pair — he is conventionally placed in the sixth century BCE — and
 * the provenance schema needs integers, so the entry stores them negative. Rendered
 * raw, that reads as a bug: "(d. -564), first published -600". The minus sign is a
 * storage convention, not something to put in front of a reader.
 */
function yearLabel(year: number | undefined): string {
  if (year === undefined) return "unknown";
  return year < 0 ? `${-year} BCE` : String(year);
}

export default function SourcesPage() {
  /* The provenance page is a children's page like any other, so it lists the classics a
     child may be linked to and no others (ADR-0002). */
  const classics = getKidsClassics();

  return (
    <div className="page doc">
      <h1>Sources</h1>
      <p>
        Everything under <Link href="/classics/">Classics</Link> is a retelling. We start from a
        story that is in the public domain, then write it again in new words for a reader of ten to
        twelve. We never reproduce the original text, so a retelling is not a substitute for the
        real thing — where we can, we point you at a free edition of the original.
      </p>

      <h2>The rule we check against</h2>
      <p>
        A story qualifies only if it was first published in 1930 or earlier <em>and</em> its author
        died in 1955 or earlier. Both tests have to pass, because copyright terms differ between the
        United States, the European Union, and Indonesia, and we publish to all three at once.
      </p>
      <p>
        Editions come from sources that are themselves free to use, such as Project Gutenberg and
        Standard Ebooks. We do not take text from scans on the Internet Archive, whose terms limit
        their collections to scholarship and research.
      </p>

      <h2>Every classic on the site</h2>
      {classics.length === 0 ? (
        <p className="doc__note">
          No retellings have been published yet. When the first one goes up, its full provenance
          record appears here.
        </p>
      ) : (
        <dl className="provenance" style={{ marginBlockStart: "var(--space-md)" }}>
          {classics.map((entry) => (
            <div key={entry.slug}>
              <dt>
                <Link href={entry.url}>{entry.title}</Link>
              </dt>
              <dd>
                {entry.provenance?.author} (d. {yearLabel(entry.provenance?.deathYear)}), first published{" "}
                {yearLabel(entry.provenance?.firstPublished)}. Source: {entry.provenance?.source}. Edition used:{" "}
                {entry.provenance?.edition}. Public domain because {entry.provenance?.pdBasis}.
                Checked {entry.provenance?.verifiedOn}.
                {entry.provenance?.notes ? " " + entry.provenance.notes : ""}
              </dd>
            </div>
          ))}
        </dl>
      )}

      <h2>Cover images</h2>
      <p>
        Cover illustrations are generated for {SITE.name} and are not taken from any published
        edition. They are not the work of the original illustrators, and they do not reproduce
        trademarked character designs.
      </p>

      <h2>Corrections</h2>
      <p>
        If a source record here is wrong, we want to know. Write to <ContactLink /> and we will fix
        it or pull the story.
      </p>
    </div>
  );
}
