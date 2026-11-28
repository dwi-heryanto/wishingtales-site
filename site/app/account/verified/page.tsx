import type { Metadata } from "next";
import { VerifiedNotice } from "@/components/VerifiedNotice";

export const metadata: Metadata = {
  title: "Email confirmed",
  description: "Your WishingTales account's email is confirmed. Your reading progress and favourites now follow you between devices.",
  alternates: { canonical: "/account/verified/" },
  robots: { index: false, follow: false },
};

/**
 * The landing page after the confirmation link is clicked (ADR-0015).
 *
 * A dedicated route on purpose: the verification mail redirects here, and a
 * reader who has just clicked "confirm" should see the result immediately —
 * not a status line at the bottom of the account form. The page is static;
 * its body is a small client notice that also renders the expired-link case
 * (`?error=INVALID_TOKEN`), which the page used to report as success
 * (issue #208's probe, F2).
 */
export default function EmailConfirmedPage() {
  return (
    <div className="page doc">
      <VerifiedNotice />
    </div>
  );
}
