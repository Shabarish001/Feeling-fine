import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_URL, SUPABASE_KEY, isSupabaseConfigured } from "./config";

// Supabase client for Server Components, Server Actions and API routes.
// It reads the signed-in user's session from cookies, so every database call
// runs *as that user* and the Row Level Security rules in supabase/schema.sql apply.
export async function createClient() {
  if (!isSupabaseConfigured) return null;
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component: safe to ignore, proxy.js refreshes sessions.
        }
      },
    },
  });
}

// Returns the signed-in user, or null.
export async function getCurrentUser() {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data?.user ?? null;
}
