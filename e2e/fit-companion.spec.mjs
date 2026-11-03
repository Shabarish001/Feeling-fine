import {test,expect} from '@playwright/test';

test('confirmed AI suggestions, session feedback, exclusion and explicit saving',async({page})=>{
  // The AI and catalog here are controlled fixtures; this is not a live AI or retailer test.
  await page.setExtraHTTPHeaders({'x-e2e-user':'companion-test','x-e2e-catalog':'fixture'});
  let calls=0;
  await page.route('**/api/personal-shopping/companion',async route=>{
    const message=route.request().postDataJSON().message;calls++;
    const base={needs:[],required_features:[],avoid_materials:[],avoid_features:[],prefer_features:[],category:'all',colors:[],style:[],dressing_mode:'unspecified'};
    const suggestions=calls===1?{...base,needs:['easy_fastening'],category:'shirts'}:{...base,avoid_features:['magnetic_closure']};
    expect(message).toBeTruthy();await route.fulfill({json:{suggestions}});
  });
  await page.goto('/discover');
  await page.getByRole('button',{name:'Talk to my Fit Companion'}).click();
  await page.getByLabel('Your message').fill('Small buttons are difficult; I want shirts.');
  await page.getByRole('button',{name:'Ask Fit Companion'}).click();
  await expect(page.getByRole('heading',{name:/AI suggestions/})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Your clothing matches'})).toHaveCount(0);
  await page.getByRole('button',{name:'Confirm and find clothing'}).click();
  await expect(page.getByRole('heading',{name:'Your clothing matches'})).toBeVisible();
  const card=page.locator('.product-card').first();await expect(card).toContainText('FIXTURE Magnetic Shirt');
  await expect(card.getByText(/Product evidence:/)).toBeVisible();
  await card.getByRole('button',{name:/Not suitable for me \(this session\)/}).click();
  await expect(page.getByText(/marked these results as not suitable/)).toBeVisible();
  await page.getByLabel('Your message').fill('Please avoid magnetic closures.');
  await page.getByRole('button',{name:'Ask Fit Companion'}).click();
  await page.getByRole('button',{name:'Confirm and find clothing'}).click();
  await expect(page.getByRole('heading',{name:'No confirmed matches'})).toBeVisible();
  await page.getByText('Fastenings and materials', {exact:true}).click();
  await expect(page.getByRole('group',{name:'Fastenings to avoid'}).getByLabel('Magnetic Closure')).toBeChecked();
  await page.getByRole('button',{name:'Remember these preferences'}).click();
  await expect(page.getByText(/confirmed preferences were saved/)).toBeVisible();
  const saved=await (await page.request.get('/api/personal-shopping/preferences',{headers:{'x-e2e-user':'companion-test'}})).json();
  expect(saved.preferences.avoid_features).toContain('magnetic_closure');expect(saved.preferences.needs).toContain('easy_fastening');
  expect(JSON.stringify(saved)).not.toContain('Small buttons are difficult');
});

test('companion remains usable on a narrow screen',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.route('**/api/personal-shopping/preferences',r=>r.fulfill({status:401,json:{error:'Guest'}}));
  await page.goto('/discover');await page.getByRole('button',{name:'Talk to my Fit Companion'}).click();
  await expect(page.getByLabel('Your message')).toBeVisible();
  await expect(page.getByRole('button',{name:'Find my matches'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});
