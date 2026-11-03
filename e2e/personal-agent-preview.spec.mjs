import { test, expect } from '@playwright/test';

test('personal agent button opens the coming soon preview and returns to Discover', async ({ page }) => {
  await page.goto('/discover');
  await page.getByRole('button', { name: 'Personal agent · Coming soon' }).click();
  await expect(page.getByRole('heading', { name: 'Clothing that understands you.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'What your agent will do' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Understand your needs' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Find clothing that fits your choices' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Remember what matters to you' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Your message' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Explore clothing now' }).click();
  await expect(page.getByRole('heading', { name: 'What matters most in your clothes?' })).toBeVisible();
});

test('personal agent preview fits a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/discover');
  await page.getByRole('button', { name: 'Personal agent · Coming soon' }).click();
  await expect(page.getByRole('button', { name: 'Explore clothing now' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});
