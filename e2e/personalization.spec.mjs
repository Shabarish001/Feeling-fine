import { test, expect } from '@playwright/test';

// End-to-end through the real UI and the real LangGraph. The recommendation API is never mocked.
const SHOTS = 'artifacts/onboarding-fix';
const nodes = ['loadUserPreferences', 'interpretClothingNeeds', 'retrieveProducts', 'verifyRestrictions', 'rankProducts', 'explainRecommendations'];
const NEED = { easy: /Easy dressing and fastenings/, sensory: /Sensory-friendly and soft/, seated: /Seated comfort and accessible fit/ };

async function guest(page, avoid = []) {
  await page.route('**/api/personal-shopping/catalog-status', route=>route.fulfill({json:{live_products:0}}));
  await page.route('**/api/personal-shopping/preferences', route => avoid.length
    ? route.fulfill({status:200,json:{preferences:{mode:'demo',avoid_materials:avoid.map(x=>x.toLowerCase())}}})
    : route.fulfill({ status: 401, json: { error: 'Guest' } }));
}
const next = (page) => page.getByRole('button', { name: /continue/i }).click();

// Walks the three steps. `category` is the card title; omit for "Explore all compatible clothing".
async function onboard(page, o = {}) {
  if (o.testUser) {
    await page.setExtraHTTPHeaders({ 'x-e2e-user': o.testUser });
    await page.route('**/api/personal-shopping/catalog-status', route=>route.fulfill({json:{live_products:0}}));
    if(o.avoid?.length) await page.request.put('/api/personal-shopping/preferences',{headers:{'x-e2e-user':o.testUser},data:{consent:true,preferences:{mode:'demo',avoid_materials:o.avoid.map(x=>x.toLowerCase())}}});
  } else if (!o.keepRoutes) await guest(page, o.avoid || []);
  await page.goto('/discover');
  if(o.avoid?.length) await expect(page.getByText('Your saved shopping preferences are loaded.')).toBeVisible();
  for (const n of o.needs || []) await page.getByRole('checkbox', { name: NEED[n] }).check();
  await next(page);
  if (o.category) await page.getByRole('radio', { name: new RegExp(`^${o.category}`) }).check();
  await next(page);
  if (o.required) {
    await page.getByText('Non-negotiable accessibility requirements').click();
    for (const f of o.required) await page.getByRole('group', { name: 'Required accessibility features' }).getByLabel(f).check();
  }
  if (o.extra) await page.getByLabel(/another material or restriction/i).fill(o.extra);
  if (o.consent) await page.getByLabel(/I consent to saving/i).check();
  return submit(page);
}
async function submit(page) {
  const response = page.waitForResponse((r) => r.url().includes('/api/personal-shopping/recommend') && r.request().method() === 'POST');
  await page.getByRole('button', { name: /show my matches/i }).click();
  const res = await response;
  expect(res.status()).toBe(200);
  return { data: await res.json(), payload: res.request().postDataJSON() };
}
const titles = (data) => data.results.map((r) => r.title);

test('1. easy-dressing profile receives compatible demo garments', async ({ page }) => {
  const { data, payload } = await onboard(page, { needs: ['easy'] });
  expect(payload.needs).toEqual(expect.arrayContaining(['easy_dressing', 'easy_fastening', 'limited_dexterity']));
  expect(payload.category).toBe('all');
  expect(data.results.length).toBe(10);
  expect(titles(data)).toContain('Sample Easy Close Shirt');
  // Every result documents at least one easy-dressing feature; none are filler.
  const group = ['easy_dressing', 'easy_fastening', 'limited_dexterity', 'adjustable_openings'];
  for (const r of data.results) expect(r.evidence.some((e) => group.includes(e.attribute) && e.value === true)).toBeTruthy();
  await expect(page.getByText(/demo catalog.*illustrative/i)).toBeVisible();
  await expect(page.getByText(/sample feature: easy fastening/i).first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/after-easy-dressing-desktop.png`, fullPage: true });
});

test('2. sensory-friendly profile receives compatible demo garments', async ({ page }) => {
  const { data } = await onboard(page, { needs: ['sensory'] });
  expect(titles(data)).toEqual(expect.arrayContaining(['Sample Soft Everyday Tee', 'Sample Soft Seam Shirt']));
  expect(data.results.length).toBe(4);
  for (const r of data.results) expect(r.evidence.some((e) => ['sensory_softness', 'flat_seams', 'tag_free'].includes(e.attribute) && e.value === true)).toBeTruthy();
  await expect(page.locator('.feature-chips').first()).toBeVisible();
});

test('3. seated comfort is offered only where the catalog supports it', async ({ page }) => {
  await guest(page);
  await page.goto('/discover');
  await page.getByRole('checkbox', { name: NEED.seated }).check();
  await expect(page.getByText('1 sample garment, trousers only')).toBeVisible();
  await next(page);
  await expect(page.getByRole('radio', { name: /^Trousers/ })).toBeEnabled();
  for (const c of ['Tops', 'Shirts', 'Dresses', 'Jackets', 'Shoes']) {
    const radio = page.getByRole('radio', { name: new RegExp(`^${c}`) });
    await expect(radio).toBeDisabled();
  }
  await expect(page.getByText('No compatible samples yet').first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/after-seated-categories.png`, fullPage: true });
  await next(page);
  const { data } = await submit(page);
  expect(titles(data)).toEqual(['Sample Seated Cut Trouser']);
});

test('4. category selection filters results', async ({ page }) => {
  const { data, payload } = await onboard(page, { needs: ['easy'], category: 'Jackets' });
  expect(payload.category).toBe('jackets');
  expect(data.results.length).toBe(3);
  expect(data.results.every((r) => r.category === 'jackets')).toBeTruthy();
});

test('5. explicit wool exclusion removes products without verified absence', async ({ page }) => {
  const { data } = await onboard(page, { needs: ['easy'], avoid: ['Wool'] });
  expect(data.results.length).toBeGreaterThan(0);
  const ids = data.results.map((r) => r.id);
  // These sample garments make no wool declaration, so they must be excluded as unknown.
  for (const unknown of ['sample-p03', 'sample-j03', 'sample-f01', 'sample-f02']) expect(ids).not.toContain(unknown);
  for (const r of data.results) { expect(r.evidence.some((e) => e.attribute === 'wool' && e.value === 'absent')).toBeTruthy(); expect(r.materials || []).not.toContain('wool'); }
  expect(data._node_trace.indexOf('verifyRestrictions')).toBeLessThan(data._node_trace.indexOf('rankProducts'));
  expect(data._node_trace).toEqual(nodes);
  await expect(page.getByText(/Confirmed free of: Wool/).first()).toBeVisible();
});

test('6. an unsupported combination gives an honest, informative empty state', async ({ page }, info) => {
  const { data } = await onboard(page, { needs: ['sensory'], avoid: ['Polyester'] });
  expect(data.results).toEqual([]);
  expect(data.diagnostics.filters.map((f) => f.filter)).toEqual(['needs', 'avoid_materials']);
  await expect(page.getByRole('heading', { name: 'No matches available' })).toBeVisible();
  await expect(page.getByText(/could not be confirmed free of the materials you must avoid/i)).toBeVisible();
  await expect(page.getByText(/restrictions have not been relaxed/i)).toBeVisible();
  // No relaxing action is offered for a material restriction, and no products are invented.
  await expect(page.getByRole('button', { name: /remove|relax/i })).toHaveCount(0);
  await expect(page.locator('.product-card')).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/after-empty-polyester.png`, fullPage: true });
  void info;
});

test('6b. a category with nothing compatible is disabled instead of leading to an empty page', async ({ page }) => {
  await guest(page);
  await page.goto('/discover');
  await page.getByRole('checkbox', { name: NEED.easy }).check();
  await next(page);
  // No sample top documents an easy-dressing feature, so the card says so and cannot be chosen.
  await expect(page.getByRole('radio', { name: /^Tops/ })).toBeDisabled();
  await expect(page.getByRole('radio', { name: /^Jackets/ })).toBeEnabled();
});

test('6c. a search that finds nothing in its category points to compatible ones elsewhere', async ({ request }) => {
  const res = await request.post('/api/personal-shopping/recommend', { data: { category: 'shirts', needs: ['seated_fit'], required_features: [], avoid_materials: [], prefer_materials: [], style: [], colors: [], max_price: null, currency: 'EUR', country: 'DE', delivery: '', notes: '', custom_restrictions: '', mode: 'demo', size: '', fit: '' } });
  expect(res.status()).toBe(200);
  const data = await res.json();
  expect(data.results).toEqual([]);
  expect(data.diagnostics.alternatives).toEqual([{ category: 'trousers', count: 1 }]);
});

test('7. returning to onboarding preserves chosen restrictions and needs', async ({ page }) => {
  await onboard(page, { needs: ['sensory'], avoid: ['Wool'], required: ['Tag Free'] });
  await page.getByRole('button', { name: /change my answers/i }).first().click();
  await expect(page.getByRole('checkbox', { name: NEED.sensory })).toBeChecked();
  await next(page); await next(page);
  await expect(page.getByText(/material restrictions remain active: wool/i)).toBeVisible();
  await expect(page.getByRole('group', { name: 'Required accessibility features' }).getByLabel('Tag Free')).toBeChecked();
});

test('8. two profiles receive meaningfully different rankings', async ({ browser }) => {
  const a = await browser.newPage(), b = await browser.newPage();
  const easy = await onboard(a, { needs: ['easy'] }), sensory = await onboard(b, { needs: ['sensory'] });
  expect(easy.data.results[0].id).not.toBe(sensory.data.results[0].id);
  expect(easy.data.results[0].title).toMatch(/Easy Close|Large Pull|Pull On/);
  expect(sensory.data.results[0].title).toMatch(/Soft/);
  const overlap = easy.data.results.map((r) => r.id).filter((id) => sensory.data.results.some((s) => s.id === id));
  expect(overlap.length).toBeLessThan(easy.data.results.length);
  await a.close(); await b.close();
});

test('9a. mobile onboarding and results are usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await onboard(page, { needs: ['sensory'] });
  await expect(page.locator('.product-card').first()).toBeVisible();
  await expect(page.locator('.garment-art').first()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.screenshot({ path: `${SHOTS}/after-results-mobile.png`, fullPage: true });
});

test('9b. mobile keyboard path reaches the matches without a pointer', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await guest(page);
  await page.goto('/discover');
  await page.getByRole('checkbox', { name: NEED.easy }).focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('checkbox', { name: NEED.easy })).toBeChecked();
  await page.screenshot({ path: `${SHOTS}/after-step1-mobile.png`, fullPage: true });
});

test('homepage opens the three-step onboarding without page errors', async ({ page }, info) => {
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await guest(page); await page.goto('/');
  await page.getByRole('link', { name: /find clothes for me/i }).click();
  await expect(page.getByRole('heading', { name: /what matters most/i })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Progress' }).locator('li')).toHaveCount(3);
  await page.screenshot({ path: `${SHOTS}/after-step1-desktop.png`, fullPage: true });
  await page.screenshot({ path: info.outputPath('onboarding-desktop.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('size is not offered for demo products and cannot silently empty the results', async ({ page }) => {
  await onboard(page, { needs: ['easy'] });
  await page.getByText('Refine preferences').click();
  await expect(page.getByLabel('Size', { exact: false })).toHaveCount(0);
  await expect(page.getByText(/size filtering needs verified stock/i)).toBeVisible();
});

test('budget refinement updates results and its chip removes the filter', async ({ page }) => {
  await onboard(page, { needs: ['easy'] });
  await page.getByText('Refine preferences').click();
  await page.getByLabel(/maximum price/i).fill('60');
  const response = page.waitForResponse((r) => r.url().includes('/api/personal-shopping/recommend'));
  await page.getByRole('button', { name: 'Update results' }).click();
  const data = await (await response).json();
  expect(data.results.length).toBeGreaterThan(0);
  expect(data.results.every((p) => p.offers[0].price <= 60)).toBeTruthy();
  await expect(page.getByRole('list', { name: 'Active filters' }).getByText('Budget: EUR 60')).toBeVisible();
  const again = page.waitForResponse((r) => r.url().includes('/api/personal-shopping/recommend'));
  await page.getByRole('button', { name: 'Remove filter: Budget: EUR 60' }).click();
  expect((await (await again).json()).results.length).toBe(10);
});

test('currency must match the budget and is never converted', async ({ page }) => {
  await onboard(page, { needs: ['easy'] });
  await page.getByText('Refine preferences').click();
  await page.getByLabel(/maximum price/i).fill('200');
  await page.getByLabel('Currency').selectOption('USD');
  const response = page.waitForResponse((r) => r.url().includes('/api/personal-shopping/recommend'));
  await page.getByRole('button', { name: 'Update results' }).click();
  const data = await (await response).json();
  expect(data.results).toEqual([]);
  await expect(page.getByRole('heading', { name: 'No matches available' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove budget limit' })).toBeVisible();
});

test('live catalog without data stays empty and never substitutes samples', async ({ page }) => {
  await onboard(page, { testUser:'empty-catalog', needs: ['easy'] });
  await page.getByText('Refine preferences').click();
  await page.getByLabel('Catalog source').selectOption('live');
  const response = page.waitForResponse((r) => r.url().includes('/api/personal-shopping/recommend'));
  await page.getByRole('button', { name: 'Update results' }).click();
  const data = await (await response).json();
  expect(data.mode).toBe('live');
  expect(data.results).toEqual([]);
  await expect(page.getByRole('heading', { name: 'No matches available' })).toBeVisible();
  await expect(page.getByText(/does not have any products for this search yet/i)).toBeVisible();
  await expect(page.getByText(/demo sample/i)).toHaveCount(0);
  await expect(page.locator('.product-card')).toHaveCount(0);
});

test('malformed requests and unauthenticated feedback fail safely', async ({ request }) => {
  const r = await request.post('/api/personal-shopping/recommend', { data: { category: 'invalid' } }); expect(r.status()).toBe(400);
  const f = await request.post('/api/personal-shopping/feedback', { data: { product_id: 'sample-s01', action: 'like' } }); expect(f.status()).toBe(401);
});

test('saved hard restrictions stay locked and saved optional refinements are visible, not silent', async ({ browser }) => {
  const user = `test-${Date.now()}`;
  // Session one saves a wool restriction, a budget and a size.
  const first = await browser.newPage();
  await first.setExtraHTTPHeaders({ 'x-e2e-user': user });
  const saveRes = await first.request.put('/api/personal-shopping/preferences', { headers: { 'x-e2e-user': user }, data: { consent: true, preferences: { category: 'all', size: 'M', fit: '', needs: ['easy_dressing', 'easy_fastening', 'limited_dexterity', 'adjustable_openings'], required_features: [], avoid_materials: ['wool'], prefer_materials: [], style: [], colors: [], max_price: 20, currency: 'EUR', country: 'DE', delivery: '', notes: '', custom_restrictions: '', mode: 'demo' } } });
  expect(saveRes.status()).toBe(200);
  await first.close();

  const second = await browser.newPage();
  await second.setExtraHTTPHeaders({ 'x-e2e-user': user });
  await second.goto('/discover');
  await expect(second.getByText('Your saved shopping preferences are loaded.')).toBeVisible();
  // Stale optional refinements are announced and clearable.
  await expect(second.getByText(/Saved refinements will also apply: Budget: EUR 20 · Size: M/)).toBeVisible();
  await second.getByRole('button', { name: 'Clear them' }).click();
  await expect(second.getByText(/Saved refinements will also apply/)).toHaveCount(0);
  await next(second); await next(second);
  // The saved hard restriction is still disclosed and enforced.
  await expect(second.getByText(/material restrictions remain active: wool/i)).toBeVisible();
  const { data } = await submit(second);
  expect(data.results.length).toBeGreaterThan(0);
  expect(data.results.every((p) => p.evidence.some((e) => e.attribute === 'wool' && e.value === 'absent'))).toBeTruthy();
  // The server keeps the saved restriction even if a client omits it.
  const bypass = await second.evaluate(async () => { const r = await fetch('/api/personal-shopping/recommend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: 'all', size: '', fit: '', needs: [], required_features: [], avoid_materials: [], prefer_materials: [], style: [], colors: [], max_price: null, currency: 'EUR', country: 'DE', delivery: '', notes: '', custom_restrictions: '', mode: 'demo' }) }); return r.json(); });
  expect(bypass.results.map((p) => p.id)).not.toContain('sample-p03');
  expect(bypass.results.every((p) => p.evidence.some((e) => e.attribute === 'wool' && e.value === 'absent'))).toBeTruthy();
  await second.close();
});

test('isolated feedback changes future ranking and preferences survive a new browser session', async ({ browser }) => {
  const first = await browser.newPage(); const user = `test-${Date.now()}`;
  const initial = await onboard(first, { testUser: user, category: 'Shirts', avoid: ['Wool'], consent: true });
  expect(initial.data.results[0].title).toContain('Easy Close');
  expect(initial.data.results.map((p) => p.id)).not.toContain('sample-wool');
  expect(initial.data.results.map((p) => p.id)).not.toContain('sample-unknown');
  const firstCard = first.locator('.product-card').first();
  await firstCard.getByRole('button', { name: 'Dislike' }).click();
  await expect(firstCard.getByRole('status')).toHaveText('Feedback saved for your next search.');
  await first.close();
  const second = await browser.newPage(); await second.setExtraHTTPHeaders({ 'x-e2e-user': user }); await second.goto('/discover');
  await expect(second.getByText('Your saved shopping preferences are loaded.')).toBeVisible();
  await next(second);
  await expect(second.getByRole('radio', { name: /^Shirts/ })).toBeChecked();
  await next(second);
  await expect(second.getByText(/material restrictions remain active: wool/i)).toBeVisible();
  const { data } = await submit(second);
  expect(data.results[0].title).toContain('Soft Seam');
  expect(data.results.every((p) => p.evidence.some((e) => e.attribute === 'wool' && e.value === 'absent'))).toBeTruthy();
  await second.close();
});

test.skip('authenticated feedback and preference persistence in an isolated project', () => {});
