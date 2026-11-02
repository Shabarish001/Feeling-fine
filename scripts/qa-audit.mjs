// Final UI QA audit. Usage: node scripts/qa-audit.mjs [baseUrl]
// Measures WCAG contrast from rendered pixels (text hidden, worst case per text box),
// checks keyboard focus, reduced motion, accessible names, states and overflow.
// Store results use CLEARLY LABELLED FIXTURES (names end in "(fixture)") via route mocking.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const base = process.argv[2] || 'http://localhost:3000';
const out = 'artifacts/qa';
mkdirSync(out, { recursive: true });

const FIXTURE_STORES = [
  { id: 'fixture-1', name: 'Fixture Store Mitte (fixture)', store_name: 'Fixture Mitte', address: 'Fixture Str. 1, 10115 Berlin', lat: 52.5219, lng: 13.4132, rating: 4.6, review_count: 120, website: 'https://example.com/fixture-1', google_maps_url: 'https://www.google.com/maps/search/?api=1&query=fixture-1', phone: '+49 30 000001', relevance_tags: ['adaptive', 'easy fastening'], description: 'Deterministic fixture used for rendering tests only.', opening_hours: 'Mon–Sat 10:00–19:00', image_url: null },
  { id: 'fixture-2', name: 'Fixture Store Kreuzberg (fixture)', store_name: 'Fixture Kreuzberg', address: 'Fixture Str. 2, 10997 Berlin', lat: 52.4985, lng: 13.4216, rating: 4.1, review_count: 58, website: 'https://example.com/fixture-2', google_maps_url: 'https://www.google.com/maps/search/?api=1&query=fixture-2', phone: '+49 30 000002', relevance_tags: ['soft fabrics'], description: 'Deterministic fixture used for rendering tests only.', opening_hours: null, image_url: null },
  { id: 'fixture-3', name: 'Fixture Store Prenzlauer Berg (fixture)', store_name: 'Fixture Prenzlauer', address: 'Fixture Str. 3, 10437 Berlin', lat: 52.5388, lng: 13.4238, rating: null, review_count: null, website: null, google_maps_url: null, phone: null, relevance_tags: [], description: null, opening_hours: null, image_url: null },
];

const browser = await chromium.launch({ channel: 'chromium' });
const report = { contrast: {}, keyboard: {}, reducedMotion: {}, names: {}, states: {}, stores: {}, overflow: {}, errors: [] };
const log = (...a) => console.log(...a);

function newPage(ctx) {
  return ctx.newPage().then((p) => {
    p.on('pageerror', (e) => report.errors.push(`pageerror: ${e.message}`));
    p.on('console', (m) => {
      if (m.type() === 'error' && !/Failed to load resource|googleapis|gstatic|maps\.google|google\.com|favicon|Download the React DevTools|Warning: /.test(m.text())) report.errors.push(`console: ${m.text().slice(0, 200)}`);
    });
    return p;
  });
}

// ---- Contrast: text hidden → sample background pixels under each text box → worst-case WCAG ratio ----
async function contrast(page, label) {
  const boxes = await page.evaluate(() => {
    const vw = innerWidth, vh = innerHeight, res = [];
    const op = (el) => { let o = 1; for (let n = el; n && n !== document.documentElement; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity); return o; };
    // Sample only the glyph line boxes (Range rects), not padding or rounded corners.
    for (const el of document.body.querySelectorAll('*')) {
      const textNodes = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim());
      if (!textNodes.length) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || op(el) < 0.95) continue;
      const size = parseFloat(cs.fontSize), weight = parseInt(cs.fontWeight, 10);
      for (const node of textNodes) {
        const range = document.createRange(); range.selectNodeContents(node);
        for (const r0 of range.getClientRects()) {
          // Clip to every scrolling/clipping ancestor: text scrolled out of a box is not visible, so it is not measured.
          let r = { left: r0.left, top: r0.top, right: r0.right, bottom: r0.bottom };
          for (let a = el; a && a !== document.body; a = a.parentElement) {
            const ocs = getComputedStyle(a);
            if (ocs.overflowY === 'visible' && ocs.overflowX === 'visible') continue;
            const ar = a.getBoundingClientRect();
            r = { left: Math.max(r.left, ar.left), top: Math.max(r.top, ar.top), right: Math.min(r.right, ar.right), bottom: Math.min(r.bottom, ar.bottom) };
          }
          if (r.right - r.left < 4 || r.bottom - r.top < 4) continue;
          if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue;
          const x0 = Math.max(1, r.left + 1), y0 = Math.max(1, r.top + 1), x1 = Math.min(vw - 1, r.right - 1), y1 = Math.min(vh - 1, r.bottom - 1);
          if (x1 - x0 < 3 || y1 - y0 < 3) continue;
          res.push({ text: node.textContent.trim().replace(/\s+/g, ' ').slice(0, 45), color: cs.color, box: [x0, y0, x1, y1], large: size >= 24 || (size >= 18.66 && weight >= 700) });
        }
      }
    }
    return res;
  });

  // nextjs-portal is the dev-only indicator; hide it so it is not sampled as page background.
  const hide = await page.addStyleTag({ content: '*,*::before,*::after{color:transparent!important;text-shadow:none!important;-webkit-text-fill-color:transparent!important;caret-color:transparent!important} ::placeholder{color:transparent!important} nextjs-portal{display:none!important}' });
  await page.waitForTimeout(120);
  const png = (await page.screenshot({ type: 'png' })).toString('base64');
  await hide.evaluate((el) => el.remove());

  const result = await page.evaluate(async ({ b64, boxes }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
    const { data, width } = ctx.getImageData(0, 0, c.width, c.height);
    // Screenshots are at devicePixelRatio; map CSS-pixel boxes onto image pixels.
    const sx = img.width / innerWidth, sy = img.height / innerHeight;
    const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const L = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    const ratio = (a, b) => { const [hi, lo] = a > b ? [a, b] : [b, a]; return (hi + 0.05) / (lo + 0.05); };
    const parse = (s) => { const m = s.match(/[\d.]+/g).map(Number); return [m[0], m[1], m[2], m.length > 3 ? m[3] : 1]; };
    return boxes.map((b) => {
      const [r, g, bl, a] = parse(b.color);
      let worst = Infinity, worstBg = null;
      const [x0, y0, x1, y1] = b.box;
      for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) {
        const x = Math.round((x0 + ((x1 - x0) * i) / 4) * sx), y = Math.round((y0 + ((y1 - y0) * j) / 2) * sy);
        const k = (y * width + x) * 4;
        const bg = [data[k], data[k + 1], data[k + 2]];
        const fg = [r * a + bg[0] * (1 - a), g * a + bg[1] * (1 - a), bl * a + bg[2] * (1 - a)];
        const cr = ratio(L(...fg), L(...bg));
        if (cr < worst) { worst = cr; worstBg = bg; }
      }
      return { text: b.text, large: b.large, ratio: Math.round(worst * 100) / 100, required: b.large ? 3 : 4.5, bg: worstBg };
    });
  }, { b64: png, boxes });

  const failures = result.filter((r) => r.ratio < r.required);
  report.contrast[label] = { checked: result.length, failures: failures.length, minRatio: result.length ? Math.min(...result.map((r) => r.ratio)) : null, failed: failures.map(({ text, ratio, required, large }) => ({ text, ratio, required, large })) };
  log(`contrast ${label}: checked ${result.length}, failures ${failures.length}`);
  return failures;
}

// ---- Accessible names on interactive elements ----
async function names(page, label) {
  const bad = await page.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll('button,a[href],input,select,textarea,[role=button]')) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const lb = el.getAttribute('aria-labelledby');
      let name = el.getAttribute('aria-label')
        || (lb && document.getElementById(lb)?.textContent)
        || (el.labels && [...el.labels].map((l) => l.textContent).join(' '))
        || el.textContent || el.getAttribute('title') || el.getAttribute('alt') || el.placeholder || el.value;
      const img = el.querySelector && el.querySelector('img[alt]');
      if (!name && img) name = img.alt;
      if (!name || !name.trim()) bad.push(el.outerHTML.slice(0, 110));
    }
    return bad;
  });
  report.names[label] = bad;
  log(`names ${label}: ${bad.length} unnamed`);
}

// ---- Keyboard: walk Tab order, check every focused control has a visible focus indicator ----
async function keyboard(page, label, presses = 24) {
  const rows = [];
  for (let i = 0; i < presses; i++) {
    await page.keyboard.press('Tab');
    rows.push(await page.evaluate(() => {
      const el = document.activeElement;
      // Focus rings for these controls are drawn on an enclosing container (checkbox cards, chat composer, toolbars).
      const target = el.closest('.composer-wrap') || el.closest('.choice, .composer, .filter-search, .map-search') || el;
      const cs = getComputedStyle(target);
      const hasRing = cs.outlineStyle !== 'none' || (cs.boxShadow && cs.boxShadow !== 'none');
      return { tag: el.tagName, name: (el.getAttribute('aria-label') || el.textContent || el.name || '').trim().replace(/\s+/g, ' ').slice(0, 40), ring: hasRing };
    }));
  }
  // BODY and the dev-only Next.js portal are not controls; they appear only when Tab wraps.
  const noRing = rows.filter((r) => !r.ring && r.tag !== 'BODY' && r.tag !== 'NEXTJS-PORTAL');
  report.keyboard[label] = { stops: rows.length, withoutFocusRing: noRing.map((r) => `${r.tag} ${r.name}`) };
  log(`keyboard ${label}: ${rows.length} stops, ${noRing.length} without visible focus ring`);
}

// ---- Overflow at several widths ----
async function overflow(ctx) {
  const page = await newPage(ctx);
  await page.route('**/api/personal-shopping/preferences', (r) => r.fulfill({ status: 401, json: { error: 'Guest' } }));
  for (const w of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width: w, height: 860 });
    for (const route of ['/', '/discover', '/search', '/login', '/signup', '/about']) {
      await page.goto(base + route); await page.waitForTimeout(350);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      if (over > 1) report.overflow[`${w} ${route}`] = over;
    }
  }
  await page.close();
}

const guestRoute = (page) => page.route('**/api/personal-shopping/preferences', (r) => r.fulfill({ status: 401, json: { error: 'Guest' } }));
const mockChat = (page, status = 200, body = null) => page.route('**/api/chat', (r) => r.fulfill({ status, json: body || { reply: 'Here are three fixture stores near Berlin.', items: FIXTURE_STORES } }));

// ================= RUN =================
const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const dp = await newPage(desktop);
await guestRoute(dp);
await mockChat(dp);

// Home
await dp.goto(base + '/'); await dp.waitForTimeout(800);
await contrast(dp, 'desktop home hero');
await names(dp, 'desktop home');
await keyboard(dp, 'desktop home', 14);

// Discover intro + results
await dp.goto(base + '/discover'); await dp.waitForTimeout(500);
await contrast(dp, 'desktop discover step 1');
await names(dp, 'desktop discover step 1');
await keyboard(dp, 'desktop discover step 1', 30);

// Loading state: delay the recommend call
await dp.route('**/api/personal-shopping/recommend', async (r) => { await new Promise((res) => setTimeout(res, 1500)); await r.continue(); });
await dp.goto(base + '/discover'); await dp.waitForTimeout(400);
for (let i = 0; i < 4; i++) await dp.getByRole('button', { name: /continue/i }).click();
await dp.getByRole('button', { name: /show my matches/i }).click();
report.states.loading = (await dp.getByText('Finding your edit…').count()) > 0;
await dp.screenshot({ path: `${out}/desktop-state-loading.png` });
await dp.waitForSelector('.product-card', { timeout: 20000 });
await dp.unroute('**/api/personal-shopping/recommend');

// Results (demo) — labelling and contrast
const cards = dp.locator('.product-card');
report.states.demoCards = await cards.count();
report.states.demoLabelled = await dp.locator('.product-card .sample-badge', { hasText: 'Demo sample - not for sale' }).count();
report.states.badgeTexts = await dp.locator('.product-card .sample-badge').allInnerTexts();
report.states.retailerLinksOnDemo = await dp.locator('.product-card a', { hasText: 'View retailer' }).count();
await dp.waitForTimeout(800);
await contrast(dp, 'desktop discover results');
await names(dp, 'desktop discover results');
await dp.screenshot({ path: `${out}/desktop-results-viewport.png` });

// Results → filter that matches nothing → empty-search state
await dp.getByRole('searchbox').fill('zzz-no-match');
report.states.noSearchMatchEmpty = (await dp.getByText('Nothing matches that search').count()) > 0;
await dp.getByRole('searchbox').fill('');

// Error state for recommendations
await dp.goto(base + '/discover'); await dp.waitForTimeout(400);
await dp.route('**/api/personal-shopping/recommend', (r) => r.fulfill({ status: 500, json: { error: 'Recommendations are unavailable right now.' } }));
for (let i = 0; i < 4; i++) await dp.getByRole('button', { name: /continue/i }).click();
await dp.getByRole('button', { name: /show my matches/i }).click();
await dp.waitForTimeout(500);
report.states.errorMessage = (await dp.getByRole('alert').filter({ hasText: 'unavailable' }).count()) > 0;
await dp.screenshot({ path: `${out}/desktop-state-error.png` });
await dp.unroute('**/api/personal-shopping/recommend');

// Stores: populated with fixtures
await dp.goto(base + '/search?q=' + encodeURIComponent('shirts easy to close')); await dp.waitForTimeout(1500);
report.stores.chips = await dp.locator('.result-chip').count();
report.stores.googlePins = await dp.locator('.pin-wrap').count();
await dp.waitForTimeout(2500);
report.stores.googlePinsAfterLoad = await dp.locator('.pin-wrap').count();
report.stores.mapLoaded = await dp.evaluate(() => !!document.querySelector('.gm-style'));
await contrast(dp, 'desktop stores populated');
await names(dp, 'desktop stores');
await dp.locator('.result-chip').nth(1).click();
report.stores.detailTitle = await dp.locator('.detail-card h3').innerText();
report.stores.directionsHref = await dp.locator('.detail-card a', { hasText: 'Get directions' }).getAttribute('href');
report.stores.stockNote = (await dp.locator('.stock-note').count()) > 0;
await dp.waitForTimeout(400);
await dp.screenshot({ path: `${out}/desktop-stores-detail.png` });
await dp.getByRole('button', { name: 'Next result' }).click();
report.stores.afterNext = await dp.locator('.detail-nav').innerText();
await dp.getByRole('button', { name: 'Close details' }).click();
report.stores.detailClosed = (await dp.locator('.detail-card').count()) === 0;
await dp.getByRole('button', { name: 'Filter' }).count();
await dp.getByRole('searchbox', { name: /search these stores/i }).fill('kreuzberg');
report.stores.filteredCount = await dp.locator('.result-chip').count();
await dp.screenshot({ path: `${out}/desktop-stores-filtered.png` });
await dp.getByRole('searchbox', { name: /search these stores/i }).fill('');

// Stores error + empty chat responses
const errPage = await newPage(desktop); await guestRoute(errPage);
await mockChat(errPage, 500, { error: 'Store search is unavailable right now.' });
await errPage.goto(base + '/search?q=test'); await errPage.waitForTimeout(1200);
report.states.storesError = (await errPage.getByText('Store search is unavailable right now.').count()) > 0;
await errPage.close();

// Mobile
const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const mp = await newPage(mobile); await guestRoute(mp); await mockChat(mp);
await mp.goto(base + '/'); await mp.waitForTimeout(800);
await contrast(mp, 'mobile home hero');
await mp.goto(base + '/discover'); await mp.waitForTimeout(500);
await contrast(mp, 'mobile discover step 1');
await mp.goto(base + '/search?q=' + encodeURIComponent('shirts easy to close')); await mp.waitForTimeout(2500);
await contrast(mp, 'mobile stores populated');
await mp.locator('.result-chip').nth(0).click({ force: true }).catch(() => {});
await mp.waitForTimeout(500);
const sheet = await mp.locator('.detail-card').boundingBox().catch(() => null);
report.stores.mobileSheet = sheet ? { x: Math.round(sheet.x), y: Math.round(sheet.y), w: Math.round(sheet.width), h: Math.round(sheet.height), vw: 390, vh: 844 } : null;
report.stores.mobileStripHiddenWhenSheet = await mp.locator('.result-strip').evaluate((el) => getComputedStyle(el).display === 'none').catch(() => null);
await mp.screenshot({ path: `${out}/mobile-stores-sheet.png` });
await mp.goto(base + '/search?q=' + encodeURIComponent('shirts easy to close')); await mp.waitForTimeout(1500);
await mp.screenshot({ path: `${out}/mobile-stores.png` });
await mp.close();

// Reduced motion vs normal motion
const rm = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const rp = await newPage(rm); await guestRoute(rp);
await rp.goto(base + '/'); await rp.waitForTimeout(600);
report.reducedMotion.sculptureAnimation = await rp.evaluate(() => getComputedStyle(document.querySelector('.sculpture-spin')).animationName);
report.reducedMotion.revealOpacityWithoutScroll = await rp.evaluate(() => getComputedStyle(document.querySelector('.journey-card')).opacity);
await rp.close();
const nm = await newPage(desktop);
await nm.goto(base + '/'); await nm.waitForTimeout(400);
report.reducedMotion.sculptureAnimationNormal = await nm.evaluate(() => getComputedStyle(document.querySelector('.sculpture-spin')).animationName);
await nm.close();

// Full-page capture for the journey section (verifies the earlier blank-band observation)
await dp.goto(base + '/'); await dp.waitForTimeout(400);
await dp.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } scrollTo(0, 0); });
await dp.waitForTimeout(1500);
report.reducedMotion.journeyOpacityAfterScroll = await dp.evaluate(() => getComputedStyle(document.querySelector('.journey-card')).opacity);
await dp.screenshot({ path: `${out}/desktop-home-fullpage.png`, fullPage: true });

// Static pages (non-mobile) names + contrast
for (const [route, label] of [['/login', 'login'], ['/signup', 'signup'], ['/about', 'about']]) {
  await dp.goto(base + route); await dp.waitForTimeout(500);
  await contrast(dp, `desktop ${label}`);
  await names(dp, `desktop ${label}`);
  await dp.screenshot({ path: `${out}/desktop-${label}-viewport.png` });
}
await dp.goto(base + '/profile'); await dp.waitForTimeout(400);
report.states.profileRedirect = dp.url().includes('/login');

await desktop.close();
await overflow(await browser.newContext({ viewport: { width: 1440, height: 900 } }));
await browser.close();

writeFileSync(`${out}/qa-report.json`, JSON.stringify(report, null, 2));
const contrastFails = Object.entries(report.contrast).filter(([, v]) => v.failures > 0);
log('\n--- SUMMARY ---');
log('contrast pages with failures:', contrastFails.map(([k, v]) => `${k} (${v.failures})`).join(', ') || 'none');
log('keyboard without ring:', JSON.stringify(Object.fromEntries(Object.entries(report.keyboard).map(([k, v]) => [k, v.withoutFocusRing]))));
log('unnamed controls:', JSON.stringify(Object.fromEntries(Object.entries(report.names).filter(([, v]) => v.length))));
log('overflow:', JSON.stringify(report.overflow));
log('states:', JSON.stringify(report.states));
log('stores:', JSON.stringify(report.stores));
log('reducedMotion:', JSON.stringify(report.reducedMotion));
log('errors:', report.errors.length ? report.errors.slice(0, 8).join('\n') : 'none');
