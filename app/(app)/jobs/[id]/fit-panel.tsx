"use client";

import { useState, useTransition } from "react";
import type { FitAssessment } from "@/db/schema";
import { FitScoreHero } from "@/components/dimensions";
import { scoreJob } from "./actions";

export function FitPanel({
  jobId,
  fit,
  hasProfile,
  stale,
}: {
  jobId: string;
  fit: FitAssessment | null;
  hasProfile: boolean;
  stale: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = () =>
    start(async () => {
      setError(null);
      const res = await scoreJob(jobId);
      if (res?.error) setError(res.error);
    });

  if (!fit) {
    return (
      <div className="card stack" style={{ gap: 12 }}>
        <div>
          <h2>Fit score</h2>
          <p className="muted" style={{ margin: 0 }}>
            See how you line up against this role — a full breakdown, not just a
            number. A low score points to a reach role and how to strengthen it;
            it never tells you not to apply.
          </p>
        </div>
        {!hasProfile && <p className="hint">Add your CV first to score fit.</p>}
        {error && <p className="error">{error}</p>}
        <button
          className="btn btn-primary"
          onClick={run}
          disabled={pending || !hasProfile}
          style={{ alignSelf: "flex-start" }}
        >
          {pending ? "Scoring…" : "Score this role"}
        </button>
      </div>
    );
  }

  return (
    <div className="card stack" style={{ gap: 18 }}>
      <div className="row between wrap" style={{ gap: 16 }}>
        <div>
          <h2>Fit score</h2>
          <p className="muted" style={{ margin: 0, maxWidth: 460 }}>{fit.headline}</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <FitScoreHero label={fit.matchLabel} score={fit.overallScore} />
          <button onClick={run} disabled={pending} className="btn-quiet">
            {pending ? "Scoring…" : "Rescore"}
          </button>
        </div>
      </div>

      {stale && (
        <p className="hint" style={{ color: "var(--warn)" }}>
          Your profile changed since this was scored.{" "}
          <button
            onClick={run}
            disabled={pending}
            style={{ background: "none", border: 0, color: "var(--accent-ink)", cursor: "pointer", font: "inherit", textDecoration: "underline" }}
          >
            Recompute
          </button>
        </p>
      )}

      <div>
        <p className="eyebrow" style={{ marginBottom: 4 }}>Requirement by requirement</p>
        {fit.breakdown.map((b, i) => (
          <div key={i} className="breakdown-item">
            <span className={`verdict-tag verdict-${b.verdict}`}>{b.verdict}</span>
            <div>
              <div className="breakdown-req">{b.requirement}</div>
              {b.evidence && <div className="breakdown-ev">{b.evidence}</div>}
            </div>
          </div>
        ))}
      </div>

      {fit.gaps.length > 0 && (
        <div className="stack" style={{ gap: 8 }}>
          <p className="eyebrow">How to close the gaps</p>
          {fit.gaps.map((g, i) => (
            <div key={i} className="gap-item">
              <div className="req">{g.requirement}</div>
              <div className="fix">{g.howToClose}</div>
            </div>
          ))}
        </div>
      )}

      {error && <p className="error">{error}</p>}
    </div>
  );
}
