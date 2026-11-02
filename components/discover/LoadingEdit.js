'use client';
import { useEffect, useState } from 'react';

const PHRASES = [
  'Reading your comfort preferences…',
  'Checking fabrics and restrictions…',
  'Matching fastenings and fit…',
  'Arranging your edit…',
];

// Shown while recommendations load: a threading line plus plain-language progress. No internals exposed.
export function LoadingEdit() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % PHRASES.length), 1800);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="loading-edit" role="status" aria-live="polite">
      <div className="thread" aria-hidden="true"><span /></div>
      <h2 id="wizard-title">Finding your edit…</h2>
      <p className="loading-phrase">{PHRASES[i]}</p>
    </div>
  );
}

export function SkeletonGrid({ count = 3 }) {
  return (
    <div className="product-grid" aria-hidden="true">
      {Array.from({ length: count }, (_, k) => (
        <div className="skeleton-card" key={k}>
          <div className="product-media shimmer" />
          <div className="product-copy"><span className="shimmer line w60" /><span className="shimmer line w80" /><span className="shimmer line w40" /></div>
        </div>
      ))}
    </div>
  );
}
