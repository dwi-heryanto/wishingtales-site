import type { Metadata, Viewport } from "next";
import { Fraunces, Geist, Newsreader } from "next/font/google";
import "./globals.css";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { ReaderThemeScript } from "@/components/ReaderThemeScript";
import { ReaderThemeSync } from "@/components/ReaderThemeSync";
import { SITE } from "@/lib/site";

const fraunces = Fraunces({ subsets: ["latin"], display: "swap", variable: "--font-fraunces" });
const newsreader = Newsreader({
  subsets: ["latin"],
  display: "swap",
  style: ["normal", "italic"],
  variable: "--font-newsreader",
});
const geist = Geist({ subsets: ["latin"], display: "swap", variable: "--font-geist" });

if (typeof window === "undefined" && !SITE.contactEmail) {
  console.warn(
    "[wishingtales] NEXT_PUBLIC_CONTACT_EMAIL is not set, so the legal pages say there is no " +
      "contact address yet. Set it before the site is public — any address you control will do.",
  );
}

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `${SITE.name} — ${SITE.tagline}`, template: `%s · ${SITE.name}` },
  description: SITE.description,
  applicationName: SITE.name,
  authors: [{ name: SITE.byline }],
  /*
   * Deliberately no `title`, `description` or `url` here.
   *
   * Next resolves an omitted `openGraph.title`/`description` from the page's own title
   * and description, so every page now shares the right name instead of the layout's
   * site-wide line (the audit's "<title> and og:title differ", generalised). A layout
   * `url` had the opposite effect: it cannot know the page, so it stamped the homepage
   * address onto every share card. A page that wants an og:url sets its own; the rest
   * leave it to the platform and the canonical.
   */
  openGraph: {
    type: "website",
    siteName: SITE.name,
    locale: "en",
  },
  /*
   * No `robots` here, deliberately. A layout-level `robots` is a second robots tag
   * rather than a default: Next emits both it and the page's own, so an adult page that
   * means `noindex, nofollow` shipped a head that also said `index, follow`
   * (scripts/verify-build.mjs now checks for exactly that). Crawlers treat the two as
   * one instruction with two answers. Left absent, the default is "index, follow"
   * anyway, and the pages that mean something else are the only ones that say so.
   */
  /*
   * Two search engines, two tags, both unset until the owner sets a repository variable.
   * Google's other route is the HTML file in site/public/ (which Pages 308s, so the
   * redirects generator rewrites it); Bing's other route is a BingSiteAuth.xml file. The
   * tags are wired here so whichever method a dashboard offers will work.
   */
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
    other: process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION
      ? { "msvalidate.01": process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION }
      : undefined,
  },
  /*
   * No `alternates.types` here. A page-level `alternates.canonical` replaces the whole
   * alternates object rather than merging with it, so every built page dropped the feed
   * link while this line sat here looking correct (ADR-0009). The link is rendered once
   * in the body below; React 19 hoists it into <head> on every page.
   */
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  /*
   * One colour, the warm paper the children's library opens in. The page's own theme is
   * now the page's default rather than the OS's (ADR-0002's third amendment), so an
   * OS-matched pair would paint dark browser chrome above a light page; the pre-paint
   * script rewrites this tag to the theme it actually applied.
   */
  themeColor: "#f7f2ea",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${newsreader.variable} ${geist.variable}`}>
      <body>
        <link
          rel="alternate"
          type="application/rss+xml"
          title={SITE.name + " stories"}
          href="/rss.xml"
        />
        <ReaderThemeScript />
        <ReaderThemeSync />
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />
        {SITE.beaconToken ? (
          <script
            defer
            src="https://static.cloudflareinsights.com/beacon.min.js"
            data-cf-beacon={JSON.stringify({ token: SITE.beaconToken })}
          />
        ) : null}
      </body>
    </html>
  );
}
