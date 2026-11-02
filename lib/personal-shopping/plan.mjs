const translations = {
  easy_fastening:['easy fastening','magnetic closure'], limited_dexterity:['easy fastening','large zipper pull','pull-on'], seated_fit:['seated fit','higher back rise'], sensory_softness:['soft fabric','low-irritation seams'], flat_seams:['flat seams'], tag_free:['tag free'], adjustable_openings:['adjustable openings'], easy_dressing:['easy dressing','front opening'], temperature_comfort:['breathable fabric']
};
export function planProductSearch(p) {
  const mapped_features = [...new Set([...p.needs,...p.required_features].flatMap(n => translations[n] || []))];
  return {category:p.category, country:p.country, queries:[`${p.category} ${mapped_features.slice(0,3).join(' ')}`.trim()], mapped_features, hard_constraints:p.avoid_materials, soft_preferences:[...p.needs,...p.required_features,...p.prefer_materials]};
}
