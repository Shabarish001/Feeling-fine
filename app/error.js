"use client";
import Link from "next/link";

// Shown when a page throws. Keeps the brand and offers a retry.
export default function Error({ reset }) {
  return (
    <div className="state-page" role="alert">
      <p className="eyebrow">Something went wrong</p>
      <h1>We couldn&apos;t load this page.</h1>
      <p className="muted">Please try again. If it keeps happening, come back in a moment.</p>
      <div className="page-head-actions">
        <button type="button" className="btn" onClick={() => reset()}>Try again</button>
        <Link className="btn btn-secondary" href="/">Back to home</Link>
      </div>
    </div>
  );
}
