import { redirect } from "next/navigation";
import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";
import ProfileForm from "@/components/ProfileForm";
import FileManager from "@/components/FileManager";

// PAGE 4 — User profile: view and edit your details, and manage your files.
export const metadata = { title: "My Profile — FEELING FIND" };

function ProfileHeader({ signedIn }) {
  return (
    <div className="page-head">
      <div>
        <p className="eyebrow">Your account</p>
        <h1>My Profile</h1>
        {signedIn && <p className="muted">Keep your details up to date so we can find clothes that suit you.</p>}
      </div>
      <div className="page-head-actions">
        <Link className="discover-secondary" href="/discover">Edit shopping preferences <span aria-hidden="true">→</span></Link>
        {signedIn && (
          <form action={signOut}><button type="submit" className="btn btn-secondary">Sign out</button></form>
        )}
      </div>
    </div>
  );
}

export default async function ProfilePage() {
  const supabase = await createClient();

  // Demo mode (no Supabase yet): show the page with an empty form.
  if (!supabase) {
    return (
      <div className="container narrow">
        <ProfileHeader />
        <div className="alert alert-info" role="status">
          Demo mode: connect Supabase (see README) to create accounts and save your profile.
        </div>
        <div className="profile-grid">
          <ProfileForm profile={{}} email="you@example.com" demo />
          <FileManager initialFiles={[]} userId={null} demo />
        </div>
      </div>
    );
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/profile");

  // Row Level Security means these queries can only ever return this user's rows.
  const [{ data: profile }, { data: files }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("user_files").select("*").order("uploaded_at", { ascending: false }),
  ]);

  return (
    <div className="container narrow">
      <ProfileHeader signedIn />
      <div className="profile-grid">
        <ProfileForm profile={profile || {}} email={user.email} />
        <FileManager initialFiles={files || []} userId={user.id} />
      </div>
    </div>
  );
}
