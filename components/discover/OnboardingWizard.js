'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { defaults, OPTIONS } from '@/lib/personal-shopping/schema.mjs';
import { demoCatalog } from '@/lib/personal-shopping/demo-catalog.mjs';
import { NEED_GROUPS, groupSelected, toggleGroup, groupCoverage, categoryCounts, previewCount } from '@/lib/personal-shopping/needs.mjs';
import { savedRefinements, optionalDefaults } from '@/lib/personal-shopping/explain.mjs';
import Choices from './Choices';
import { NeedCards, CategoryCards } from './OptionCards';
import ResultsView from './ResultsView';
import { LoadingEdit, SkeletonGrid } from './LoadingEdit';
import FabricSculpture from '@/components/ui/FabricSculpture';
import FitCompanion from './FitCompanion';

const STEPS = ['Needs', 'Category', 'Restrictions'];
const CATEGORIES = ['all', ...OPTIONS.categories.filter((c) => c !== 'all')];
const joinText = (...parts) => [...new Set(parts.flatMap((x) => String(x || '').split(';').map((t) => t.trim()).filter(Boolean)))].join('; ').slice(0, 300);

export default function OnboardingWizard() {
  const [p, setP] = useState({ ...defaults });
  const [step, setStep] = useState(0);
  const [companion, setCompanion] = useState(false);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [messageKind, setMessageKind] = useState('info');
  const [account, setAccount] = useState(false);
  const [saved, setSaved] = useState(false);
  const [consent, setConsent] = useState(false);
  // Hard restrictions saved earlier. They stay on (the server also keeps them) until saved preferences are deleted.
  const [savedHard, setSavedHard] = useState({ avoid: [], avoidFeatures: [], required: [], custom: '' });
  const [extraRestriction, setExtraRestriction] = useState('');
  const [liveCount, setLiveCount] = useState(null); // products in the live catalog; null until known
  const [livePreview, setLivePreview] = useState({ status: 'idle', count: null });
  const hasSaved = useRef(false);
  const previewControl = useRef(null);

  const say = (text, kind = 'info') => { setMessage(text); setMessageKind(kind); };
  const demo = p.mode === 'demo';

  useEffect(() => {
    let active = true;
    fetch('/api/personal-shopping/preferences', { cache: 'no-store' }).then(async (r) => {
      if (r.status === 401) return;
      const d = await r.json();
      if (!active) return;
      setAccount(true);
      if (!r.ok) { say(d.error, 'error'); return; }
      if (d.preferences) {
        setP({ ...defaults, ...d.preferences });
        setSavedHard({ avoid: d.preferences.avoid_materials || [], avoidFeatures: d.preferences.avoid_features || [], required: d.preferences.required_features || [], custom: d.preferences.custom_restrictions || '' });
        setSaved(true);
        hasSaved.current = true;
        say('Your saved shopping preferences are loaded.');
      }
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  // Preview through the same server graph as the final search. Abort stale requests so old counts
  // never appear after a user changes a restriction. This never changes or saves their choices.
  useEffect(() => {
    if (step !== 2 || p.mode !== 'live' || result) return;
    const controller = new AbortController();
    setLivePreview({ status: 'checking', count: null });
    const timer = setTimeout(async () => {
      try {
        const response = await fetch('/api/personal-shopping/recommend', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(p), signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok || !Number.isInteger(data.diagnostics?.eligible)) throw new Error('Preview unavailable');
        if (!controller.signal.aborted) setLivePreview({ status: 'ready', count: data.diagnostics.eligible });
      } catch (error) {
        if (!controller.signal.aborted) setLivePreview({ status: 'error', count: null });
      }
    }, 400);
    previewControl.current = { controller, timer };
    return () => { clearTimeout(timer); controller.abort(); if (previewControl.current?.controller === controller) previewControl.current = null; };
  }, [step, p, result]);

  // Real listings are used by default only when the live catalog actually has products. Otherwise: labelled samples.
  useEffect(() => {
    let active = true;
    fetch('/api/personal-shopping/catalog-status', { cache: 'no-store' }).then((r) => r.json()).then((d) => {
      if (!active) return;
      setLiveCount(d.live_products || 0);
      if (d.live_products > 0 && !hasSaved.current) setP((old) => ({ ...old, mode: 'live' }));
    }).catch(() => { if (active) setLiveCount(0); });
    return () => { active = false; };
  }, []);

  const set = (k, v) => setP((old) => ({ ...old, [k]: v }));
  const toggle = (k, v) => setP((old) => ({ ...old, [k]: old[k].includes(v) ? old[k].filter((x) => x !== v) : [...old[k], v] }));

  // Step 1: choosing needs may make the chosen category empty; fall back to "all" rather than hide the problem.
  function toggleNeed(group) {
    setP((old) => {
      const needs = toggleGroup(old.needs, group);
      let category = old.category;
      if (old.mode === 'demo' && category !== 'all' && categoryCounts(demoCatalog, { ...old, needs }, [category])[category] === 0) category = 'all';
      return { ...old, needs, category };
    });
  }
  function setExtra(text) {
    setExtraRestriction(text);
    set('custom_restrictions', joinText(savedHard.custom, text));
  }
  function clearRefinements() { setP((old) => ({ ...old, ...optionalDefaults })); }

  async function save(prefs) {
    if (!consent) { say('Select the consent checkbox before saving.', 'error'); return false; }
    const r = await fetch('/api/personal-shopping/preferences', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ preferences: prefs, consent: true }) });
    const d = await r.json();
    say(r.ok ? 'Shopping preferences saved.' : d.error, r.ok ? 'info' : 'error');
    if (r.ok) setSaved(true);
    return r.ok;
  }
  async function remove() {
    const r = await fetch('/api/personal-shopping/preferences', { method: 'DELETE' });
    const d = await r.json();
    say(r.ok ? 'Saved shopping preferences deleted.' : d.error, r.ok ? 'info' : 'error');
    if (r.ok) {
      setSaved(false); setConsent(false);
      setSavedHard({ avoid: [], avoidFeatures: [], required: [], custom: '' });
    }
  }
  async function run(prefs) {
    if (previewControl.current) { clearTimeout(previewControl.current.timer); previewControl.current.controller.abort(); }
    setBusy(true); say('');
    try {
      if (consent && account && !(await save(prefs))) return;
      const r = await fetch('/api/personal-shopping/recommend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(prefs) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setResult({ ...d, _prefs: prefs });
      window.scrollTo({ top: 0, behavior: 'auto' });
    } catch (e) {
      say(e.message || 'Could not load recommendations.', 'error');
    } finally { setBusy(false); }
  }
  // Re-run from the results page with changed optional preferences (never touches saved hard restrictions).
  function rerun(patch = {}) {
    const next = { ...p, ...patch };
    setP(next);
    return run(next);
  }

  const needCoverage = useMemo(() => Object.fromEntries(NEED_GROUPS.map((g) => [g.id, groupCoverage(demoCatalog, g)])), []);
  const counts = useMemo(() => categoryCounts(demoCatalog, p, CATEGORIES), [p]);
  const selectedIds = NEED_GROUPS.filter((g) => groupSelected(p.needs, g)).map((g) => g.id);
  const preview = demo ? previewCount(demoCatalog, p) : null;
  const refinements = savedRefinements(p);

  if (companion) return <FitCompanion initial={p} account={account} onClose={() => setCompanion(false)} />;

  if (result) {
    return (
      <ResultsView
        result={result} account={account} prefs={p} set={set} toggle={toggle} busy={busy}
        message={message} messageKind={messageKind} liveCount={liveCount}
        onRerun={rerun} onEdit={(nextStep = 0) => { setResult(null); setStep(nextStep); say(''); }}
      />
    );
  }

  return (
    <div className="discover-shell">
      <div className="discover-layout">
        <aside className="discover-intro">
          <p className="eyebrow">Feeling Fine · Personal edit</p>
          <h1>Wear what<br /><em>makes you feel fine.</em></h1>
          <p className="intro-lede">Just three quick questions before you find your style!</p>
          <button type="button" className="discover-button" onClick={() => setCompanion(true)}>Talk to my Fit Companion</button>
          <div className="editorial-art" aria-hidden="true"><FabricSculpture /></div>
          <p className="intro-small">No diagnosis needed. Explore as a guest, or save your choices to your account.</p>
        </aside>

        <section className="wizard-card" aria-labelledby="wizard-title">
          <div className="wizard-top">
            <span>Your preferences</span>
            <span aria-label={`Step ${step + 1} of ${STEPS.length}`}>{String(step + 1).padStart(2, '0')} / {String(STEPS.length).padStart(2, '0')}</span>
          </div>
          <ol className="stepper steps-3" aria-label="Progress">
            {STEPS.map((s, i) => (
              <li key={s} className={i === step ? 'is-current' : i < step ? 'is-done' : ''} aria-current={i === step ? 'step' : undefined}>
                <span className="stepper-dot" aria-hidden="true">{i < step ? '✓' : i + 1}</span>
                <span className="stepper-label">{s}</span>
              </li>
            ))}
          </ol>
          <div className="progress-track" aria-hidden="true"><div style={{ width: `${((step + 1) * 100) / STEPS.length}%` }} /></div>

          {message && <div className={`wizard-message ${messageKind === 'error' ? 'is-error' : ''}`} role={messageKind === 'error' ? 'alert' : 'status'}>{message}</div>}
          {refinements.length > 0 && step === 0 && !busy && (
            <div className="wizard-message refinement-note">
              <span>Saved refinements will also apply: {refinements.map((r) => r.text).join(' · ')}.</span>
              <button type="button" className="text-button" onClick={clearRefinements}>Clear them</button>
            </div>
          )}

          {busy ? <LoadingEdit /> : (
            <div className="wizard-step" key={step}>
              {step === 0 && (<>
                <h2 id="wizard-title">What matters most in your clothes?</h2>
                <p className="step-lede">Choose any that apply, or none to see everything. You never need to share a diagnosis.</p>
                <p className="hint">Results can match any of your selected needs. You can mark essential features as required in the last step.</p>
                <NeedCards groups={NEED_GROUPS} needs={p.needs} selectedIds={selectedIds} coverage={demo ? needCoverage : null} onToggle={toggleNeed} />
                {demo && <p className="hint coverage-hint">{liveCount === 0 ? 'The live catalog has no products yet, so you will see clearly labelled illustrative samples.' : 'Showing availability in the demo catalog of illustrative samples.'}</p>}
                {!demo && <p className="hint coverage-hint">Searching the live catalog{liveCount ? ` (${liveCount} product${liveCount === 1 ? '' : 's'})` : ''}. Sample garments are never mixed in.</p>}
              </>)}

              {step === 1 && (<>
                <h2 id="wizard-title">What are you looking for?</h2>
                <p className="step-lede">{demo ? 'Only categories with compatible sample garments can be chosen.' : 'Choose a category, or explore everything.'}</p>
                <CategoryCards categories={CATEGORIES} selected={p.category} counts={counts} showCounts={demo} onSelect={(c) => set('category', c)} />
              </>)}

              {step === 2 && (<>
                <h2 id="wizard-title">Anything we must avoid or always include?</h2>
                <p className="step-lede">These are hard rules. We never relax them, and anything not documented counts as unknown, not safe.</p>
                {p.avoid_materials.length > 0 && <p className="hint">Your material restrictions remain active: {p.avoid_materials.map(m => m.replaceAll('_', ' ')).join(', ')}. You can delete saved shopping preferences below; this session keeps its current choices until you start a new one.</p>}
                <Choices title="Fastenings to avoid" hint="A garment must explicitly document that the fastening is absent." values={OPTIONS.avoidFeatures} selected={p.avoid_features} locked={savedHard.avoidFeatures} onToggle={(v) => toggle('avoid_features', v)} />
                <details className="refine-inline" open={p.required_features.length > 0 || savedHard.required.length > 0}>
                  <summary>Non-negotiable accessibility requirements</summary>
                  <Choices title="Required accessibility features" hint="Every selected feature must be documented for the same garment; other garments will not be shown." values={OPTIONS.needs} selected={p.required_features} locked={savedHard.required} onToggle={(v) => toggle('required_features', v)} />
                </details>
                <label className="discover-label">Another material or restriction <span>Optional</span>
                  <input maxLength={300} value={extraRestriction} onChange={(e) => setExtra(e.target.value)} placeholder="e.g. a fabric that irritates your skin" />
                </label>
                {(extraRestriction.trim() || savedHard.custom) && (
                  <p className="hint">Restrictions in your own words cannot be verified automatically, so garments are only shown if they can be confirmed to meet them. That usually means no matches.{savedHard.custom && ' Your saved restriction is kept until you delete saved preferences.'}</p>
                )}
                {preview !== null && (
                  <p className={`preview-line ${preview === 0 ? 'is-empty' : ''}`} role="status">
                    {preview === 0
                      ? 'Nothing in the sample catalog fits this combination yet. You can still continue, and we will explain why.'
                      : `About ${preview} sample garment${preview === 1 ? '' : 's'} fit what you have chosen.`}
                  </p>
                )}
                {!demo && livePreview.status !== 'idle' && (
                  <p className={`preview-line ${livePreview.status === 'ready' && livePreview.count === 0 ? 'is-empty' : ''}`} role="status" aria-live="polite">
                    {livePreview.status === 'checking' ? 'Checking the catalog for your choices…'
                      : livePreview.status === 'error' ? 'Could not check the catalog yet. You can still search.'
                      : livePreview.count === 0 ? 'No catalog products currently match all your required choices. Review them if you wish; nothing will be changed automatically.'
                      : `${livePreview.count} catalog product${livePreview.count === 1 ? '' : 's'} match your current choices.`}
                  </p>
                )}
                {account ? (<>
                  <label className="save-choice"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> I consent to saving these shopping preferences to my account for recommendations.</label>
                  <p className="step-lede">Saving is separate from chat personalization. Leave unchecked for a one-time search.</p>
                  {saved && <button className="text-button" type="button" onClick={remove}>Delete saved shopping preferences</button>}
                </>) : (
                  <p className="step-lede">Guest choices stay in this page only. <Link href="/login?next=/discover">Sign in</Link> to save them to your account.</p>
                )}
              </>)}
            </div>
          )}

          {!busy && (
            <div className="wizard-actions wizard-nav">
              {step > 0 ? <button type="button" className="discover-secondary" onClick={() => setStep(step - 1)}>← Back</button> : <Link className="discover-secondary" href="/">← Home</Link>}
              {step < STEPS.length - 1
                ? <button type="button" className="discover-button" onClick={() => setStep(step + 1)}>Continue →</button>
                : <button type="button" className="discover-button" onClick={() => run(p)}>Show my matches →</button>}
            </div>
          )}
        </section>
      </div>
      {busy && <SkeletonGrid />}
    </div>
  );
}
