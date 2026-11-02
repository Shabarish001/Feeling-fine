import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// The link in the "confirm your email" message lands here.
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(`${origin}/profile`);
    }
  }
  return NextResponse.redirect(`${origin}/login?error=confirm`);
}
