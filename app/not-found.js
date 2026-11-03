import Link from "next/link";

export const metadata = { title: "Page not found — FEELING FINE" };

// Shown for unknown addresses.
export default function NotFound() {
  return (
    <div className="state-page">
      <p className="eyebrow">Error 404</p>
      <h1>This page isn&apos;t here.</h1>
      <p className="muted">The link may be out of date. Try one of these instead.</p>
      <div className="page-head-actions">
        <Link className="btn" href="/discover">Find clothes for me</Link>
        <Link className="btn btn-secondary" href="/search">Find nearby stores</Link>
      </div>
    </div>
  );
}
