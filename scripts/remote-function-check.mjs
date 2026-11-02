// READ-ONLY: lists RPC function names the remote PostgREST exposes (metadata only; calls nothing).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const res = await fetch(`${url}/rest/v1/`, { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/openapi+json' } });
console.log('status', res.status);
const spec = await res.json();
const rpc = Object.keys(spec.paths || {}).filter((p) => p.startsWith('/rpc/'));
console.log('exposed rpc functions:', rpc.length ? rpc : 'none');
console.log('exposed tables:', Object.keys(spec.paths || {}).filter((p) => !p.startsWith('/rpc/') && p !== '/').join(', '));
