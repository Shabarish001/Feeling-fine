"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const NOT_SET_UP = { error: "Accounts aren't switched on yet. Add your Supabase keys to .env.local (see README)." };

function safeNext(value) {
  // Only allow redirects to pages on this site.
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/profile";
}

export async function signIn(_prev, formData) {
  const supabase = await createClient();
  if (!supabase) return NOT_SET_UP;
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email") || "").trim(),
    password: String(formData.get("password") || ""),
  });
  if (error) return { error: "That email and password don't match. Please try again." };
  revalidatePath("/", "layout");
  redirect(safeNext(formData.get("next")));
}

export async function signUp(_prev, formData) {
  const supabase = await createClient();
  if (!supabase) return NOT_SET_UP;
  const password = String(formData.get("password") || "");
  if (password.length < 8) return { error: "Your password needs at least 8 characters." };
  if (password !== formData.get("confirm")) return { error: "The two passwords don't match." };

  const { data, error } = await supabase.auth.signUp({
    email: String(formData.get("email") || "").trim(),
    password,
    options: {
      data: { full_name: String(formData.get("full_name") || "").trim() },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth/callback`,
    },
  });
  if (error) return { error: error.message };
  if (!data.session) {
    return { message: "Almost done! We've sent you an email. Click the link inside to confirm your account." };
  }
  revalidatePath("/", "layout");
  redirect("/profile");
}

export async function signOut() {
  const supabase = await createClient();
  if (supabase) await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function updateProfile(_prev, formData) {
  const supabase = await createClient();
  if (!supabase) return NOT_SET_UP;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in again." };

  const ageRaw = String(formData.get("age") || "").trim();
  const age = ageRaw ? Number(ageRaw) : null;
  if (age !== null && (!Number.isInteger(age) || age < 13 || age > 120)) {
    return { error: "Please enter an age between 13 and 120." };
  }
  const clip = (k, n = 100) => String(formData.get(k) || "").trim().slice(0, n) || null;

  const { error } = await supabase.from("profiles").upsert({
    id: user.id, // Row Level Security also checks this matches the signed-in user
    full_name: clip("full_name"),
    gender: clip("gender"),
    age,
    city: clip("city"),
    country: clip("country"),
    needs: formData.getAll("needs").map(String).slice(0, 20),
    disability_info: clip("disability_info", 1000),
    use_needs_in_chat: formData.get("use_needs_in_chat") === "on",
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: "We couldn't save your changes. Please try again." };
  revalidatePath("/profile");
  return { message: "Your profile is saved." };
}
