'use client';
import { useState } from 'react';
import Link from 'next/link';
import GarmentArt from '@/components/ui/GarmentArt';

const label = (s) => s.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const SCORE_LABELS = [
  ['accessibility', 'Accessibility features'],
  ['material', 'Materials'],
  ['style_fit', 'Style and fit'],
  ['budget', 'Budget'],
  ['feedback', 'Your feedback'],
];
const signed = (n) => (n > 0 ? `+${n}` : String(n));

// One recommended product. Demo samples are visually distinct (dashed badge, illustrated art, "sample" labels).
export default function ProductCard({ product, demo, account, testFeedback, avoided = [] }) {
  const offer = product.offers?.[0];
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState('');
  const [saved, setSaved] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const canGiveFeedback = (!demo || testFeedback) && account;
  // Only exclusions this garment actually documents; undocumented is unknown, never "free of".
  const confirmedFree = avoided.filter((m) => product.evidence?.some((e) => e.attribute === m && e.value === 'absent'));

  async function feedback(action) {
    if (action === 'not_for_me' && !reason.trim()) { setStatus('Add a reason first.'); return; }
    const r = await fetch('/api/personal-shopping/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: product.id, action, reason }),
    });
    const data = await r.json();
    if (r.ok && action === 'save') setSaved(true);
    setStatus(r.ok ? 'Feedback saved for your next search.' : data.error);
  }

  // Features the retailer merely asserts (not independently verified) are marked as such.
  const claimedSet = new Set((product.evidence || []).filter((e) => e.evidence_type === 'unverified_seller_claim' && e.value === true).map((e) => e.attribute));
  const checkedOn = offer?.verified_at && !Number.isNaN(Date.parse(offer.verified_at))
    ? new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(offer.verified_at)) : null;

  const price = offer?.price == null
    ? 'Price unknown'
    : new Intl.NumberFormat('en', { style: 'currency', currency: offer.currency }).format(offer.price);

  return (
    <article className={`product-card ${demo ? 'is-demo' : 'is-live'}`}>
      <div className="product-media">
        {product.image_url && !demo && !imgFailed ? (
          <img src={product.image_url} alt={product.title} loading="lazy" referrerPolicy="no-referrer" onError={() => setImgFailed(true)} />
        ) : (
          <GarmentArt category={product.category} label={demo ? 'SAMPLE' : 'IMAGE UNAVAILABLE'} />
        )}
        <span className={`badge sample-badge ${demo ? 'badge-demo' : 'badge-live'}`}>
          {demo ? 'Demo sample - not for sale' : 'Catalog listing'}
        </span>
        {canGiveFeedback && (
          <button type="button" className={`wish ${saved ? 'is-saved' : ''}`} onClick={() => feedback('save')} aria-pressed={saved} aria-label={saved ? 'Saved to wishlist' : 'Save to wishlist'}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.2-9.3C1.6 7.700 3.800 4.500 7 4.500c2 0 3.500 1.100 5 3 1.500-1.900 3-3 5-3 3.200 0 5.400 3.200 4.200 6.700C19.500 15.900 12 20.500 12 20.500z" /></svg>
          </button>
        )}
      </div>

      <div className="product-copy">
        <p className="product-brand">{product.brand || 'Brand unknown'} · {offer?.retailer || 'Retailer unknown'}</p>
        <h3>{product.title}</h3>
        <div className="product-price-row">
          <strong className="product-price">{price}</strong>
          {demo && <small>sample price</small>}
          {!demo && offer?.price != null && <small>{offer.currency}</small>}
          <span className="match-pill" title="Higher means a closer match to your preferences">Match {product.match_score}</span>
        </div>
        <p className="product-status">{demo ? 'Sample data' : label(product.verification_status)}{!demo && (checkedOn ? ` · price observed ${checkedOn}` : ' · price date not recorded')}</p>

        {!demo && (!product.image_url || imgFailed || offer?.price == null || !offer?.currency || !offer?.product_url || !offer?.verified_at || !product.evidence?.some(e => e.value === true && e.source_url && e.checked_at)) && (
          <p className="product-note">Incomplete shopping listing: an approved image, observed price, direct link or accessibility evidence is missing.</p>
        )}

        {product.features?.length > 0 && (
          <div className="feature-chips" role="group" aria-label={demo ? 'Sample features' : 'Documented features'}>
            {product.features.map((f) => (
              <span key={f} className={`tag ${claimedSet.has(f) ? 'is-claim' : ''}`} title={claimedSet.has(f) ? 'Stated by the seller; not independently verified' : undefined}>
                {label(f)}{claimedSet.has(f) ? ' · seller claim' : ''}
              </span>
            ))}
          </div>
        )}
        {confirmedFree.length > 0 && (
          <p className="product-note verified-line">Confirmed free of: {confirmedFree.map(label).join(', ')}{demo ? ' (sample declaration)' : ''}.</p>
        )}

        {product.match_reasons?.length > 0 && (
          <div className="why">
            <p className="why-title">Why it matches</p>
            <ul className="why-list">
              {product.match_reasons.map((x) => <li key={x}>{x}</li>)}
            </ul>
          </div>
        )}

        {product.unknowns?.length > 0 && <p className="product-note">Unknown: {product.unknowns.join('; ')}.</p>}

        <details className="score-details">
          <summary>How it scored</summary>
          <p className="sr-only">Score: accessibility {product.score_breakdown.accessibility}, material {product.score_breakdown.material}, style and fit {product.score_breakdown.style_fit}, budget {product.score_breakdown.budget}, feedback {product.score_breakdown.feedback}.</p>
          <dl className="score-grid" aria-hidden="true">
            {SCORE_LABELS.map(([k, name]) => (
              <div key={k}><dt>{name}</dt><dd>{signed(product.score_breakdown[k])}</dd></div>
            ))}
          </dl>
        </details>

        {!demo && offer?.product_url && (
          <a className="btn btn-small retailer-link" href={offer.product_url} target="_blank" rel="noopener noreferrer">View at retailer <span aria-hidden="true">↗</span><span className="sr-only"> ({offer.retailer || 'retailer'}, opens in a new tab)</span></a>
        )}
        {!demo && !offer?.product_url && <p className="product-note">No direct retailer link has been recorded for this listing.</p>}

        {canGiveFeedback ? (
          <div className="feedback">
            <div className="wizard-actions feedback-row">
              <button type="button" onClick={() => feedback('like')}>Like</button>
              <button type="button" onClick={() => feedback('dislike')}>Dislike</button>
              <button type="button" onClick={() => setDeclining((v) => !v)} aria-expanded={declining}>Not for me</button>
            </div>
            {declining && (
              <div className="decline">
                <label className="discover-label">Reason for not choosing
                  <input maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
                </label>
                <button type="button" className="btn btn-small btn-secondary" onClick={() => feedback('not_for_me')}>Send reason</button>
              </div>
            )}
            <p role="status" className="feedback-status">{status}</p>
          </div>
        ) : (
          account === false && !demo && <p className="product-note"><Link href="/login?next=/discover">Sign in</Link> to save and rate products.</p>
        )}
      </div>
    </article>
  );
}
