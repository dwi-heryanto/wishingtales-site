"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ADULT_NOTICE_KEY } from "@/lib/gate";

/**
 * Runs before the rest of the page is parsed, like the reader-theme script and for the
 * same reason: an adult page must not paint its story first and ask afterwards.
 *
 * Its one job is a fact only the browser knows: `data-adult-ack` — this reader has
 * already said they are an adult. It lives on `<html>` because it is a fact about the
 * *browser*, not about the page, so it stays true while the reader moves around the adult
 * shelf. The dark default used to be set here too; it belongs to the reader-theme script
 * now, which derives it from the address on every adult page, gate or no gate (ADR-0002's
 * third amendment).
 */
const SCRIPT = `(function(){try{
var d=document.documentElement;
if(localStorage.getItem("${ADULT_NOTICE_KEY}"))d.setAttribute("data-adult-ack","");
}catch(e){}})();`;

/** The stored value is a timestamp; only its presence matters. */
function readAck(): boolean {
  try {
    return localStorage.getItem(ADULT_NOTICE_KEY) !== null;
  } catch {
    return false;
  }
}

/**
 * The one-time click-through in front of the adult shelf and every story on it.
 *
 * **A speed bump, not enforcement** — ADR-0002 says so, and the static export is why: this
 * page arrived with the story already in it, so the notice hides the text from a reader
 * who has not answered rather than withholding it from one who has. What it stops is the
 * child who taps the wrong shelf.
 *
 * It fails closed. With JavaScript off, `data-adult-ack` is never set and the notice is
 * all that renders — an adult who cannot read the story is the better error.
 *
 * One notice covers the shelf and every story behind it, because the ack is per browser:
 * answering once is the "one-time" the ADR asks for, and asking again per story would
 * only train a reader to click through without reading it.
 */
export function AdultGate({ what }: { what: "shelf" | "story" }) {
  const [acknowledged, setAcknowledged] = useState(false);

  // Adopt the acknowledgement the pre-paint script already read. The theme is not this
  // component's business any more: ReaderThemeSync keeps it on the page's default across
  // client-side navigation (ADR-0002's third amendment).
  useEffect(() => {
    setAcknowledged(readAck());
  }, []);

  function acknowledge() {
    try {
      localStorage.setItem(ADULT_NOTICE_KEY, new Date().toISOString());
    } catch {
      /* private mode: the notice shows again next visit, which is the safe direction */
    }
    document.documentElement.setAttribute("data-adult-ack", "");
    setAcknowledged(true);
  }

  if (acknowledged) return null;

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />
      <section className="adult-gate" aria-labelledby="adult-gate-title">
        <p className="eyebrow">Adults only</p>
        {/* h2, not h1: the story's own h1 is in this document too, and a page with two h1s
            is a page a screen reader has no outline for. `scripts/verify-build.mjs` counts
            them for the same reason. */}
        <h2 className="adult-gate__title" id="adult-gate-title">
          These stories are written for grown-ups
        </h2>
        <p className="adult-gate__note">
          {what === "shelf" ? "This shelf is" : "This story is"} not part of the children&rsquo;s
          library. Some of it is frightening, and none of it is written for a young reader.
        </p>
        <div className="actions">
          <button type="button" className="btn btn--primary" onClick={acknowledge}>
            I&rsquo;m an adult &mdash; continue
          </button>
          <Link className="btn btn--quiet" href="/stories/">
            Take me back to the children&rsquo;s stories
          </Link>
        </div>
      </section>
    </>
  );
}
