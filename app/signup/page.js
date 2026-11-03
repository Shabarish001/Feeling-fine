import AuthForm from "@/components/AuthForm";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata = { title: "Create an Account — FEELING FINE" };

export default function SignUpPage() {
  const notice = isSupabaseConfigured ? null : "Demo mode: accounts switch on once Supabase is connected (see README).";
  return <AuthForm mode="signup" notice={notice} />;
}
