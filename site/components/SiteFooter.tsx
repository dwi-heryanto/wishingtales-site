import Link from "next/link";
import { SITE } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="page footer__grid">
        <div>
          <p className="footer__note">
            {SITE.name} publishes short stories to read aloud or read alone. Every story is written with
            an AI writing tool and checked automatically before it goes live — see the{" "}
            <Link href="/about/#how-we-make-stories">note on how we make stories</Link>.
          </p>
        </div>
        <div>
          <ul className="footer__links">
            <li>
              <Link href="/browse/">All stories</Link>
            </li>
            <li>
              <Link href="/stories/">Original stories</Link>
            </li>
            <li>
              <Link href="/classics/">Retold classics</Link>
            </li>
            <li>
              <Link href="/series/">Series</Link>
            </li>
            <li>
              <Link href="/themes/">Themes</Link>
            </li>
            <li>
              <Link href="/sources/">Sources</Link>
            </li>
            <li>
              {/* The audit's gap: a children's site with no way to report a problem or
                  suggest a story. `/about/` carries the address, or says honestly that
                  one is not set up yet. */}
              <Link href="/about/">Contact</Link>
            </li>
            <li>
              <Link href="/privacy/">Privacy</Link>
            </li>
            <li>
              <Link href="/terms/">Terms</Link>
            </li>
            <li>
              <Link href="/rss.xml">RSS</Link>
            </li>
          </ul>
          <p className="footer__note" style={{ marginBlockStart: "var(--space-sm)" }}>
            © {new Date().getFullYear()} {SITE.name}. Free to read, no accounts, no ads.
          </p>
        </div>
      </div>
    </footer>
  );
}
