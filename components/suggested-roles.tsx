"use client";

import { useState, useTransition } from "react";
import { updateTargetRoles } from "@/app/(app)/onboarding/actions";

/** Shared between the profile page and the job-capture page: the profile
 * page shows it as "here's what your profile currently supports," the
 * capture page shows it as "here's what to go look for" right before you
 * paste something in. Same data (profile.targetRoles), same refresh action
 * — suggestTargetRoles reasons over the WHOLE current profile (experience,
 * education, skills, certifications, licenses, languages), not just the
 * original CV text, so it stays current as the profile gets edited. */
export function SuggestedRoles({
  roles,
  hasProfile,
}: {
  roles: string[];
  hasProfile: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = () =>
    start(async () => {
      setError(null);
      const res = await updateTargetRoles();
      if (res?.error) setError(res.error);
    });

  return (
    <div className="card stack" style={{ gap: 12 }}>
      <div className="row between wrap" style={{ gap: 10 }}>
        <div>
          <p className="eyebrow">Career direction</p>
          <h2 style={{ marginTop: 4 }}>Suggested roles</h2>
          <p className="muted" style={{ margin: 0, maxWidth: 480 }}>
            Positions and titles you're eligible for or should be applying to, based on your
            whole profile — CV, experience, education, skills, languages, certifications, and
            licenses — not just your most recent title.
          </p>
        </div>
        <button onClick={run} disabled={pending || !hasProfile} className="btn-quiet">
          {pending ? "Updating…" : "Refresh suggestions"}
        </button>
      </div>

      {!hasProfile && (
        <p className="hint">Add your CV or build your profile first to get suggestions.</p>
      )}
      {error && <p className="error">{error}</p>}

      {hasProfile && roles.length > 0 && (
        <div className="chips">
          {roles.map((r) => (
            <span key={r} className="chip on">{r}</span>
          ))}
        </div>
      )}
      {hasProfile && roles.length === 0 && !pending && (
        <p className="hint">No suggestions yet — click refresh to generate some.</p>
      )}
    </div>
  );
}
