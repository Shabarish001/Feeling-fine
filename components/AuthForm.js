"use client";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import FabricSculpture from "@/components/ui/FabricSculpture";
import { signIn, signUp } from "@/app/auth/actions";

function SubmitButton({ children }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn" disabled={pending} style={{ width: "100%" }}>
      {pending ? "Please wait…" : children}
    </button>
  );
}

export default function AuthForm({ mode, next, notice }) {
  const isSignUp = mode === "signup";
  const [state, action] = useActionState(isSignUp ? signUp : signIn, null);

  return (
    <div className="auth-wrap">
      <aside className="auth-art" aria-hidden="true">
        <p className="eyebrow">Feeling Find</p>
        <p className="auth-quote">Wear what<br /><em>feels right.</em></p>
        <FabricSculpture />
      </aside>
      <div className="card auth-card">
        <h1>{isSignUp ? "Create an Account" : "Sign In"}</h1>
        <p className="muted">
          {isSignUp
            ? "Save your needs and preferences so every search fits you better."
            : "Welcome back! Sign in to see your profile."}
        </p>

        {notice && <div className="alert alert-info" role="status">{notice}</div>}
        {state?.error && <div className="alert alert-error" role="alert">{state.error}</div>}
        {state?.message && <div className="alert alert-success" role="status">{state.message}</div>}

        <form action={action}>
          {next && <input type="hidden" name="next" value={next} />}
          {isSignUp && (
            <div className="field">
              <label htmlFor="full_name">Your name</label>
              <input id="full_name" name="full_name" type="text" autoComplete="name" required />
            </div>
          )}
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={isSignUp ? "new-password" : "current-password"}
              minLength={isSignUp ? 8 : undefined}
              required
              aria-describedby={isSignUp ? "pw-hint" : undefined}
            />
            {isSignUp && <p className="hint" id="pw-hint">At least 8 characters.</p>}
          </div>
          {isSignUp && (
            <div className="field">
              <label htmlFor="confirm">Type your password again</label>
              <input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
            </div>
          )}
          <SubmitButton>{isSignUp ? "Create my account" : "Sign In"}</SubmitButton>
        </form>

        <p className="auth-switch">
          {isSignUp ? (
            <>Already have an account? <Link href="/login">Sign In</Link></>
          ) : (
            <>New here? <Link href="/signup">Create an Account</Link></>
          )}
        </p>
      </div>
    </div>
  );
}
