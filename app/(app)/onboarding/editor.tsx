"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { MasterProfile } from "@/db/schema";
import { createProfile } from "./actions";

export function ProfileEditor({ initial }: { initial: MasterProfile | null }) {
  const [state, action, pending] = useActionState(createProfile, {});
  const profile = initial;

  return (
    <>
      {profile && (
        <div className="card stack" style={{ gap: 18 }}>
          <div className="row between">
            <h2>Extracted from your CV</h2>
            <span className="tag">version {profile.version}</span>
          </div>

          {profile.summaryFacts && (
            <p className="muted" style={{ margin: 0 }}>
              {profile.summaryFacts.yearsExperience != null &&
                `${profile.summaryFacts.yearsExperience} yrs experience · `}
              {profile.summaryFacts.education?.join(", ")}
            </p>
          )}

          <Link className="btn btn-primary" href="/jobs/new" style={{ alignSelf: "flex-start" }}>
            Capture your first job →
          </Link>
        </div>
      )}

      <form action={action} className="card stack" style={{ gap: 16 }}>
        <h2>{profile ? "Update your CV" : "Add your CV"}</h2>
        <div className="field">
          <label htmlFor="cvText">Paste your CV</label>
          <textarea id="cvText" name="cvText" placeholder="Paste your full CV text here…" />
        </div>
        <div className="field">
          <label htmlFor="cvFile">…or upload a file (.txt, .md, or .pdf)</label>
          <input id="cvFile" name="cvFile" type="file" accept=".txt,.md,.markdown,.pdf" />
          <p className="hint">
            Extraction runs the moment you submit and fills in everything
            below — contact info, experience, education, skills. Nothing
            here is final: edit, add, or remove anything it missed or got
            wrong.{profile ? " Re-extracting replaces those sections with what's found in the new CV." : ""} A
            PDF also lets us pick up its accent color for your generated
            documents. No CV yet? Skip this and build your profile by hand
            below.
          </p>
        </div>

        {state?.error && <p className="error">{state.error}</p>}
        {state?.ok && <p className="hint" style={{ color: "var(--good)" }}>Saved — profile updated.</p>}

        <button className="btn btn-primary" type="submit" disabled={pending} style={{ alignSelf: "flex-start" }}>
          {pending ? "Reading your CV…" : profile ? "Re-extract" : "Extract my profile"}
        </button>
      </form>

      <div className="card stack" style={{ gap: 10 }}>
        <div>
          <p className="eyebrow">MyCareer integration</p>
          <h2 style={{ marginTop: 4 }}>Course & project skills</h2>
          <p className="muted" style={{ margin: 0 }}>
            Pull skills straight from courses and projects you've completed at the
            university, instead of re-typing them into Skills by hand.
          </p>
        </div>
        <div>
          <button
            className="btn btn-primary"
            disabled
            title="Requires a connection to your university's course and project records, which isn't set up yet."
          >
            Extract skills from completed courses and projects
          </button>
          <p className="hint" style={{ marginTop: 8 }}>
            Not connected yet — this needs access to your MyCareer course and project
            records. The button is here so it's ready the moment that connection exists;
            it won't invent course data in the meantime.
          </p>
        </div>
      </div>
    </>
  );
}
