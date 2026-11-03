// Read-only advertiser-directory research. Never log tokens or publisher IDs.
import { readFile } from 'node:fs/promises';

const feed = await readFile(new URL('../data/imports/datafeed_3143018.csv', import.meta.url), 'utf8');
const publisher = process.env.AWIN_PUBLISHER_ID || feed.match(/[?&]a=(\d+)/)?.[1];
if (!publisher || !process.env.AWIN_API_TOKEN) throw new Error('Awin publisher and API token are required.');
const url = `https://api.awin.com/publishers/${publisher}/programmes`;
const response = await fetch(url, { headers: { Authorization: `Bearer ${process.env.AWIN_API_TOKEN}`, Accept: 'application/json' }, signal: AbortSignal.timeout(60000) });
if (!response.ok) throw new Error(`Awin directory returned HTTP ${response.status}.`);
const data = await response.json();
const rows = Array.isArray(data) ? data : data.programmes;
if (!Array.isArray(rows)) throw new Error('Unexpected Awin directory response.');
const terms = [ /able\s*2\s*wear/i, /vilber/i, /tamonda/i, /able\s*label/i, /silver.?ts/i, /iz adaptive/i, /joe\s*&?\s*bella/i, /buck\s*&?\s*buck/i, /care\s*&?\s*wear/i, /adaptive/i, /wheelchair/i, /magnetic shirts?/i, /easy dressing/i, /seated.fit/i, /disability fashion/i, /rollstuhl/i, /magnetverschluss/i, /pflegebekleidung/i ];
const hits = rows.filter(row => terms.some(term => term.test(JSON.stringify(row))));
console.log(JSON.stringify({total:rows.length,matches:hits.map(row=>({id:row.id,name:row.name,status:row.status,membershipStatus:row.membershipStatus,regions:row.regions,primaryRegion:row.primaryRegion,displayUrl:row.displayUrl,description:row.description}))},null,2));
for (const id of [63730, 46531, 1402, 23355]) {
  const result = await fetch(`https://api.awin.com/publishers/${publisher}/programmedetails?advertiserId=${id}&relationship=any`, {headers:{Authorization:`Bearer ${process.env.AWIN_API_TOKEN}`,Accept:'application/json'},signal:AbortSignal.timeout(30000)});
  if (!result.ok) { console.log(JSON.stringify({id,details_http:result.status})); continue; }
  const detail = (await result.json()).programmeInfo;
  console.log(JSON.stringify({id, name:detail?.name, membershipStatus:detail?.membershipStatus, status:detail?.status}));
}
