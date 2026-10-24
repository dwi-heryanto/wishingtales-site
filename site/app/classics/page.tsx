import type { Metadata } from "next";
import { EntryList } from "@/components/EntryList";
import { JsonLd } from "@/components/JsonLd";
import { getKidsClassics } from "@/lib/content";
import { collectionJsonLd } from "@/lib/jsonld";

export const metadata: Metadata = {
  title: "Retold classics",
  description:
    "Old stories told again in new words — Grimm, Andersen, Nesbit and more, all in the public domain and retold for a reader of any age.",
  alternates: { canonical: "/classics/" },
};

export default function ClassicsIndex() {
  const classics = getKidsClassics();

  return (
    <div className="page">
      <JsonLd
        data={collectionJsonLd({
          name: "Classics",
          description: "Retold public-domain stories for readers of any age.",
          path: "/classics/",
          entries: classics,
        })}
      />
      <section className="section">
        <h1 className="lede">Retold classics</h1>
        <p className="lede__note">
          Stories told for a hundred years or more, retold in fresh words. Each one lists where it
          came from, or browse <a href="/authors/">by author</a>. Everything is{" "}
          <a href="/browse/">all stories</a>.
        </p>
      </section>

      <section className="section section--tight" aria-labelledby="all-classics">
        <div className="section__head">
          <h2 className="section__title" id="all-classics">
            {classics.length === 1 ? "1 classic" : classics.length + " classics"}
          </h2>
          <a className="section__link" href="/sources/">
            Sources and provenance
          </a>
        </div>
        <EntryList
          entries={classics}
          emptyNote="No retellings yet. The first one is in editing — each classic is checked against the public-domain rule before it can be published."
        />
      </section>
    </div>
  );
}
