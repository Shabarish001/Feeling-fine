'use client';
import {useState} from 'react';
import Link from 'next/link';
import {defaults,OPTIONS} from '@/lib/personal-shopping/schema.mjs';
import {explainEmpty} from '@/lib/personal-shopping/explain.mjs';
import {mergeConfirmedSuggestions} from '@/lib/personal-shopping/companion.mjs';
import Choices from './Choices';
import ProductCard from './ProductCard';

const union=(a=[],b=[])=>[...new Set([...a,...b])];
const label=s=>String(s).replaceAll('_',' ');
const arrays=['needs','required_features','avoid_materials','avoid_features','prefer_features','colors','style'];
function Selector({title,values,selected,onChange}){
  return <Choices title={title} values={values} selected={selected} onToggle={onChange}/>;
}

export default function FitCompanion({initial,account,onClose}) {
  const [prefs,setPrefs]=useState(()=>({...defaults,...initial,mode:'live'}));
  const [suggestions,setSuggestions]=useState(null);
  const [message,setMessage]=useState('');
  const [conversation,setConversation]=useState([]);
  const [result,setResult]=useState(null);
  const [dismissed,setDismissed]=useState([]);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');
  const [saved,setSaved]=useState(false);
  const set=(k,v)=>setPrefs(p=>({...p,[k]:v}));
  const toggle=(k,v)=>setPrefs(p=>({...p,[k]:p[k].includes(v)?p[k].filter(x=>x!==v):[...p[k],v]}));
  const toggleSuggestion=(k,v)=>setSuggestions(s=>({...s,[k]:s[k].includes(v)?s[k].filter(x=>x!==v):[...s[k],v]}));

  async function talk(event){
    event.preventDefault();const text=message.trim();if(!text||busy)return;
    setBusy(true);setNotice('');setConversation(c=>[...c,{role:'You',text}]);setMessage('');setSuggestions(null);
    try{
      const response=await fetch('/api/personal-shopping/companion',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text})});
      const data=await response.json();if(!response.ok)throw Error(data.error);
      setSuggestions(data.suggestions);
      setConversation(c=>[...c,{role:'Fit Companion',text:'I found these possible preferences. Please review and confirm or edit them.'}]);
    }catch(e){setNotice(e.message || 'Unable to interpret that message.');}
    finally{setBusy(false);}
  }
  async function recommend(next=prefs){
    setBusy(true);setNotice('');
    try{
      const response=await fetch('/api/personal-shopping/recommend',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(next)});
      const data=await response.json();if(!response.ok)throw Error(data.error);setResult(data);
    }catch(e){setNotice(e.message || 'Could not load recommendations.');}
    finally{setBusy(false);}
  }
  function confirmSuggestions(){const next=mergeConfirmedSuggestions(prefs,suggestions);setPrefs(next);setSuggestions(null);setSaved(false);recommend(next);}
  async function remember(){
    setBusy(true);setNotice('');
    try{
      const existingResponse=await fetch('/api/personal-shopping/preferences',{cache:'no-store'});
      if(!existingResponse.ok)throw Error(existingResponse.status===401?'Sign in to remember preferences.':'Could not load saved preferences.');
      const existing=(await existingResponse.json()).preferences;
      const next=existing?{...existing,...prefs,avoid_materials:union(existing.avoid_materials,prefs.avoid_materials),avoid_features:union(existing.avoid_features,prefs.avoid_features),required_features:union(existing.required_features,prefs.required_features),custom_restrictions:[...new Set([existing.custom_restrictions,prefs.custom_restrictions].flatMap(x=>String(x||'').split(';').map(s=>s.trim()).filter(Boolean)))].join('; ').slice(0,300)}:prefs;
      const response=await fetch('/api/personal-shopping/preferences',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({preferences:next,consent:true})});
      const data=await response.json();if(!response.ok)throw Error(data.error);setPrefs(next);setSaved(true);setNotice('Your confirmed preferences were saved. Conversation text was not saved.');
    }catch(e){setNotice(e.message || 'Could not save preferences.');}finally{setBusy(false);}
  }
  async function deleteSaved(){
    setBusy(true);setNotice('');try{const r=await fetch('/api/personal-shopping/preferences',{method:'DELETE'});if(!r.ok)throw Error('Could not delete saved preferences.');setSaved(false);setNotice('Saved shopping preferences deleted. Your current session choices remain until changed.');}catch(e){setNotice(e.message);}finally{setBusy(false);}
  }
  const visible=result?.results?.filter(p=>!dismissed.includes(p.id)) || [];
  return <div className="discover-shell companion-shell">
    <div className="result-heading"><div><p className="eyebrow">Your personal fashion companion</p><h1>Talk to my<br/><em>Fit Companion.</em></h1><p className="result-summary">Tell me what makes dressing easier. No diagnosis needed.</p></div><button type="button" className="discover-secondary" onClick={onClose}>Back to Discover</button></div>
    <div className="companion-layout">
      <section className="wizard-card companion-chat" aria-label="Fit Companion conversation">
        <h2>What would you like to find?</h2>
        <p className="hint">For example: “I use a wheelchair, prefer black casual trousers, and small buttons are difficult.”</p>
        <p className="hint">Your message is sent to the AI provider to suggest preferences. Conversation text stays in this page and is not saved to your profile.</p>
        <div className="companion-messages" aria-live="polite">{conversation.map((m,i)=><p key={i}><strong>{m.role}:</strong> {m.text}</p>)}</div>
        <form onSubmit={talk}><label className="discover-label">Your message<textarea value={message} onChange={e=>setMessage(e.target.value)} maxLength={2000} rows={3} placeholder="Tell me what you need in your clothing"/></label><button className="discover-button" disabled={busy||!message.trim()}>{busy?'Working…':'Ask Fit Companion'}</button></form>
        {notice && <p role="status" className="wizard-message">{notice}</p>}
        {suggestions && <section className="companion-review" aria-label="Review AI suggestions">
          <h3>AI suggestions — review before applying</h3><p className="hint">These are suggestions, not product facts. Remove any that do not reflect your needs.</p>
          {arrays.map(k=>suggestions[k].length>0 && <Selector key={k} title={{needs:'Clothing needs',required_features:'Required features',avoid_materials:'Materials to avoid',avoid_features:'Fastenings to avoid',prefer_features:'Preferred fastenings',colors:'Colors',style:'Style'}[k]} values={suggestions[k]} selected={suggestions[k]} onChange={v=>toggleSuggestion(k,v)}/>)}
          <label className="discover-label">Suggested category<select value={suggestions.category} onChange={e=>setSuggestions(s=>({...s,category:e.target.value}))}>{OPTIONS.categories.map(c=><option key={c} value={c}>{label(c)}</option>)}</select></label>
          <label className="discover-label">Dressing preference<select value={suggestions.dressing_mode} onChange={e=>setSuggestions(s=>({...s,dressing_mode:e.target.value}))}><option value="unspecified">Not specified</option><option value="independent">Independent</option><option value="assisted">Assisted</option></select></label>
          {suggestions.requires_manual_review && <label className="save-choice"><input type="checkbox" checked={suggestions.requires_manual_review} onChange={e=>setSuggestions(s=>({...s,requires_manual_review:e.target.checked}))}/> An additional constraint needs manual review; confirmed matches will be hidden until it can be checked.</label>}
          <button type="button" className="discover-button" disabled={busy} onClick={confirmSuggestions}>Confirm and find clothing</button>
        </section>}
      </section>
      <section className="wizard-card companion-preferences" aria-label="Your confirmed preferences">
        <h2>Your preferences</h2><p className="hint">Edit these anytime. Needs help rank and filter; required features and exclusions are strict. Unknown exclusions are not assumed safe.</p>
        <label className="discover-label">Garment category<select value={prefs.category} onChange={e=>set('category',e.target.value)}>{OPTIONS.categories.map(c=><option key={c} value={c}>{label(c)}</option>)}</select></label>
        <label className="discover-label">Dressing preference<select value={prefs.dressing_mode} onChange={e=>set('dressing_mode',e.target.value)}><option value="unspecified">Not specified</option><option value="independent">Independent</option><option value="assisted">Assisted</option></select></label>
        <label className="discover-label">Other constraint <span>Optional; cannot be checked automatically</span><input value={prefs.custom_restrictions} maxLength={300} onChange={e=>set('custom_restrictions',e.target.value)}/></label>
        <details open><summary>Needs and requirements</summary><Selector title="Clothing needs" values={OPTIONS.needs} selected={prefs.needs} onChange={v=>toggle('needs',v)}/><Selector title="Required features" values={OPTIONS.needs} selected={prefs.required_features} onChange={v=>toggle('required_features',v)}/></details>
        <details><summary>Fastenings and materials</summary><Selector title="Fastenings to avoid" values={OPTIONS.avoidFeatures} selected={prefs.avoid_features} onChange={v=>toggle('avoid_features',v)}/><Selector title="Preferred fastenings" values={OPTIONS.avoidFeatures} selected={prefs.prefer_features} onChange={v=>toggle('prefer_features',v)}/><Selector title="Materials to avoid" values={OPTIONS.materials} selected={prefs.avoid_materials} onChange={v=>toggle('avoid_materials',v)}/></details>
        <details><summary>Style and color</summary><Selector title="Colors" values={OPTIONS.colors} selected={prefs.colors} onChange={v=>toggle('colors',v)}/><Selector title="Style" values={OPTIONS.styles} selected={prefs.style} onChange={v=>toggle('style',v)}/><p className="hint">These can affect ranking only where catalog details are documented.</p></details>
        <div className="wizard-actions"><button type="button" className="discover-button" disabled={busy} onClick={()=>recommend()}>Find my matches</button>{account ? <button type="button" className="discover-secondary" disabled={busy} onClick={remember}>Remember these preferences</button> : <Link href="/login?next=/discover">Sign in to remember preferences</Link>}</div>
        {account && <button type="button" className="text-button" disabled={busy} onClick={deleteSaved}>Delete saved shopping preferences</button>}
        {account && <p className="hint">Saved exclusions and required features stay active until you delete saved preferences.</p>}
        {saved && <p className="hint">Saved with your consent. Saved restrictions remain active until deleted.</p>}
      </section>
    </div>
    {result && <section className="companion-results" aria-label="Fit Companion recommendations"><h2>Your clothing matches</h2><p className="hint">Documented product features and retailer links come from the catalog. Style, color, materials, price and stock may be unknown.</p>
      {visible.length ? <div className="product-grid">{visible.map(p=><ProductCard key={p.id} product={p} demo={false} account={account} avoided={prefs.avoid_materials} onSessionDismiss={id=>setDismissed(x=>union(x,[id]))}/>)}</div> : <div className="empty-state"><h3>No confirmed matches</h3><p>{dismissed.length && result.results.length ? 'You marked these results as not suitable for this session.' : 'No catalog products can be confirmed against all your current requirements. Unknown materials and excluded fastenings are never assumed safe.'}</p>{!result.results.length && <ul>{explainEmpty(result.diagnostics,prefs).reasons.map(r=><li key={r}>{r}</li>)}</ul>}<p>Review optional category, style or color preferences, or keep your requirements and check again when more product evidence is available.</p></div>}
    </section>}
  </div>;
}
