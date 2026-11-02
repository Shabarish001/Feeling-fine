// Clean "after" screenshots for ONBOARDING_MATCHING_FIX_REPORT.md. Usage: node scripts/shoot-onboarding-fix.mjs [baseUrl]
import { chromium } from '@playwright/test';
const base = process.argv[2] || 'http://localhost:3000';
const out = 'artifacts/onboarding-fix';
const b = await chromium.launch({ channel: 'chromium' });
for (const [name, viewport] of [['desktop', { width: 1280, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
  const p = await b.newPage({ viewport });
  await p.route('**/api/personal-shopping/preferences', (r) => r.fulfill({ status: 401, json: { error: 'Guest' } }));
  const settle = () => p.waitForTimeout(1000);
  await p.goto(base + '/discover'); await settle();
  await p.getByRole('checkbox', { name: /Easy dressing and fastenings/ }).check(); await settle();
  await p.screenshot({ path: `${out}/shot-${name}-1-needs.png` });
  await p.getByRole('button', { name: /continue/i }).click(); await settle();
  await p.screenshot({ path: `${out}/shot-${name}-2-category.png` });
  await p.getByRole('button', { name: /continue/i }).click(); await settle();
  await p.getByRole('group', { name: 'Must avoid' }).getByLabel('Wool').check(); await settle();
  await p.screenshot({ path: `${out}/shot-${name}-3-restrictions.png` });
  await p.getByRole('button', { name: /show my matches/i }).click();
  await p.getByRole('heading', { name: /made for the way/i }).waitFor(); await p.waitForTimeout(1500);
  await p.screenshot({ path: `${out}/shot-${name}-4-results.png` });
  await p.getByRole('button', { name: /change my answers/i }).first().click(); await settle();
  await p.getByRole('checkbox', { name: /Easy dressing and fastenings/ }).uncheck();
  await p.getByRole('checkbox', { name: /Sensory-friendly and soft/ }).check();
  await p.getByRole('button', { name: /continue/i }).click(); await p.getByRole('button', { name: /continue/i }).click(); await settle();
  await p.getByRole('group', { name: 'Must avoid' }).getByLabel('Polyester').check();
  await p.getByRole('button', { name: /show my matches/i }).click();
  await p.getByRole('heading', { name: 'No matches available' }).waitFor(); await p.waitForTimeout(1200);
  await p.screenshot({ path: `${out}/shot-${name}-5-empty-explained.png` });
  await p.close();
}
await b.close();
console.log('done');
