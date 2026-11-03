'use client';
import { useMemo, useState } from 'react';
import { OPTIONS } from '@/lib/personal-shopping/schema.mjs';
import { activeFilters, explainEmpty } from '@/lib/personal-shopping/explain.mjs';
import ProductCard from './ProductCard';
import Choices from './Choices';
import { LoadingEdit, SkeletonGrid } from './LoadingEdit';

const SORTS = [
  ['match', 'Best match'],
  ['price_asc', 'Price: low to high'],
  ['price_desc', 'Price: high to low'],
];
const priceOf = (p) => p.offers?.[0]?.price;

// Personal edit: heading, demo/real notice, active filters, refine panel, glass toolbar, grid and honest empty states.
export default function ResultsView({ result, account, prefs, set, toggle, busy, message, messageKind, liveCount, onRerun, onEdit }) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('match');
  const demo = result.mode === 'demo';
  const used = result._prefs || prefs; // what this result was actually computed from

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = result.results.filter((p) =>
      !needle || [p.title, p.brand, p.offers?.[0]?.retailer, p.category].filter(Boolean).join(' ').toLowerCase().includes(needle));
    if (sort !== 'match') {
      const dir = sort === 'price_asc' ? 1 : -1;
      list = [...list].sort((a, b) => {
        const pa = priceOf(a), pb = priceOf(b);
        if (pa == null) return 1; // unknown prices always last
        if (pb == null) return -1;
        return (pa - pb) * dir;
      });
    }
    return list;
  }, [result.results, q, sort]);

  const filters = activeFilters(used);
  const empty = result.results.length === 0 ? explainEmpty(result.diagnostics, used) : null;

  return (
    <div className="discover-shell results-page">
      <div className="result-heading">
        <div>
          <p className="eyebrow">Your personal edit</p>
          <h1>Made for the way<br />you move.</h1>
          <p className="result-summary">{result.summary}</p>
        </div>
        <button className="discover-secondary" onClick={() => onEdit(0)}>Change my answers</button>
      </div>

      <div className={`demo-notice ${demo ? 'is-demo' : 'is-live'}`} role="status">
        <span className={`badge ${demo ? 'badge-demo' : 'badge-live'}`}>{demo ? 'Demo' : 'Catalog'}</span>
        <span>{demo ? 'Demo catalog / illustrative samples - not live products or prices.' : 'Catalog results reflect available source evidence. Verify details with the retailer.'}</span>
      </div>

      {filters.length > 0 && (
        <ul className="filter-chips" aria-label="Active filters">
          {filters.map((f) => (
            <li key={f.id} className={`filter-pill ${f.hard ? 'is-hard' : ''} ${f.locked ? 'is-locked' : ''}`}>
              <span>{f.text}</span>
              {f.reset && !busy && <button type="button" onClick={() => onRerun(f.reset)} aria-label={`Remove filter: ${f.text}`}>×</button>}
            </li>
          ))}
        </ul>
      )}
      {message && <div className={`wizard-message ${messageKind === 'error' ? 'is-error' : ''}`} role={messageKind === 'error' ? 'alert' : 'status'}>{message}</div>}

      <details className="refine-panel">
        <summary>Refine preferences</summary>
        <div className="refine-body">
          <p className="hint">Style, colour and fit only change the order. Budget and size can hide products. Your saved restrictions are always kept.</p>
          <Choices title="Style" values={OPTIONS.styles} selected={prefs.style} onToggle={(v) => toggle('style', v)} />
          <Choices title="Colors" values={OPTIONS.colors} selected={prefs.colors} onToggle={(v) => toggle('colors', v)} />
          <div className="discover-row">
            <label className="discover-label">Maximum price <span>Optional</span>
              <input type="number" min="0" max="100000" step="0.01" value={prefs.max_price ?? ''} onChange={(e) => set('max_price', e.target.value === '' ? null : Number(e.target.value))} />
            </label>
            <label className="discover-label">Currency
              <select value={prefs.currency} onChange={(e) => set('currency', e.target.value)}><option>EUR</option><option>USD</option><option>GBP</option></select>
            </label>
          </div>
          <div className="discover-row">
            <label className="discover-label">Fit <span>Optional</span>
              <select value={prefs.fit} onChange={(e) => set('fit', e.target.value)}>
                <option value="">Any</option>
                {OPTIONS.fits.map((x) => <option key={x} value={x}>{x[0].toUpperCase() + x.slice(1)}</option>)}
              </select>
            </label>
            <label className="discover-label">Catalog source
              <select value={prefs.mode} onChange={(e) => set('mode', e.target.value)}>
                <option value="demo">Demo catalog — sample listings</option>
                <option value="live">{liveCount ? `Live catalog (${liveCount} product${liveCount === 1 ? '' : 's'})` : 'Live — no products yet'}</option>
              </select>
            </label>
          </div>
          {prefs.mode === 'demo'
            ? <p className="hint">Size filtering needs verified stock and size data, which the demo catalog does not have, so it is not offered here.</p>
            : (
              <label className="discover-label">Size <span>Optional</span>
                <input maxLength={30} value={prefs.size} onChange={(e) => set('size', e.target.value)} placeholder="e.g. M" />
              </label>
            )}
          <button type="button" className="discover-button" disabled={busy} onClick={() => onRerun()}>Update results</button>
        </div>
      </details>

      {busy ? (
        <><LoadingEdit /><SkeletonGrid /></>
      ) : (
        <>
          {result.results.length > 0 && (
            <div className="filter-bar glass glass-regular" role="search" aria-label="Filter your edit">
              <label className="filter-search">
                <span className="sr-only">Search your edit</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></svg>
                <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, brand or shop" />
              </label>
              <label className="filter-sort">
                <span className="sr-only">Sort by</span>
                <select value={sort} onChange={(e) => setSort(e.target.value)}>
                  {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
              <span className="filter-count" aria-live="polite">{shown.length} of {result.results.length}</span>
            </div>
          )}

          {empty ? (
            <div className="empty-state">
              <h2>No matches available</h2>
              <p>There may be no catalog products with enough evidence for your requirements. Your restrictions have not been relaxed.</p>
              <ul className="empty-reasons">{empty.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
              {result.diagnostics?.filters?.some((f) => f.filter === 'avoid_materials' && f.excluded > 0 && f.remaining === 0) && (
                <p>Your material restrictions remain active. Review your saved preferences to change them.</p>
              )}
              {result.diagnostics?.filters?.some((f) => f.filter === 'required_features' && f.excluded > 0 && f.remaining === 0) && (
                <p>Every feature you marked as required must be documented for the same garment. Missing evidence does not necessarily mean the garment lacks the feature.</p>
              )}
              <div className="empty-actions">
                {empty.actions.map((a) => <button key={a.id} className="discover-button" onClick={() => onRerun(a.patch)}>{a.label}</button>)}
                {result.diagnostics?.filters?.some((f) => f.filter === 'avoid_materials' && f.excluded > 0 && f.remaining === 0) && (
                  <button type="button" className="discover-button" onClick={() => onEdit(2)}>Review saved restrictions</button>
                )}
                {result.diagnostics?.filters?.some((f) => f.filter === 'required_features' && f.excluded > 0 && f.remaining === 0) && (
                  <button type="button" className="discover-button" onClick={() => onEdit(2)}>Review required features</button>
                )}
                <button className="discover-secondary" onClick={() => onEdit(0)}>Change my answers</button>
              </div>
            </div>
          ) : shown.length === 0 ? (
            <div className="empty-state">
              <h2>Nothing matches that search</h2>
              <p>Try a different word, or clear the search to see your whole edit.</p>
              <button className="discover-secondary" onClick={() => setQ('')}>Clear search</button>
            </div>
          ) : (
            <div className="product-grid">
              {shown.map((x) => (
                <ProductCard key={x.id} product={x} demo={demo} account={account} avoided={used.avoid_materials} testFeedback={result._test_feedback_enabled} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
