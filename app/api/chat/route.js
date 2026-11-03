import Anthropic from "@anthropic-ai/sdk";
import { searchPlaces } from "@/lib/places";
import { createClient } from "@/lib/supabase/server";

// POST /api/chat
// Body: { messages: [{ role: "user" | "assistant", content: "..." }] }
// Returns: { reply: "...", items: [...] }  — items are shown as pins on the map.

const MAX_MESSAGES = 20;
const MAX_CHARS = 2000;

// Words too generic to be useful as tags.
const TAG_STOP = new Set([
  "store", "shop", "in", "for", "the", "and", "with", "near", "berlin",
  "germany", "munich", "hamburg", "clothing", "clothes", "fashion", "buy",
  "find", "get", "that", "people", "person",
]);

// Turn a search query like "adaptive wheelchair friendly coat Berlin"
// into tags like ["adaptive", "wheelchair friendly", "coat"].
function extractQueryTags(query) {
  // Try to keep multi-word phrases that make sense together
  const phrases = [
    "wheelchair friendly", "one handed", "one-handed", "limited dexterity",
    "magnetic buttons", "magnetic closure", "easy dressing", "easy zip",
    "sensory friendly", "sensory-friendly", "low vision", "post surgery",
    "post-surgery", "chronic pain", "limb difference", "leg braces",
    "flat seams", "tag free", "tag-free", "velcro closure", "front closure",
    "back opening", "side zip", "pull loops", "wide opening", "hands free",
    "hands-free", "seated cut", "high contrast", "weighted", "adaptive",
    "orthopedic", "prosthetic", "medical device", "port access",
  ];
  const tags = [];
  const lowerQ = query.toLowerCase();

  // Extract known phrases first
  for (const phrase of phrases) {
    if (lowerQ.includes(phrase)) {
      tags.push(phrase.replace(/-/g, " "));
    }
  }

  // Add individual meaningful words
  const words = lowerQ.split(/[\s,/-]+/).filter((w) => w.length > 2 && !TAG_STOP.has(w));
  for (const word of words) {
    // Skip if already covered by a phrase
    if (!tags.some((t) => t.includes(word))) {
      tags.push(word);
    }
  }
  return tags.slice(0, 5);
}

// Convert Google Places types into human-readable tags.
const PLACE_TYPE_MAP = {
  clothing_store: "clothing store",
  shoe_store: "shoe store",
  department_store: "department store",
  shopping_mall: "shopping mall",
  physiotherapist: "physiotherapy",
  health: "health & wellness",
  hospital: "medical",
  pharmacy: "pharmacy",
  doctor: "medical",
  store: null, // too generic
  point_of_interest: null,
  establishment: null,
};

function placeTags(types) {
  if (!Array.isArray(types)) return [];
  return types
    .map((t) => PLACE_TYPE_MAP[t])
    .filter((t) => t != null)
    .slice(0, 2);
}

const SEARCH_TOOL = {
  name: "search_stores",
  description:
    "Search Google Maps for real shops and stores that sell adaptive clothing, shoes or accessories. " +
    "Use this whenever the user is looking for clothing or asks about shops. " +
    "Results include real store names, addresses, ratings, websites and map pins.",
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          "A Google Maps search query describing what the user needs, e.g. 'adaptive clothing store', " +
          "'wheelchair friendly clothing shop', 'magnetic button shirts', 'sensory friendly clothing'. " +
          "Be specific about the type of clothing or adaptive feature.",
      },
      location: {
        type: "string",
        description:
          "The city or area to search in, e.g. 'Berlin, Germany', 'Munich', 'Hamburg'. " +
          "Defaults to Berlin if not specified.",
      },
    },
    required: ["query"],
  },
};

function systemPrompt(profile) {
  let prompt = `You are the friendly assistant for FEELING FINE, a service that helps disabled people and their carers find adaptive clothing and the shops that sell it.

How to help:
- Use clear, warm, simple language. Short sentences. No jargon.
- Use the search_stores tool for any clothing request. This searches real Google Maps data for actual shops near the user.
- You may search more than once with different queries to find better results (e.g. first "adaptive clothing Berlin", then "wheelchair friendly fashion Berlin").
- Each result has a map number. Refer to stores as "#1", "#2" etc. so the user can find them on the map.
- Recommend 2-4 stores and explain in one line why each might have what they need.
- If a store has a website, mention it so the user can check stock before visiting.
- If nothing fits, say so honestly and suggest a different search query or city.
- Don't give medical advice. Respect the person's own words for their disability.
- Format: short paragraphs, with "- " bullets for store lists. **Bold** store names. No headings or tables.`;

  if (profile) {
    const parts = [
      profile.city && `City: ${profile.city}${profile.country ? ", " + profile.country : ""}`,
      profile.needs?.length && `Needs: ${profile.needs.join(", ")}`,
      profile.disability_info && `In their own words: ${profile.disability_info}`,
    ].filter(Boolean);
    if (parts.length) {
      prompt += `\n\nThe user has chosen to share this with you to personalise results:\n${parts.join("\n")}\nSearch in their city unless they ask otherwise.`;
    }
  }
  return prompt;
}

async function getConsentedProfile() {
  try {
    const supabase = await createClient();
    if (!supabase) return null;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
      .from("profiles")
      .select("city, country, needs, disability_info, use_needs_in_chat")
      .eq("id", user.id)
      .single();
    return data?.use_needs_in_chat ? data : data ? { city: data.city, country: data.country } : null;
  } catch {
    return null;
  }
}

function cleanMessages(raw) {
  if (!Array.isArray(raw)) return null;
  const msgs = raw
    .slice(-MAX_MESSAGES)
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }))
    .filter((m) => m.content.trim());
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  return msgs.length && msgs[msgs.length - 1].role === "user" ? msgs : null;
}

// Demo mode: no Anthropic API key — do a basic Places search from the user's message.
async function demoReply(messages) {
  const last = messages[messages.length - 1].content;
  const items = await searchPlaces({ query: `adaptive clothing ${last}`, location: "Berlin, Germany" });
  if (!items.length) {
    return {
      reply:
        "I couldn't find matching stores nearby. Try being more specific, like \"wheelchair clothing shop\" or \"sensory-friendly fashion\".\n\n(Demo mode: add your ANTHROPIC_API_KEY to .env.local to chat with Claude.)",
      items: [],
    };
  }
  const list = items.slice(0, 4).map((it, i) => `- **#${i + 1} ${it.name}** — ${it.address}`).join("\n");
  return {
    reply: `Here are some real stores I found on the map:\n\n${list}\n\n(Demo mode: add your ANTHROPIC_API_KEY to .env.local to chat with Claude.)`,
    items,
  };
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const messages = cleanMessages(body?.messages);
  if (!messages) return Response.json({ error: "Please type a message first." }, { status: 400 });

  if (!process.env.ANTHROPIC_API_KEY) return Response.json(await demoReply(messages));

  const client = new Anthropic();
  const profile = await getConsentedProfile();
  const found = []; // items in map order
  const queryTags = new Map(); // item id → Set of tags from search queries
  const convo = [...messages];

  try {
    let response;
    for (let step = 0; step < 4; step++) {
      response = await client.messages.create({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
        max_tokens: 1024,
        system: systemPrompt(profile),
        tools: [SEARCH_TOOL],
        messages: convo,
      });
      if (response.stop_reason !== "tool_use") break;

      const toolResults = [];
      for (const block of response.content) {
        if (block.type !== "tool_use") continue;
        const input = block.input || {};
        const query = typeof input.query === "string" ? input.query : "adaptive clothing";
        const location = typeof input.location === "string" ? input.location : "Berlin, Germany";

        // Extract meaningful tags from the search query
        const searchTags = extractQueryTags(query);

        const results = await searchPlaces({ query, location });
        const forClaude = results.map((item) => {
          let index = found.findIndex((f) => f.id === item.id);
          if (index === -1) {
            found.push(item);
            index = found.length - 1;
          }
          // Accumulate tags: search query keywords + Google place types
          if (!queryTags.has(item.id)) queryTags.set(item.id, new Set());
          const tags = queryTags.get(item.id);
          searchTags.forEach((t) => tags.add(t));
          placeTags(item.types).forEach((t) => tags.add(t));

          return {
            map_number: index + 1,
            name: item.name,
            address: item.address,
            rating: item.rating,
            review_count: item.review_count,
            website: item.website,
            phone: item.phone,
            description: item.description,
          };
        });
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(forClaude.length ? forClaude : { message: "No stores found for this search. Try different keywords." }),
        });
      }
      convo.push({ role: "assistant", content: response.content });
      convo.push({ role: "user", content: toolResults });
    }

    // Attach relevance tags to each item
    for (const item of found) {
      item.relevance_tags = [...(queryTags.get(item.id) || [])].slice(0, 6);
    }

    let reply = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    // Reorder items by relevance: stores Claude mentioned come first (in order
    // of mention), then unmentioned stores sorted by rating. Renumber everything
    // so the best matches are #1, #2, #3…
    if (found.length > 0) {
      const mentioned = [];
      const mentionedSet = new Set();
      // Extract #N references from Claude's reply in order
      for (const match of reply.matchAll(/#(\d+)/g)) {
        const idx = parseInt(match[1], 10) - 1;
        if (idx >= 0 && idx < found.length && !mentionedSet.has(idx)) {
          mentioned.push(idx);
          mentionedSet.add(idx);
        }
      }
      // Unmentioned items sorted by rating (highest first)
      const rest = found
        .map((item, i) => ({ item, i }))
        .filter(({ i }) => !mentionedSet.has(i))
        .sort((a, b) => (b.item.rating ?? 0) - (a.item.rating ?? 0))
        .map(({ i }) => i);

      const newOrder = [...mentioned, ...rest];
      const reordered = newOrder.map((oldIdx) => found[oldIdx]);

      // Build old→new number mapping and update Claude's reply
      const numberMap = {};
      newOrder.forEach((oldIdx, newIdx) => {
        numberMap[oldIdx + 1] = newIdx + 1;
      });
      reply = reply.replace(/#(\d+)/g, (match, num) => {
        const newNum = numberMap[parseInt(num, 10)];
        return newNum ? `#${newNum}` : match;
      });

      found.length = 0;
      found.push(...reordered);
    }

    return Response.json({ reply: reply || "Sorry, I didn't catch that. Could you say it another way?", items: found });
  } catch (err) {
    console.error("Claude API error:", err?.message);
    return Response.json(
      { error: "The assistant is having trouble right now. Please try again in a moment." },
      { status: 502 }
    );
  }
}
