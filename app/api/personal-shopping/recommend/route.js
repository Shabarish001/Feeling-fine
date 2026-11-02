import { testUser, testDb, testFixtures, testCatalog, fixtureDb } from '@/lib/personal-shopping/e2e-store.mjs';
﻿import { graphRecommend } from '@/lib/personal-shopping/graph.mjs';
import { createClient } from '@/lib/supabase/server';
export async function POST(request) {
  try {
    const length = Number(request.headers.get('content-length') || 0);
    if (length > 16000) return Response.json({error:'Request is too large.'},{status:413});
    const text = await request.text();
    if (text.length > 16000) return Response.json({error:'Request is too large.'},{status:413});
    let input;
    try { input=JSON.parse(text); } catch { return Response.json({error:'Invalid JSON.'},{status:400}); }
    try { const test=testUser(request); const db=testCatalog(request)?fixtureDb(test):test?testDb(test):await createClient(); const {data}=test?{data:{user:{id:test}}}:db?await db.auth.getUser():{data:{user:null}}; const trace=process.env.E2E_GRAPH_TRACE==='1' && process.env.NODE_ENV!=='production'?[]:null; const result=await graphRecommend(input,{db,userId:data?.user?.id||null,trace,...(test?{fixtures:testFixtures}:{})}); if(trace) result._node_trace=trace; if(process.env.NODE_ENV!=='production'||process.env.PERSONAL_SHOPPING_DIAGNOSTICS==='1') console.info('[personal-shopping] recommend',JSON.stringify({mode:result.diagnostics?.mode,category:result.diagnostics?.category,available:result.diagnostics?.available,filters:result.diagnostics?.filters,eligible:result.diagnostics?.eligible,returned:result.diagnostics?.returned})); /* counts only, never profile values */ if(test) result._test_feedback_enabled=true; return Response.json(result, {headers:{'Cache-Control':'no-store'}}); }
    catch (err) { return Response.json({error:err.message},{status:400}); }
  } catch { return Response.json({error:'Unable to process request.'},{status:500}); }
}
