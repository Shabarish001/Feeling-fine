import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";
import NavLink from "./NavLink";

// Site header: logo on the left, links and the profile button on the right.
export default async function Header() {
  let user = null;
  let displayName = "";
  const supabase = await createClient();
  if (supabase) {
    const { data } = await supabase.auth.getUser();
    user = data?.user ?? null;
    if (user) {
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
      displayName = profile?.full_name || user.email || "";
    }
  }
  const initial = displayName.trim().charAt(0).toUpperCase();

  return (
    <header className="site-header">
      <div className="header-inner glass glass-regular">
        <Link href="/" className="brand" aria-label="FEELING FINE home">
          <img src="/logo.png" alt="" width="2172" height="724" />
        </Link>

        <nav className="main-nav" aria-label="Main">
          <NavLink href="/discover">Discover</NavLink>
          <NavLink href="/search">Stores</NavLink>
          <NavLink href="/about" className="hide-sm">About</NavLink>

          {user ? (
            <form action={signOut}>
              <button type="submit" className="link-button hide-sm">Sign Out</button>
            </form>
          ) : (
            <NavLink href="/signup" className="hide-sm">Create an Account</NavLink>
          )}

          <Link
            href={user ? "/profile" : "/login"}
            className="profile-button"
            aria-label={user ? "Edit my profile" : "Sign In"}
          >
            <span className="avatar" aria-hidden="true">
              {initial || (
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5z" /></svg>
              )}
            </span>
            {user ? "My Profile" : "Sign In"}
          </Link>
        </nav>
      </div>
    </header>
  );
}
