'use client';
import { categoryLabel } from '@/lib/personal-shopping/needs.mjs';

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// Step 1: primary needs. Multi-select cards (checkboxes) with honest sample-catalog coverage.
export function NeedCards({ groups, needs, selectedIds, coverage, onToggle }) {
  return (
    <fieldset className="discover-fieldset">
      <legend>Primary clothing needs</legend>
      <div className="option-grid">
        {groups.map((g) => {
          const cov = coverage?.[g.id];
          const on = selectedIds.includes(g.id);
          const note = !cov ? 'Availability depends on the live catalog'
            : cov.total === 0 ? 'No sample garments yet'
            : cov.categories.length === 1 ? `${plural(cov.total, 'sample garment', 'sample garments')}, ${categoryLabel(cov.categories[0]).toLowerCase()} only`
            : `${plural(cov.total, 'sample garment', 'sample garments')} across ${cov.categories.length} categories`;
          return (
            <label className={`option-card ${on ? 'selected' : ''}`} key={g.id}>
              <input type="checkbox" checked={on} onChange={() => onToggle(g)} />
              <span className="choice-mark" aria-hidden="true"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 8.5l3 3 6-7" /></svg></span>
              <span className="option-body">
                <span className="option-title">{g.title}</span>
                <span className="option-blurb">{g.blurb}</span>
                <span className={`option-note ${cov && cov.total <= 1 ? 'is-limited' : ''}`}>{note}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

// Step 2: one category. Radio cards; categories with nothing compatible are disabled and say so.
export function CategoryCards({ categories, selected, counts, onSelect, showCounts }) {
  return (
    <fieldset className="discover-fieldset">
      <legend>Clothing category</legend>
      <div className="option-grid category-grid">
        {categories.map((c) => {
          const n = counts?.[c];
          const empty = showCounts && n === 0 && c !== selected;
          return (
            <label className={`option-card ${selected === c ? 'selected' : ''} ${empty ? 'is-disabled' : ''}`} key={c}>
              <input type="radio" name="category" value={c} checked={selected === c} disabled={empty} onChange={() => onSelect(c)} />
              <span className="option-body">
                <span className="option-title">{categoryLabel(c)}</span>
                {showCounts && <span className={`option-note ${n === 0 ? 'is-limited' : ''}`}>{n === 0 ? 'No compatible samples yet' : plural(n, 'compatible sample', 'compatible samples')}</span>}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
