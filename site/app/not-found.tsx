import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page">
      <section className="section">
        <h1 className="lede">That page is not here</h1>
        <p className="lede__note">
          The link may be old, or the story may have moved. Try the shelf instead.
        </p>
        <div className="actions">
          <Link className="btn" href="/stories/">
            Stories
          </Link>
          <Link className="btn btn--quiet" href="/classics/">
            Classics
          </Link>
        </div>
      </section>
    </div>
  );
}
