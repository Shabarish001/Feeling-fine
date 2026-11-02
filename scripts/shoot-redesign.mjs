// Screenshot the redesigned UI on desktop + mobile. Usage: node scripts/shoot-redesign.mjs [baseUrl]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] || 'http://localhost:3000';
const out = 'artifacts/redesign';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ channel: 'chromium' });
const errors = [];

async function scrollAll(page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 90)); }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(500);
}

for (const [name, viewport] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: name === 'mobile' ? 2 : 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name} pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|googleapis|gstatic/.test(m.text())) errors.push(`${name} console: ${m.text()}`); });
  await page.route('**/api/personal-shopping/preferences', (r) => r.fulfill({ status: 401, json: { error: 'Guest' } }));

  await page.goto(base + '/'); await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/${name}-home-hero.png` });
  await scrollAll(page);
  await page.screenshot({ path: `${out}/${name}-home-full.png`, fullPage: true });

  await page.goto(base + '/discover'); await page.waitForTimeout(500);
  await page.getByRole('group', { name: 'Functional preferences' }).getByLabel('Limited Dexterity').check();
  await page.getByRole('group', { name: 'Functional preferences' }).getByLabel('Tag Free').check();
  await page.screenshot({ path: `${out}/${name}-onboarding-1.png` });
  await page.getByRole('button', { name: /continue/i }).click();
  await page.getByRole('button', { name: /continue/i }).click();
  await page.getByRole('button', { name: /continue/i }).click();
  await page.getByRole('button', { name: /continue/i }).click();
  await page.screenshot({ path: `${out}/${name}-onboarding-review.png` });
  await page.getByRole('button', { name: /show my matches/i }).click();
  await page.getByRole('heading', { name: /made for the way/i }).waitFor();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}/${name}-results.png`, fullPage: true });

  await page.goto(base + '/search?q=' + encodeURIComponent('shirts easy to close')); await page.waitForTimeout(6000);
  await page.screenshot({ path: `${out}/${name}-stores.png`, fullPage: name === 'mobile' });

  for (const route of ['login', 'signup', 'about', 'profile']) {
    await page.goto(`${base}/${route}`); await page.waitForTimeout(500);
    if (route === 'about') await scrollAll(page);
    await page.screenshot({ path: `${out}/${name}-${route}.png`, fullPage: true });
  }
  // horizontal overflow check
  for (const route of ['/', '/discover', '/search', '/login', '/about', '/profile']) {
    await page.goto(base + route); await page.waitForTimeout(300);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (over > 1) errors.push(`${name} ${route}: horizontal overflow ${over}px`);
  }
  await ctx.close();
}
await browser.close();
console.log(errors.length ? errors.join('\n') : 'no errors');
