"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * The body of /account/verified/ (issue #208's probe, F2).
 *
 * The page used to say "Email confirmed" unconditionally — including when
 * Better Auth bounced the reader back with `?error=INVALID_TOKEN`, i.e. the
 * link had expired or was already used. The copy was a lie in exactly the
 * case a reader needs it to be true.
 *
 * The server renders the success state (a static export cannot branch on a
 * query string); this notice reads `?error=` on the client and swaps in the
 * failure panel. Without JavaScript, an errored link still shows the success
 * copy — the same as before this fix — so nothing regresses, and the common
 * path (a valid link, no error) is correct without JS.
 */
export function VerifiedNotice() {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const error = new URLSearchParams(window.location.search).get("error");
    if (error) setFailed(true);
  }, []);

  if (failed) {
    return (
      <div className="account account--standalone">
        <p className="account__eyebrow">Account</p>
        <h1 className="account__headline">That link did not work</h1>
        <p>
          The confirmation link has expired or was already used. Your address is not confirmed
          yet; the account itself is fine.
        </p>
        <p className="account__note">
          Sign in on the account page and choose <strong>Resend confirmation email</strong> for a
          fresh link. Reset mail only goes to confirmed addresses, so it is worth doing now.
        </p>
        <div className="account__actions">
          <Link className="btn btn--primary" href="/account/">
            Go to your account
          </Link>
          <Link className="btn btn--quiet" href="/browse/">
            Start reading
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="account account--standalone">
      <p className="account__eyebrow">Account</p>
      <h1 className="account__headline">Email confirmed</h1>
      <p>
        Thank you; that address is now confirmed on your WishingTales account. Your reading
        progress, favourites and reader preferences will sync wherever you sign in.
      </p>
      <p className="account__note">
        Signed in on this device? You can keep reading straight away. On another device, sign in
        from the account page and your place arrives with you.
      </p>
      <div className="account__actions">
        <Link className="btn btn--primary" href="/browse/">
          Start reading
        </Link>
        <Link className="btn btn--quiet" href="/account/">
          Go to your account
        </Link>
      </div>
    </div>
  );
}
