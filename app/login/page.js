import AuthForm from "@/components/AuthForm";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata = { title: "Sign In — FEELING FIND" };

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  let notice = null;
  if (!isSupabaseConfigured) notice = "Demo mode: accounts switch on once Supabase is connected (see README).";
  else if (params?.error === "confirm") notice = "That confirmation link didn't work. Please try signing in, or create your account again.";
  else if (params?.next) notice = "Please sign in to see your profile.";
  return <AuthForm mode="login" next={params?.next} notice={notice} />;
}
