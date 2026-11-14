"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ADULT_NOTICE_KEY } from "@/lib/gate";
import { accountsEnabled, getTeenShelf, hasSessionToken, verifyTeenPin } from "@/lib/accounts";

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

type GateState = "blocked" | "pin" | "acknowledged";

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
 * **Account-aware (ADR-0015 §4.3):** a signed-in account whose teen shelf is switched on
 * passes the gate; when the account also carries a PIN, the gate asks for it first. This
 * is cosmetic in exactly the same sense as the click-through: it decides which people the
 * notice lets through, not what the HTML contains. Guests see the same notice as before.
 */
export function AdultGate({ what }: { what: "shelf" | "story" }) {
  /*
   * The first client render must be the server's: "blocked" (the gate). Reading
   * localStorage in the useState initializer was the bug that broke the ack:
   * the initializer differs between server and client, React discards the
   * server subtree on the mismatch, and the inline pre-paint script inside it
   * never executes — so `data-adult-ack` is never set and the prose stays
   * hidden. The old code got this right by accident by starting `false` and
   * reading the ack in an effect; this keeps that contract.
   */
  const [state, setState] = useState<GateState>("blocked");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (readAck()) {
      setState("acknowledged");
      return;
    }
    if (!accountsEnabled() || !hasSessionToken()) return; // stays blocked: the notice
    let cancelled = false;
    getTeenShelf()
      .then((teen) => {
        if (cancelled) return;
        if (teen?.enabled) setState(teen.has_pin ? "pin" : "acknowledged");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  function acknowledge() {
    try {
      localStorage.setItem(ADULT_NOTICE_KEY, new Date().toISOString());
    } catch {
      /* private mode: the notice shows again next visit, which is the safe direction */
    }
    document.documentElement.setAttribute("data-adult-ack", "");
    setState("acknowledged");
  }

  async function submitPin(event: React.FormEvent) {
    event.preventDefault();
    if (!/^\d{4,8}$/.test(pin)) {
      setError("PINs are 4 to 8 digits.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (await verifyTeenPin(pin)) {
        acknowledge();
      } else {
        setError("That PIN does not match this account.");
      }
    } catch {
      setError("Could not check the PIN. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (state === "acknowledged") return null;

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
        {state === "pin" ? (
          <form className="adult-gate__pin" onSubmit={submitPin}>
            <label className="account__label" htmlFor="adult-gate-pin">
              Account PIN
            </label>
            <input
              className="account__input"
              id="adult-gate-pin"
              name="adult-gate-pin"
              inputMode="numeric"
              pattern="\d{4,8}"
              maxLength={8}
              required
              value={pin}
              onChange={(event) => setPin(event.target.value)}
            />
            <p className="account__hint">
              This account has a PIN on its teen shelf. Enter it to continue on this device.
            </p>
            <div className="actions">
              <button type="submit" className="btn btn--primary" disabled={busy}>
                {busy ? "Checking…" : "Continue"}
              </button>
              <Link className="btn btn--quiet" href="/stories/">
                Take me back to the children&rsquo;s stories
              </Link>
            </div>
            {error ? (
              <p className="account__error" role="alert">
                {error}
              </p>
            ) : null}
          </form>
        ) : (
          <div className="actions">
            <button type="button" className="btn btn--primary" onClick={acknowledge}>
              I&rsquo;m an adult, continue
            </button>
            <Link className="btn btn--quiet" href="/stories/">
              Take me back to the children&rsquo;s stories
            </Link>
          </div>
        )}
      </section>
    </>
  );
}
