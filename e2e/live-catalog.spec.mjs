import { test, expect } from '@playwright/test';

// CONTROLLED FIXTURES. These tests run the real UI, real API route and real LangGraph against a fixture catalog
// (header x-e2e-catalog: fixture, local test gate only). They prove rendering and rules, NOT that the production
// Supabase catalog contains products. See REAL_CATALOG_INTEGRATION_REPORT.md for the real remote counts.
const SHOTS = 'artifacts/real-catalog';
const FIXTURE = 'https://fixtures.feelingfind.test';
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="420"><rect width="400" height="420" fill="#c9b8e8"/><text x="200" y="215" text-anchor="middle" font-size="26" fill="#3f3366">FIXTURE PHOTO</text></svg>';

async function useFixtures(page, avoid = []) {
  await page.setExtraHTTPHeaders({ 'x-e2e-catalog': 'fixture' });
  await page.route('**/api/personal-shopping/preferences', (r) => avoid.length
    ? r.fulfill({ status: 200, json: { preferences: { mode: 'live', avoid_materials: avoid.map(x=>x.toLowerCase()) } } })
    : r.fulfill({ status: 401, json: { error: 'Guest' } }));
  // The fixture host is reserved (.test) and never reached: its image and retailer page are served here.
  await page.context().route(`${FIXTURE}/**`, (route) => {
    const url = route.request().url();
    if (url.includes('/images/')) return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: SVG });
    return route.fulfill({ status: 200, contentType: 'text/html', body: `<title>Fixture retailer</title><h1>Fixture retailer page</h1><p>${url}</p>` });
  });
}
const next = (page) => page.getByRole('button', { name: /continue/i }).click();
async function runLive(page, o = {}) {
  await useFixtures(page, o.avoid || []);
  await page.goto('/discover');
  await expect(page.getByText(/Searching the live catalog \(3 products\)/)).toBeVisible();
  const need = { easy: /Easy dressing and fastenings/, sensory: /Sensory-friendly and soft/, seated: /Seated comfort and accessible fit/ };
  for (const n of o.needs || []) await page.getByRole('checkbox', { name: need[n] }).check();
  await next(page); await next(page);
  if (o.required) {
    await page.getByText('Non-negotiable accessibility requirements').click();
    for (const f of o.required) await page.getByRole('group', { name: 'Required accessibility features' }).getByLabel(f).check();
  }
  const response = page.waitForResponse((r) => r.url().includes('/api/personal-shopping/recommend') && r.request().method() === 'POST');
  await page.getByRole('button', { name: /show my matches/i }).click();
  const res = await response;
  return { data: await res.json(), payload: res.request().postDataJSON() };
}

test('1. demo mode shows clearly labelled illustrated samples (when the live catalog is empty)', async ({ page, request }) => {
  const status = await (await request.get('/api/personal-shopping/catalog-status')).json();
  test.skip(status.live_products > 0, 'The real catalog now has products, so live is the default; demo is covered in personalization.spec.');
  await page.route('**/api/personal-shopping/preferences', (r) => r.fulfill({ status: 401, json: { error: 'Guest' } }));
  await page.goto('/discover');
  await expect(page.getByText(/live catalog has no products yet/i)).toBeVisible();
  await page.getByRole('checkbox', { name: /Easy dressing and fastenings/ }).check();
  await next(page); await next(page);
  await page.getByRole('button', { name: /show my matches/i }).click();
  await expect(page.locator('.product-card').first()).toBeVisible();
  for (const badge of await page.locator('.product-card .sample-badge').allInnerTexts()) expect(badge).toMatch(/demo sample - not for sale/i);
  await expect(page.getByRole('link', { name: /view at retailer/i })).toHaveCount(0);
  await expect(page.locator('.garment-art').first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/demo-mode-desktop.png`, fullPage: true });
});

test('2. live mode reads the fixture catalog and never shows demo products', async ({ page }) => {
  const { data, payload } = await runLive(page, { needs: ['easy'] });
  expect(payload.mode).toBe('live');
  expect(data.mode).toBe('live');
  expect(data.results.every((p) => !p.id.startsWith('sample-'))).toBeTruthy();
  await expect(page.getByText(/demo sample/i)).toHaveCount(0);
  await expect(page.getByText('Catalog results reflect available source evidence', { exact: false })).toBeVisible();
});

test('3. a real-format listing renders image, price and currency, retailer, date, and a working retailer link', async ({ page, context }) => {
  const { data } = await runLive(page, { needs: ['easy'] });
  expect(data.results.length).toBe(1);
  const card = page.locator('.product-card').first();
  await expect(card.locator('h3')).toContainText('FIXTURE Magnetic Shirt');
  // Image: the approved image URL renders (naturalWidth > 0 means it actually decoded).
  const img = card.locator('.product-media img');
  await expect(img).toHaveAttribute('src', `${FIXTURE}/images/fixture-1.svg`);
  await expect.poll(() => img.evaluate((el) => el.naturalWidth)).toBeGreaterThan(0);
  // Price keeps its original currency (GBP, not converted), with an observation date.
  await expect(card.locator('.product-price')).toHaveText('£89.90');
  await expect(card.getByText('GBP', { exact: true })).toBeVisible();
  await expect(card.getByText(/Fixture Retailer \(test data\)/).first()).toBeVisible();
  await expect(card.getByText(/price observed Nov 1, 2026/)).toBeVisible();
  // Seller claims are labelled, not presented as verified.
  await expect(card.getByText(/Magnetic Closure · unverified claim/)).toBeVisible();
  await expect(card.getByText(/Seller-claimed feature \(not independently verified\)/).first()).toBeVisible();
  await expect(card.locator('.badge')).toHaveText(/Catalog listing/i);
  // View at retailer opens the exact listing URL.
  const link = card.getByRole('link', { name: /view at retailer/i });
  await expect(link).toHaveAttribute('href', `${FIXTURE}/products/fixture-1`);
  await expect(link).toHaveAttribute('target', '_blank');
  const [popup] = await Promise.all([context.waitForEvent('page'), link.click()]);
  await popup.waitForLoadState();
  expect(popup.url()).toBe(`${FIXTURE}/products/fixture-1`);
  await expect(popup.getByRole('heading', { name: 'Fixture retailer page' })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/live-fixture-card-desktop.png`, fullPage: true });
});

test('4. missing image and link are shown honestly, not invented', async ({ page }) => {
  const { data } = await runLive(page, { needs: ['seated'] });
  expect(data.results.map((p) => p.title)).toEqual(['FIXTURE Seated Trouser (test data)']);
  const card = page.locator('.product-card').first();
  await expect(card.getByText('ILLUSTRATION', { exact: true })).toBeAttached();
  await expect(card.getByText('Representative illustration, not a photograph of this product.')).toBeVisible();
  await expect(card.getByText(/No direct retailer link has been recorded/)).toBeVisible();
  await expect(card.getByRole('link', { name: /view at retailer/i })).toHaveCount(0);
  await expect(card.getByText('€120.00')).toBeVisible(); // EUR stays EUR
  await expect(card.getByText(/Documented feature: seated fit/)).toBeVisible(); // verified spec is "documented", not "seller-claimed"
});

test('5. a broken image falls back instead of showing a broken picture', async ({ page }) => {
  await useFixtures(page);
  await page.context().route(`${FIXTURE}/images/**`, (r) => r.abort());
  await page.goto('/discover');
  await expect(page.getByText(/Searching the live catalog/)).toBeVisible();
  await page.getByRole('checkbox', { name: /Easy dressing and fastenings/ }).check();
  await next(page); await next(page);
  await page.getByRole('button', { name: /show my matches/i }).click();
  await expect(page.locator('.product-card .garment-art')).toBeVisible();
  await expect(page.locator('.product-card .product-media img')).toHaveCount(0);
});

test('6. personalised ranking and filtering use real product attributes', async ({ browser }) => {
  const a = await browser.newPage(), b = await browser.newPage();
  const easy = await runLive(a, { needs: ['easy'] }), sensory = await runLive(b, { needs: ['sensory'] });
  expect(easy.data.results.map((p) => p.title)).toEqual(['FIXTURE Magnetic Shirt (test data)']);
  expect(sensory.data.results.map((p) => p.title)).toEqual(['FIXTURE Tagless Tee (test data)']);
  await a.close(); await b.close();
});

test('7. hard restrictions are not weakened for live products', async ({ page, browser }) => {
  // A seller claim is not verified evidence, so it cannot satisfy a REQUIRED feature.
  const required = await runLive(page, { required: ['Limited Dexterity'] });
  expect(required.data.results).toEqual([]);
  await expect(page.getByRole('heading', { name: 'No matches available' })).toBeVisible();
  await expect(page.getByText(/no documented evidence for the accessibility features you marked as required/i)).toBeVisible();
  // Avoiding wool keeps only the garment with a verified wool-free specification.
  const other = await browser.newPage();
  const wool = await runLive(other, { avoid: ['Wool'] });
  expect(wool.data.results.map((p) => p.title)).toEqual(['FIXTURE Magnetic Shirt (test data)']);
  await expect(other.getByText(/Confirmed free of: Wool/)).toBeVisible();
  await other.close();
});

test('8. the real empty live catalog gives an honest empty state', async ({ page, request }) => {
  const status = await (await request.get('/api/personal-shopping/catalog-status')).json();
  test.skip(status.live_products > 0, 'The real catalog now has products.');
  await page.route('**/api/personal-shopping/preferences', (r) => r.fulfill({ status: 401, json: { error: 'Guest' } }));
  await page.goto('/discover');
  await page.getByRole('checkbox', { name: /Easy dressing and fastenings/ }).check();
  await next(page); await next(page);
  await page.getByRole('button', { name: /show my matches/i }).click();
  await page.getByText('Refine preferences').click();
  await page.getByLabel('Catalog source').selectOption('live');
  await page.getByRole('button', { name: 'Update results' }).click();
  await expect(page.getByRole('heading', { name: 'No matches available' })).toBeVisible();
  await expect(page.getByText(/does not have any products for this search yet/i)).toBeVisible();
  await expect(page.getByText(/demo sample/i)).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/live-empty-real-catalog.png`, fullPage: true });
});

test('9. mobile layout renders the live card with image, price, and a tappable retailer link', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await runLive(page, { needs: ['easy'] });
  const card = page.locator('.product-card').first();
  await expect(card.locator('.product-media img')).toBeVisible();
  const link = card.getByRole('link', { name: /view at retailer/i });
  await link.scrollIntoViewIfNeeded();
  const box = await link.boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: `${SHOTS}/live-fixture-card-mobile.png`, fullPage: true });
});
