import { OPTIONS, defaults, validatePreferences } from './schema.mjs';

// AI output is untrusted: reject unknown fields and values before showing suggestions.
export function validateCompanionSuggestion(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Invalid suggestions');
  const keys=['needs','required_features','avoid_materials','avoid_features','prefer_features','category','colors','style','dressing_mode','requires_manual_review'];
  if(Object.keys(input).some(k=>!keys.includes(k)))throw Error('Unexpected suggestion field');
  const dressing=input.dressing_mode ?? 'unspecified';
  if(!['unspecified','independent','assisted'].includes(dressing))throw Error('Invalid dressing preference');
  const requiresManual=input.requires_manual_review ?? false;if(typeof requiresManual!=='boolean')throw Error('Invalid manual review flag');
  const prefs=validatePreferences({...defaults,...Object.fromEntries(Object.entries(input).filter(([k])=>k!=='dressing_mode'&&k!=='requires_manual_review'))});
  return {needs:prefs.needs,required_features:prefs.required_features,avoid_materials:prefs.avoid_materials,avoid_features:prefs.avoid_features,prefer_features:prefs.prefer_features,category:prefs.category,colors:prefs.colors,style:prefs.style,dressing_mode:dressing,requires_manual_review:requiresManual};
}

export function mergeConfirmedSuggestions(current, input) {
  const p=validatePreferences(current), s=validateCompanionSuggestion(input), next={...p};
  for(const k of ['needs','required_features','avoid_materials','avoid_features','prefer_features','colors','style']) next[k]=[...new Set([...p[k],...s[k]])];
  if(s.category!=='all')next.category=s.category;
  if(s.dressing_mode!=='unspecified')next.dressing_mode=s.dressing_mode;
  if(s.requires_manual_review)next.custom_restrictions=[...new Set([p.custom_restrictions,'Additional constraint requires manual review'].filter(Boolean))].join('; ').slice(0,300);
  return validatePreferences(next);
}

export const companionTool = {
  name:'suggest_preferences', description:'Offer tentative clothing preferences for the user to review; never infer diagnoses.',
  input_schema:{type:'object',additionalProperties:false,properties:{
    needs:{type:'array',items:{type:'string',enum:OPTIONS.needs}},
    required_features:{type:'array',items:{type:'string',enum:OPTIONS.needs}},
    avoid_materials:{type:'array',items:{type:'string',enum:OPTIONS.materials}},
    avoid_features:{type:'array',items:{type:'string',enum:OPTIONS.avoidFeatures}},
    prefer_features:{type:'array',items:{type:'string',enum:OPTIONS.avoidFeatures}},
    category:{type:'string',enum:OPTIONS.categories},
    colors:{type:'array',items:{type:'string',enum:OPTIONS.colors}},
    style:{type:'array',items:{type:'string',enum:OPTIONS.styles}},
    dressing_mode:{type:'string',enum:['unspecified','independent','assisted']},
    requires_manual_review:{type:'boolean',description:'True if the user stated a constraint that cannot be represented by these fields. Do not include the constraint text.'},
  }},
};
