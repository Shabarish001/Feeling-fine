import {test,expect} from '@playwright/test';

test('material checkboxes are hidden and existing saved restrictions remain active',async({page})=>{
  const user='saved-material-test';
  await page.setExtraHTTPHeaders({'x-e2e-user':user,'x-e2e-catalog':'fixture'});
  const response=await page.request.put('/api/personal-shopping/preferences',{headers:{'x-e2e-user':user},data:{consent:true,preferences:{mode:'live',avoid_materials:['polyester']}}});
  expect(response.status()).toBe(200);
  await page.goto('/discover');
  await expect(page.getByText('Your saved shopping preferences are loaded.')).toBeVisible();
  await page.getByRole('checkbox',{name:/Easy dressing and fastenings/}).check();
  await page.getByRole('button',{name:/continue/i}).click();
  await page.getByRole('button',{name:/continue/i}).click();
  await expect(page.getByRole('group',{name:'Must avoid'})).toHaveCount(0);
  await expect(page.getByText(/material restrictions remain active: polyester/i)).toBeVisible();
  await page.getByRole('button',{name:/show my matches/i}).click();
  await expect(page.getByRole('heading',{name:'No matches available'})).toBeVisible();
  await expect(page.getByText(/could not be confirmed free of the materials/i)).toBeVisible();
  await page.getByRole('button',{name:'Review saved restrictions'}).click();
  await expect(page.getByText(/material restrictions remain active: polyester/i)).toBeVisible();
});
