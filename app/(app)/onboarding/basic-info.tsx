"use client";

import { useActionState } from "react";
import { updateBasicInfo } from "./actions";

export function BasicInfoForm({ fullName }: { fullName: string | null }) {
  const [state, action, pending] = useActionState(updateBasicInfo, {});

  return (
    <form action={action} className="card stack" style={{ gap: 12 }}>
      <div>
        <p className="eyebrow">Basic information</p>
        <h2 style={{ marginTop: 4 }}>Your details</h2>
      </div>
      <div className="field">
        <label htmlFor="fullName">Full name</label>
        <input
          id="fullName"
          name="fullName"
          type="text"
          defaultValue={fullName ?? ""}
          placeholder="e.g. Jordan Rivera"
          required
        />
        <p className="hint">Used exactly as written on your tailored resumes and cover letters.</p>
      </div>

      {state?.error && <p className="error">{state.error}</p>}
      {state?.ok && <p className="hint" style={{ color: "var(--good)" }}>Saved.</p>}

      <button className="btn btn-primary" type="submit" disabled={pending} style={{ alignSelf: "flex-start" }}>
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
