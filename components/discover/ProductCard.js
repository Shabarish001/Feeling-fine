'use client';
import { useState } from 'react';
import Link from 'next/link';
import GarmentArt from '@/components/ui/GarmentArt';
import { evidenceFor } from '@/lib/personal-shopping/matching.mjs';

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
export default function ProductCard({ product, demo, account, testFeedback, avoided = [], onSessionDismiss }) {
  const offer = product.offers?.[0];
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState('');
  const [saved, setSaved] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const [open, setOpen] = useState(false); // secondary details stay tucked away until asked for
  const canGiveFeedback = (!demo || testFeedback) && account;
  // Only exclusions this garment actually documents; undocumented is unknown, never "free of".
  const confirmedFree = avoided.filter((m) => evidenceFor(product, m, 'absent', demo, offer));

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

  const retailerName = offer?.retailer || 'retailer';
  // Never invent a price: with no observed price, point to the retailer's own page instead.
  const price = offer?.price == null
    ? (offer?.product_url && !demo ? `Price on ${retailerName}` : 'Price unknown')
    : new Intl.NumberFormat('en', { style: 'currency', currency: offer.currency }).format(offer.price);

  const reasons = product.match_reasons || [];
  const features = product.features || [];
  const shownFeatures = features.slice(0, 3);
  const detailsId = `details-${product.id}`;

  return (
    <article className={`product-card ${demo ? 'is-demo' : 'is-live'} ${open ? 'is-open' : ''}`}>
      <div className="product-media">
        {product.image_url && !demo && !imgFailed ? (
          <img src={product.image_url} alt={product.title} loading="lazy" referrerPolicy="no-referrer" onError={() => setImgFailed(true)} />
        ) : (
          <GarmentArt category={product.category} label={demo ? 'SAMPLE' : 'ILLUSTRATION'} />
        )}
        <span className={`badge sample-badge ${demo ? 'badge-demo' : 'badge-live'}`}>
          {demo ? 'Demo sample - not for sale' : 'Catalog listing'}
        </span>
        {canGiveFeedback && (
          <button type="button" className={`wish ${saved ? 'is-saved' : ''}`} onClick={() => feedback('save')} aria-pressed={saved} aria-label={saved ? 'Saved to wishlist' : 'Save to wishlist'}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.2-9.3C1.6 7.7 3.8 4.5 7 4.5c2 0 3.5 1.1 5 3 1.5-1.9 3-3 5-3 3.2 0 5.4 3.2 4.2 6.7C19.5 15.9 12 20.5 12 20.5z" /></svg>
          </button>
        )}
        {product.match_score > 0 && <span className="match-pill" title="Higher means a closer match to your preferences">Match {product.match_score}</span>}

        {/* Hover / keyboard-focus quick view: why this piece was chosen. Touch devices get it in Details. */}
        {(reasons.length > 0 || features.length > 0) && (
          <div className="product-quick">
            <p className="why-title">{reasons.length ? 'Why it matches' : 'Highlights'}</p>
            <ul className="why-list">
              {(reasons.length ? reasons : features.map(label)).slice(0, 3).map((x) => <li key={x}>{x}</li>)}
            </ul>
            {(reasons.length || features.length) > 3 && <p className="quick-more">+{(reasons.length || features.length) - 3} more in Details</p>}
            {!reasons.length && !demo && product.verification_status === 'unverified' && <p className="quick-more">Unverified research claims</p>}
          </div>
        )}
      </div>

      <div className="product-copy">
        <p className="product-brand">{product.brand || 'Brand unknown'} · {offer?.retailer || 'Retailer unknown'}</p>
        <h3 className="product-title" title={product.title}>{product.title}</h3>

        <div className="product-price-row">
          <strong className={`product-price ${offer?.price == null ? 'is-unknown' : ''}`}>{price}</strong>
          {demo && <small>sample price</small>}
          {!demo && offer?.price != null && <small>{offer.currency}</small>}
        </div>
        {!demo && <p className="product-status">{label(product.verification_status)}{checkedOn ? ` · price observed ${checkedOn}` : ''}</p>}

        {shownFeatures.length > 0 && (
          <div className="feature-chips" role="group" aria-label={demo ? 'Sample features' : product.verification_status === 'unverified' ? 'Unverified research features' : 'Documented features'}>
            {shownFeatures.map((f) => (
              <span key={f} className={`tag ${claimedSet.has(f) ? 'is-claim' : ''}`} title={claimedSet.has(f) ? 'Unverified research claim' : undefined}>
                {label(f)}
              </span>
            ))}
            {features.length > shownFeatures.length && <span className="tag tag-more">+{features.length - shownFeatures.length}</span>}
          </div>
        )}
        {/* Allergy confirmation stays visible: it is safety information, not a detail. */}
        {confirmedFree.length > 0 && (
          <p className="product-note verified-line">Confirmed free of: {confirmedFree.map(label).join(', ')}{demo ? ' (sample declaration)' : ''}.</p>
        )}

        <div className="product-actions">
          {!demo && offer?.product_url && (
            <a className="btn btn-small retailer-link" href={offer.product_url} target="_blank" rel="noopener noreferrer">{offer.retailer === 'Zalando' ? 'View on Zalando' : 'View at retailer'} <span aria-hidden="true">↗</span><span className="sr-only"> ({offer.retailer || 'retailer'}, opens in a new tab)</span></a>
          )}
          <button type="button" className="details-toggle" aria-expanded={open} aria-controls={detailsId} onClick={() => setOpen((v) => !v)}>
            {open ? 'Less' : 'Details'}
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
        {!demo && !offer?.product_url && <p className="product-note">No direct retailer link has been recorded for this listing.</p>}

        {open && (
          <div className="product-details" id={detailsId}>
            {!demo && (!product.image_url || imgFailed) && <p className="product-note">Representative illustration, not a photograph of this product.</p>}
            {!demo && product.verification_status === 'unverified' && <p className="product-note">Research listing: identity and features have not been independently verified. Check the retailer before relying on them.</p>}
            {!demo && product.description && <p className="product-note">{product.verification_status === 'unverified' ? 'Research summary: ' : ''}{product.description}</p>}
            {!demo && product.features?.includes('magnetic_closure') && <p className="product-note">Contains magnetic fastenings. Check the retailer&apos;s safety guidance if you use an implanted medical device.</p>}
            {!demo && offer?.stock_status === 'unknown' && <p className="product-note">Availability is unknown; check the retailer.</p>}
            {!demo && offer?.price == null && <p className="product-note">No observed price has been recorded for this listing, so the current price is only shown on the retailer&apos;s site.</p>}
            {!demo && !checkedOn && offer?.price != null && <p className="product-note">Price date not recorded.</p>}
            {!demo && (!product.image_url || imgFailed || offer?.price == null || !offer?.currency || !offer?.product_url || !offer?.verified_at || !product.evidence?.some((e) => e.value === true && e.source_url && e.checked_at)) && (
              <p className="product-note">Incomplete shopping listing: an approved image, observed price, direct link or accessibility evidence is missing.</p>
            )}

            {features.length > shownFeatures.length && (
              <div className="feature-chips" role="group" aria-label="All features">
                {features.map((f) => <span key={f} className={`tag ${claimedSet.has(f) ? 'is-claim' : ''}`}>{label(f)}{claimedSet.has(f) ? ' · unverified claim' : ''}</span>)}
              </div>
            )}

            {reasons.length > 0 && (
              <div className="why">
                <p className="why-title">Why it matches</p>
                <ul className="why-list">{reasons.map((x) => <li key={x}>{x}</li>)}</ul>
              </div>
            )}
            {!demo && product.match_evidence?.some((e) => e.source_url) && (
              <p className="product-note">Product evidence: {[...new Map(product.match_evidence.filter((e) => e.source_url).map((e) => [e.attribute, e])).values()].map((e, i) => <span key={e.attribute}>{i > 0 ? ' · ' : ''}<a href={e.source_url} target="_blank" rel="noopener noreferrer">{label(e.attribute)} source</a></span>)}</p>
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

            {onSessionDismiss && <button type="button" className="discover-secondary" onClick={() => onSessionDismiss(product.id)}>Not suitable for me (this session)</button>}

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
              </div>
            ) : (
              account === false && !demo && <p className="product-note"><Link href="/login?next=/discover">Sign in</Link> to save and rate products.</p>
            )}
          </div>
        )}
        {/* Outside the collapsible panel so feedback results are still announced after it closes. */}
        {canGiveFeedback && <p role="status" className="feedback-status">{status}</p>}
      </div>
    </article>
  );
}
