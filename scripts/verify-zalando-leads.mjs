// Read-only checks of the 18 documented product URLs. No images, prices, or stock are copied.
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const source = await readFile(new URL('../ZALANDO_ADAPTIVE_RESEARCH.md', import.meta.url), 'utf8');
const urls = [...source.matchAll(/\]\((https:\/\/(?:en\.|www\.)?zalando\.de\/[^)]+\.html)\)/g)].map(m => m[1]);
if (urls.length !== 18 || new Set(urls).size !== 18) throw Error('Expected 18 unique documented product URLs.');
const results=[];
let rateLimited=false;
for (const url of urls) {
  const checkedAt=new Date().toISOString();
  if(rateLimited){results.push({url,checkedAt,status:'not_checked_rate_limited',verified:false});continue;}
  try {
    const response=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(15000)});
    if(response.status===429)rateLimited=true;
    if (!response.ok || !new URL(response.url).hostname.endsWith('.zalando.de')) { results.push({url,checkedAt,status:response.status,verified:false});continue; }
    const text=await response.text();
    const title=text.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.replaceAll('&amp;','&').trim() || null;
    const expected=url.match(/-([a-z0-9]{9}-[a-z0-9]{3})\.html$/i)?.[1]?.toUpperCase();
    const code=text.match(/"key":"(?:Article number|Artikelnummer)","value":"([^"]+)"/i)?.[1]?.toUpperCase();
    const features=text.match(/"key":"(?:Adaptive benefits|Adaptive Benefits|Adaptive Vorteile|Adaptive Eigenschaften)","value":"([^"]+)"/i)?.[1] || null;
    results.push({url,checkedAt,status:response.status,title,code,features,verified:!!title&&!!features&&!!expected&&code===expected});
  } catch(e){results.push({url,checkedAt,status:'error',error:e.name,verified:false});}
}
const out={checkedAt:new Date().toISOString(),results};
await mkdir(new URL('../artifacts/',import.meta.url),{recursive:true});
await writeFile(new URL('../artifacts/zalando-verification.json',import.meta.url),JSON.stringify(out,null,2));
for(const row of results) console.log(JSON.stringify(row));
