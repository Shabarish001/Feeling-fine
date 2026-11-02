import { testUser, testRecord } from '@/lib/personal-shopping/e2e-store.mjs';
﻿import { createClient } from '@/lib/supabase/server';
import { validateSaveRequest } from '@/lib/personal-shopping/schema.mjs';
async function session() {
  const db=await createClient();
  if(!db) return null;
  const {data:{user}}=await db.auth.getUser();
  return user ? {db,user} : null;
}
const unauthorized=()=>Response.json({error:'Sign in to manage saved shopping preferences.'},{status:401,headers:{'Cache-Control':'no-store'}});
const failure=()=>Response.json({error:'Could not access saved preferences. Check that the personal shopping migration has been applied.'},{status:503,headers:{'Cache-Control':'no-store'}});
export async function GET(request) {
  const test=testUser(request); if(test) return Response.json({preferences:testRecord(test).preferences},{headers:{'Cache-Control':'no-store'}});
  const s=await session(); if(!s) return unauthorized();
  const {data,error}=await s.db.from('shopping_preferences').select('preferences,updated_at,consent_saved_at').eq('user_id',s.user.id).maybeSingle();
  return error ? failure() : Response.json({preferences:data?.preferences || null,updated_at:data?.updated_at || null},{headers:{'Cache-Control':'no-store'}});
}
export async function PUT(request) {
  const test=testUser(request); if(test) { try { const b=await request.json(); testRecord(test).preferences=validateSaveRequest(b); return Response.json({saved:true}); } catch { return Response.json({error:'Invalid request.'},{status:400}); } }
  const s=await session(); if(!s) return unauthorized();
  let body;
  try { const text=await request.text(); if(text.length>16000) return Response.json({error:'Request is too large.'},{status:413}); body=JSON.parse(text); } catch { return Response.json({error:'Invalid request.'},{status:400}); }
  let preferences; try { preferences=validateSaveRequest(body); } catch(e) { return Response.json({error:e.message},{status:400}); }
  const now=new Date().toISOString();
  const {error}=await s.db.from('shopping_preferences').upsert({user_id:s.user.id,preferences,updated_at:now,consent_saved_at:now});
  return error ? failure() : Response.json({saved:true},{headers:{'Cache-Control':'no-store'}});
}
export async function DELETE(request) {
  const test=testUser(request); if(test) {testRecord(test).preferences=null; return Response.json({deleted:true});}
  const s=await session(); if(!s) return unauthorized();
  const {error}=await s.db.from('shopping_preferences').delete().eq('user_id',s.user.id);
  return error ? failure() : Response.json({deleted:true},{headers:{'Cache-Control':'no-store'}});
}
