"use client";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updateProfile } from "@/app/auth/actions";

const GENDERS = ["Woman", "Man", "Non-binary", "Prefer to self-describe", "Prefer not to say"];
const NEEDS = [
  "Wheelchair user",
  "Limited hand movement",
  "Limited arm movement",
  "Prosthesis or limb difference",
  "Leg braces / orthoses",
  "Sensory sensitivity",
  "Low vision or blind",
  "Medical device (port, tube, pump)",
  "Chronic pain or fatigue",
  "Other",
];

function SaveButton({ demo }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn" disabled={pending || demo}>
      {pending ? "Saving…" : "Save changes"}
    </button>
  );
}

export default function ProfileForm({ profile, email, demo }) {
  const [state, action] = useActionState(updateProfile, null);
  const needs = profile.needs || [];

  return (
    <section className="card" aria-labelledby="details-heading">
      <div className="section-head">
        <h2 id="details-heading">My details</h2>
        <span className="muted">{email}</span>
      </div>
      <p className="muted">Everything here is private to your account.</p>

      {state?.error && <div className="alert alert-error" role="alert">{state.error}</div>}
      {state?.message && <div className="alert alert-success" role="status">{state.message}</div>}

      <form action={action}>
        <div className="field">
          <label htmlFor="full_name">Name</label>
          <input id="full_name" name="full_name" type="text" defaultValue={profile.full_name || ""} autoComplete="name" />
        </div>

        <div className="grid-2">
          <div className="field">
            <label htmlFor="gender">Gender</label>
            <select id="gender" name="gender" defaultValue={profile.gender || ""}>
              <option value="">Choose…</option>
              {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="age">Age</label>
            <input id="age" name="age" type="number" min="13" max="120" inputMode="numeric" defaultValue={profile.age ?? ""} />
          </div>
          <div className="field">
            <label htmlFor="city">City</label>
            <input id="city" name="city" type="text" defaultValue={profile.city || ""} autoComplete="address-level2" />
          </div>
          <div className="field">
            <label htmlFor="country">Country</label>
            <input id="country" name="country" type="text" defaultValue={profile.country || ""} autoComplete="country-name" />
          </div>
        </div>

        <fieldset className="field needs-fieldset">
          <legend>Disability or special needs</legend>
          <p className="hint">Tick anything that applies. This helps us suggest the right features.</p>
          <div className="checkbox-grid">
            {NEEDS.map((n) => (
              <label key={n} className="check">
                <input type="checkbox" name="needs" value={n} defaultChecked={needs.includes(n)} />
                {n}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="field">
          <label htmlFor="disability_info">Anything else we should know?</label>
          <textarea id="disability_info" name="disability_info" rows={3} maxLength={1000} defaultValue={profile.disability_info || ""}
            placeholder="In your own words, e.g. “I use a wheelchair and find buttons hard.”" />
        </div>

        <label className="check consent-check">
          <input type="checkbox" name="use_needs_in_chat" defaultChecked={!!profile.use_needs_in_chat} />
          Use my needs to personalise my search results
        </label>

        <SaveButton demo={demo} />
      </form>
    </section>
  );
}
