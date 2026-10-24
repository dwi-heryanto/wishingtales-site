import type { Metadata } from "next";
import { getKidsThemes } from "@/lib/content";

export const metadata: Metadata = {
  title: "Themes",
  description: "Browse stories by what they are about — courage, friendship, the sea, and more.",
  alternates: { canonical: "/themes/" },
};

export default function ThemesIndex() {
  const themes = getKidsThemes();

  return (
    <div className="page">
      <section className="section">
        <h1 className="lede">Themes</h1>
        <p className="lede__note">Looking for a particular kind of story tonight? Start here.</p>
      </section>

      <section className="section section--tight">
        {themes.length === 0 ? (
          <p className="empty">Themes appear as stories are published.</p>
        ) : (
          <ul className="entry-list">
            {themes.map((hub) => (
              <li className="entry-list__item" key={hub.slug}>
                <a className="entry-list__link" href={hub.url}>
                  <span className="entry-list__meta">
                    {hub.entries.length === 1 ? "1 story" : hub.entries.length + " stories"}
                  </span>
                  <span className="entry-list__title">{hub.title}</span>
                  <span className="entry-list__summary">{hub.summary}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
