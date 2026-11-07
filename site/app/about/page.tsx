import type { Metadata } from "next";
import { ContactLink } from "@/components/ContactLink";
import Link from "next/link";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description:
    "Who makes WishingTales, how the stories are written and edited, and why the library is free.",
  alternates: { canonical: "/about/" },
};

export default function AboutPage() {
  return (
    <div className="page doc">
      <h1>About {SITE.name}</h1>
      <p>
        {SITE.name} is a small library of short stories, for three kinds of reader: a parent
        reading aloud to a child, a child reading alone, and an adult who wants something brief.
        Every story is meant to be finished in one sitting and to sound good read aloud, which is
        why they are full of talk and short scenes rather than long descriptions.
      </p>

      <h2 id="how-we-make-stories">How we make stories</h2>
      <p>
        Each story is written by an AI model and then reviewed by an automated check. That check is
        two things: mechanical tests for what a person notices reading aloud — length, how much of the
        story is dialogue, sentence and paragraph shape, phrases that read as machine-written — and a
        second model, from a different family to the one that wrote the draft, reading it the way an
        editor would. A draft that fails is revised and checked again. A story that cannot be brought
        up to standard is thrown away rather than published.
      </p>
      <p>
        <strong>No person reads these stories before they are published.</strong> We would rather say
        that plainly than let you assume otherwise. What it means in practice: an automated check
        catches contradictions, shape and padding, and it does not catch everything a person would.
        Covers are checked for stray lettering before they ship; the prose is not proofread by hand.
      </p>
      <p>
        Stories are signed by {SITE.byline} rather than by an invented author name. There is no
        fictional person behind this site, and we would rather say so than pretend otherwise.
      </p>
      <p className="doc__note">
        Every story on this site is marked as written with AI assistance. If that is not what you
        want to read to your children, that is a fair call — the{" "}
        <Link href="/classics/">classics</Link> are retellings of stories people have been telling
        for a hundred years or more.
      </p>

      <h2>Where the classics come from</h2>
      <p>
        Our retellings start from stories that are in the public domain: published in 1930 or
        earlier, by authors who died in 1955 or earlier. That rule keeps us clear in the United
        States, the European Union, and Indonesia at the same time. We work from editions that are
        themselves free to use, and we write new words — we never copy the original text. Each
        classic shows its source, and there is a full list on the{" "}
        <Link href="/sources/">sources page</Link>.
      </p>

      <h2>What it costs</h2>
      <p>
        Nothing. There are no accounts to make, no ads, and nothing to buy. Where a story has
        narration, you can listen to it for free. Reading preferences (text size, spacing, theme,
        and how far through a story you are) and listening positions are stored in your own browser
        and never sent to us. See the <Link href="/privacy/">privacy page</Link> for the detail.
      </p>

      <h2>Say hello</h2>
      <p>
        Corrections, complaints, and story requests are welcome at <ContactLink />.
      </p>
    </div>
  );
}
