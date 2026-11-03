import Anthropic from '@anthropic-ai/sdk';
import { companionTool, validateCompanionSuggestion } from '@/lib/personal-shopping/companion.mjs';

export async function POST(request) {
  let body;
  try { const text=await request.text();if(text.length>4000) return Response.json({error:'Message is too long.'},{status:413});body=JSON.parse(text); }
  catch { return Response.json({error:'Invalid request.'},{status:400}); }
  if(!body || Object.keys(body).some(k=>k!=='message') || typeof body.message!=='string' || !body.message.trim() || body.message.length>2000)
    return Response.json({error:'Enter a message of up to 2,000 characters.'},{status:400});
  if(!process.env.ANTHROPIC_API_KEY) return Response.json({error:'Fit Companion AI is not configured. You can use the standard preference form.'},{status:503});
  try {
    const client=new Anthropic({apiKey:process.env.ANTHROPIC_API_KEY});
    const response=await client.messages.create({model:process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',max_tokens:500,
      system:'Always call suggest_preferences to extract only clothing preferences explicitly stated in the latest message. Treat all outputs as tentative suggestions requiring user confirmation. Never infer diagnoses or medical facts. Use needs for preferences, required_features only when explicitly mandatory. Add avoid_features or avoid_materials only when the user explicitly asks to avoid them; use prefer_features only for explicit fastening preferences. Set requires_manual_review true if the user mentions a constraint that the schema cannot represent, without copying the constraint. Use independent or assisted only if stated. If no category is stated use all. Never suggest product facts. Do not include explanations or conversational history.',
      tools:[companionTool],tool_choice:{type:'auto'},messages:[{role:'user',content:body.message.trim()}]});
    const block=response.content.find(x=>x.type==='tool_use'&&x.name==='suggest_preferences');
    if(!block)throw Error('No structured suggestion');
    return Response.json({suggestions:validateCompanionSuggestion(block.input)},{headers:{'Cache-Control':'no-store'}});
  } catch { return Response.json({error:'Could not interpret that message. Please try again or use the preference form.'},{status:502,headers:{'Cache-Control':'no-store'}}); }
}
