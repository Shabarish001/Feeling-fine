import {test,expect} from '@playwright/test';

// Uses the real read-only Supabase catalog and recommendation API; no fixture catalog.
test('real catalog: needs, recommendation, illustration and direct Zalando link',async({page,context})=>{
  await page.route('**/api/personal-shopping/preferences',r=>r.fulfill({status:401,json:{error:'Guest'}}));
  // Test the destination without making another request to the retailer after its rate limit.
  await context.route('https://en.zalando.de/**',r=>r.fulfill({status:200,contentType:'text/html',body:'<title>Retailer destination test</title>'}));
  await page.goto('/discover');
  await expect(page.getByText(/Searching the live catalog/)).toBeVisible();
  await page.getByRole('checkbox',{name:/Easy dressing and fastenings/}).check();
  await page.getByRole('button',{name:/continue/i}).click();
  await page.getByRole('button',{name:/continue/i}).click();
  const response=page.waitForResponse(r=>r.url().includes('/api/personal-shopping/recommend')&&r.request().method()==='POST');
  await page.getByRole('button',{name:/show my matches/i}).click();
  const res=await response;expect(res.status()).toBe(200);const data=await res.json();
  expect(data.mode).toBe('live');expect(data.results.length).toBeGreaterThan(0);
  const card=page.locator('.product-card').first();await expect(card).toBeVisible();
  await expect(card.getByText('Representative illustration, not a photograph of this product.')).toBeVisible();
  await expect(card.getByText('Availability is unknown; check the retailer.')).toBeVisible();
  await expect(card.getByText('Why it matches')).toBeVisible();
  const link=card.getByRole('link',{name:/view on zalando/i});const href=await link.getAttribute('href');
  expect(href).toBe(data.results[0].offers[0].product_url);expect(new URL(href).hostname).toBe('en.zalando.de');
  const popupPromise=page.waitForEvent('popup');await link.click();const popup=await popupPromise;await popup.waitForLoadState();expect(popup.url()).toBe(href);
});

test('research records are labeled and stock is not presented as confirmed',async({page})=>{
  await page.route('**/api/personal-shopping/preferences',r=>r.fulfill({status:401,json:{error:'Guest'}}));
  await page.goto('/discover');
  await page.getByRole('button',{name:/continue/i}).click();
  await page.getByRole('button',{name:/continue/i}).click();
  const response=page.waitForResponse(r=>r.url().includes('/api/personal-shopping/recommend')&&r.request().method()==='POST');
  await page.getByRole('button',{name:/show my matches/i}).click();
  const data=await (await response).json();expect(data.mode).toBe('live');
  expect(data.results.length).toBe(20);
  const research=page.locator('.product-card').filter({hasText:'Research listing: identity and features have not been independently verified.'});
  await expect(research.first()).toBeVisible();
  await expect(research.first().getByText('Availability is unknown; check the retailer.')).toBeVisible();
  await expect(research.first().getByText(/unverified claim/).first()).toBeVisible();
});

test('material checkboxes are not shown in the onboarding flow',async({page})=>{
  await page.route('**/api/personal-shopping/preferences',r=>r.fulfill({status:401,json:{error:'Guest'}}));
  await page.goto('/discover');
  await expect(page.getByText(/Searching the live catalog/)).toBeVisible();
  await page.getByRole('checkbox',{name:/Easy dressing and fastenings/}).check();
  await page.getByRole('checkbox',{name:/Sensory-friendly and soft/}).check();
  await page.getByRole('button',{name:/continue/i}).click();
  await page.getByRole('button',{name:/continue/i}).click();
  await expect(page.getByRole('group',{name:'Must avoid'})).toHaveCount(0);
  await page.getByRole('button',{name:/show my matches/i}).click();
  await expect(page.locator('.product-card').first()).toBeVisible();
});

test('required features stay selected when reviewing an empty shirt search',async({page})=>{
  await page.route('**/api/personal-shopping/preferences',r=>r.fulfill({status:401,json:{error:'Guest'}}));
  await page.goto('/discover');
  await expect(page.getByText(/Searching the live catalog/)).toBeVisible();
  await page.getByRole('checkbox',{name:/Easy dressing and fastenings/}).check();
  await page.getByRole('checkbox',{name:/Sensory-friendly and soft/}).check();
  await page.getByRole('button',{name:/continue/i}).click();
  await page.getByRole('radio',{name:/^Shirts/}).check();
  await page.getByRole('button',{name:/continue/i}).click();
  await expect(page.getByText(/5 catalog products match your current choices/i)).toBeVisible();
  await page.getByText('Non-negotiable accessibility requirements').click();
  const required=page.getByRole('group',{name:'Required accessibility features'});
  await required.getByLabel('Sensory Softness').check();
  await required.getByLabel('Easy Fastening').check();
  await expect(page.getByText(/No catalog products currently match all your required choices/i)).toBeVisible();
  await page.getByRole('button',{name:/show my matches/i}).click();
  await expect(page.getByRole('heading',{name:'No matches available'})).toBeVisible();
  await expect(page.getByText(/Every feature you marked as required must be documented for the same garment/)).toBeVisible();
  await page.getByRole('button',{name:'Review required features'}).click();
  await expect(required.getByLabel('Sensory Softness')).toBeChecked();
  await expect(required.getByLabel('Easy Fastening')).toBeChecked();
  await required.getByLabel('Sensory Softness').uncheck();
  await expect(page.getByText(/5 catalog products match your current choices/i)).toBeVisible();
  await page.getByRole('button',{name:/show my matches/i}).click();
  await expect(page.locator('.product-card')).toHaveCount(5);
});
