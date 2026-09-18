"use client";

import { useActionState } from "react";
import type { ProfileContact } from "@/db/schema";
import { saveContact } from "./actions";

export function ContactForm({ contact }: { contact: ProfileContact | null | undefined }) {
  const [state, action, pending] = useActionState(saveContact, {});

  return (
    <form action={action} className="card stack" style={{ gap: 12 }}>
      <div>
        <p className="eyebrow">Contact info</p>
        <h2 style={{ marginTop: 4 }}>How employers reach you</h2>
        <p className="muted" style={{ margin: 0 }}>Shown on your tailored resumes and cover letters.</p>
      </div>

      <div className="field-grid">
        <div className="field">
          <label htmlFor="email" className="compact">Email</label>
          <input id="email" name="email" type="email" defaultValue={contact?.email ?? ""} />
        </div>
        <div className="field">
          <label htmlFor="phone" className="compact">Phone</label>
          <input id="phone" name="phone" type="text" defaultValue={contact?.phone ?? ""} />
        </div>
        <div className="field">
          <label htmlFor="location" className="compact">Location</label>
          <input id="location" name="location" type="text" defaultValue={contact?.location ?? ""} placeholder="e.g. Austin, TX" />
        </div>
        <div className="field">
          <label htmlFor="links" className="compact">Links (one per line)</label>
          <textarea
            id="links"
            name="links"
            defaultValue={(contact?.links ?? []).join("\n")}
            placeholder="linkedin.com/in/you&#10;github.com/you"
            style={{ minHeight: 62 }}
          />
        </div>
      </div>

      {state?.error && <p className="error">{state.error}</p>}
      {state?.ok && <p className="hint" style={{ color: "var(--good)" }}>Saved.</p>}

      <button className="btn btn-primary" type="submit" disabled={pending} style={{ alignSelf: "flex-start" }}>
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
