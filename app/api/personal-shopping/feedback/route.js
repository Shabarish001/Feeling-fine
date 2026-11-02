import { testUser, testRecord } from '@/lib/personal-shopping/e2e-store.mjs';
import { createClient } from '@/lib/supabase/server';

const mapping={like:'helpful',dislike:'not_helpful',save:'saved',not_for_me:'dismissed'};
export async function POST(request) {
  const test=testUser(request); if(test) { let b; try {b=await request.json();} catch {return Response.json({error:'Invalid request.'},{status:400});} if(!/^sample-[a-z0-9]+$/.test(b.product_id||'') || !Object.hasOwn(mapping,b.action) || (b.action==='not_for_me' && (typeof b.reason!=='string'||!b.reason.trim()))) return Response.json({error:'Invalid feedback.'},{status:400}); testRecord(test).feedback.push({product_id:b.product_id,feedback_type:mapping[b.action]}); return Response.json({saved:true}); }
  const db=await createClient();
  const {data}=db?await db.auth.getUser():{data:{user:null}};
  if(!data?.user) return Response.json({error:'Sign in to save feedback.'},{status:401,headers:{'Cache-Control':'no-store'}});
  let body; try {const text=await request.text(); if(text.length>2000) return Response.json({error:'Request is too large.'},{status:413}); body=JSON.parse(text);}catch{return Response.json({error:'Invalid request.'},{status:400});}
  if(!body || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.product_id||'') || !Object.hasOwn(mapping,body.action) || (body.reason!==undefined && (typeof body.reason!=='string'||body.reason.length>500)) || (body.action==='not_for_me' && !body.reason?.trim())) return Response.json({error:'Invalid product or feedback.'},{status:400});
  const {error}=await db.from('product_feedback').insert({user_id:data.user.id,product_id:body.product_id,feedback_type:mapping[body.action],note:body.reason?.trim()||null});
  return error?Response.json({error:'Could not save feedback.'},{status:503,headers:{'Cache-Control':'no-store'}}):Response.json({saved:true},{headers:{'Cache-Control':'no-store'}});
}
