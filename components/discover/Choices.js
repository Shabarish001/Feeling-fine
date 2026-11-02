'use client';

export const label = (s) => s.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// A group of selectable cards (checkboxes underneath, so keyboard + screen readers behave natively).
// `locked` values are saved hard restrictions: shown checked and not removable here (the server keeps them too).
// `hints` adds a short line under a value, e.g. how many sample products can verify it.
export default function Choices({ title, hint, values, selected, onToggle, locked = [], hints = {} }) {
  return (
    <fieldset className="discover-fieldset">
      <legend>{title}</legend>
      {hint && <p className="hint fieldset-hint">{hint}</p>}
      <div className="choice-grid">
        {values.map((v) => {
          const isLocked = locked.includes(v);
          const on = selected.includes(v) || isLocked;
          return (
            <label className={`choice ${on ? 'selected' : ''} ${isLocked ? 'is-locked' : ''}`} key={v}>
              <input type="checkbox" checked={on} disabled={isLocked} onChange={() => onToggle(v)} />
              <span className="choice-mark" aria-hidden="true">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 8.5l3 3 6-7" /></svg>
              </span>
              <span className="choice-text">
                {label(v)}
                {isLocked && <small className="choice-hint">Saved restriction</small>}
                {!isLocked && hints[v] && <small className="choice-hint">{hints[v]}</small>}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
