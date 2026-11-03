import {test,expect} from '@playwright/test';

test('live Anthropic suggestions and real Supabase recommendations',async({page})=>{
  test.skip(process.env.RUN_LIVE_FIT_COMPANION!=='1','Opt in to a live AI request and Supabase read.');
  await page.goto('/discover');
  await page.getByRole('button',{name:'Talk to my Fit Companion'}).click();
  await page.getByLabel('Your message').fill('I use a wheelchair, I prefer black casual trousers, and small buttons are difficult.');
  await page.getByRole('button',{name:'Ask Fit Companion'}).click();
  await expect(page.getByRole('heading',{name:/AI suggestions/})).toBeVisible({timeout:30000});
  const review=page.getByRole('region',{name:'Review AI suggestions'});
  await expect(review.getByRole('group',{name:'Clothing needs'}).getByLabel('Seated Fit')).toBeChecked();
  await expect(review.getByLabel('Suggested category')).toHaveValue('trousers');
  await page.getByRole('button',{name:'Confirm and find clothing'}).click();
  await expect(page.getByRole('heading',{name:'Your clothing matches'})).toBeVisible();
  await expect(page.locator('.product-card').first()).toBeVisible();
  await expect(page.locator('.product-card').first().getByText(/Product evidence:/)).toBeVisible();
  await page.getByLabel('Your message').fill('Please avoid magnetic closures.');
  await page.getByRole('button',{name:'Ask Fit Companion'}).click();
  await expect(review.getByRole('group',{name:'Fastenings to avoid'}).getByLabel('Magnetic Closure')).toBeChecked({timeout:30000});
  await page.getByRole('button',{name:'Confirm and find clothing'}).click();
  await expect(page.getByRole('heading',{name:'No confirmed matches'})).toBeVisible();
});
