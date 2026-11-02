/** Shared names for the proposed normalized catalog schema. The live adapter is
 * not connected yet; demo records continue to use their separate shape. */
export const CATALOG_TABLES = Object.freeze({
  products: 'products', variants: 'product_variants', retailers: 'retailers', offers: 'product_offers', offerPrices: 'product_offer_prices',
  images: 'product_images', materials: 'product_materials', attributes: 'product_attributes',
  evidence: 'product_evidence', preferences: 'shopping_preferences', feedback: 'product_feedback',
});

/** Check whether an explicit absence claim has documented, applicable evidence.
 * A true result is evidence for a filter, not an assurance of medical safety.
 * Callers must still check conflicts, provenance, freshness, and coverage. */
export function isDocumentedAbsence(evidence, {productId, variantId = null, offerId = null, attribute} = {}) {
  if (!evidence || !productId || !attribute || evidence.product_id !== productId ||
      evidence.attribute !== attribute || evidence.value !== 'absent' ||
      !['retailer_spec', 'manufacturer_spec'].includes(evidence.evidence_type) ||
      typeof evidence.evidence_text_or_source !== 'string' || !evidence.evidence_text_or_source.trim() ||
      typeof evidence.checked_at !== 'string' || !Number.isFinite(Date.parse(evidence.checked_at))) return false;
  // A product-wide assertion can apply to a variant; a variant-specific one
  // cannot establish an absence for a different or unspecified variant.
  if (evidence.variant_id && evidence.variant_id !== variantId) return false;
  if (evidence.offer_id && evidence.offer_id !== offerId) return false;
  try {
    const url = new URL(evidence.source_url);
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password;
  } catch { return false; }
}
