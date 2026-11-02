import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir:'./e2e', timeout:60000, fullyParallel:false, workers:1,
  reporter:[['list'],['html',{outputFolder:'playwright-report',open:'never'}]],
  use:{baseURL:'http://127.0.0.1:3107',screenshot:'only-on-failure',trace:'retain-on-failure',video:'retain-on-failure'},
  projects:[{name:'chromium',use:{...devices['Desktop Chrome'],channel:'chromium'}}],
  webServer:{command:'npm run dev -- --hostname 127.0.0.1 --port 3107',url:'http://127.0.0.1:3107/discover',reuseExistingServer:false,timeout:120000,env:{E2E_GRAPH_TRACE:'1',NEXT_TELEMETRY_DISABLED:'1'}}
});
