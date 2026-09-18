"use client";

import { useState, useTransition } from "react";
import type { Artifact } from "@/db/schema";
import type { ResumeContent } from "@/lib/anthropic";
import { RESUME_TEMPLATES, type ResumeTemplateId } from "@/lib/resume-templates";
import { Modal } from "@/components/modal";
import { generateResume } from "./artifacts-actions";

// Artifacts generated before the structured-resume rewrite saved the old
// flat-text shape ({ resume: string }) — handle both so old cards don't
// crash the page; they render as plain text until the user regenerates.
type ResumeArtifactContent =
  | (ResumeContent & { templateId?: ResumeTemplateId; resume?: undefined })
  | { resume: string };

/** Cuts text at a word boundary near `max` chars, for a short inline preview. */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut) + "…";
}

export function ResumeCard({
  jobId,
  hasProfile,
  artifact,
  downloadHref,
}: {
  jobId: string;
  hasProfile: boolean;
  artifact: Artifact | undefined;
  downloadHref?: string;
}) {
  const resume = artifact?.content as ResumeArtifactContent | undefined;
  const hasContent = !!resume;
  const savedTemplate =
    resume && !("resume" in resume) && resume.templateId ? resume.templateId : "classic";

  const [templateId, setTemplateId] = useState<ResumeTemplateId>(savedTemplate);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const run = () =>
    start(async () => {
      setError(null);
      const res = await generateResume(jobId, templateId);
      if (res?.error) setError(res.error);
    });

  return (
    <div className="card stack" style={{ gap: 12 }}>
      <div className="row between wrap" style={{ gap: 12 }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>Tailored resume</h2>
          <p className="muted" style={{ margin: 0, maxWidth: 480 }}>
            Reordered and reframed from your real background to match this role — never invented.
            Written for ATS keyword matching, not just to look good.
          </p>
        </div>
        {hasContent && downloadHref && (
          <a href={downloadHref} className="btn btn-primary" download style={{ flexShrink: 0 }}>
            Download PDF
          </a>
        )}
      </div>

      <div className="row wrap" style={{ gap: 14, alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div className="seg-group" role="radiogroup" aria-label="Resume template">
            {RESUME_TEMPLATES.map((t) => (
              <label key={t.id} htmlFor={`template-${jobId}-${t.id}`}>
                <input
                  type="radio"
                  id={`template-${jobId}-${t.id}`}
                  name={`template-${jobId}`}
                  checked={templateId === t.id}
                  onChange={() => setTemplateId(t.id)}
                  disabled={pending}
                />
                {t.label}
              </label>
            ))}
          </div>
          <p className="hint" style={{ margin: "6px 0 0" }}>
            {RESUME_TEMPLATES.find((t) => t.id === templateId)?.blurb}
          </p>
        </div>

        {hasContent ? (
          <button onClick={run} disabled={pending} className="btn-quiet">
            {pending ? "Writing…" : "Regenerate"}
          </button>
        ) : (
          <button className="btn btn-primary" onClick={run} disabled={pending || !hasProfile}>
            {pending ? "Writing…" : "Generate resume"}
          </button>
        )}
      </div>

      {!hasProfile && !hasContent && <p className="hint">Add your CV first to generate this.</p>}
      {pending && <p className="hint">This can take a minute or two.</p>}
      {error && <p className="error">{error}</p>}

      {hasContent && (
        <button type="button" className="prep-preview-click" onClick={() => setOpen(true)}>
          {resume && "resume" in resume ? (
            <p className="muted" style={{ margin: 0 }}>{truncate(resume.resume ?? "", 200)}</p>
          ) : resume ? (
            <div>
              <strong>{resume.name}</strong>
              {resume.headline && <div className="muted">{resume.headline}</div>}
              {resume.summary && (
                <p className="muted" style={{ margin: "6px 0 0" }}>{truncate(resume.summary, 160)}</p>
              )}
            </div>
          ) : null}
          <span className="view-full">View full resume →</span>
        </button>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Tailored resume">
        {resume && "resume" in resume && resume.resume && (
          <p className="muted" style={{ whiteSpace: "pre-wrap", margin: 0 }}>{resume.resume}</p>
        )}
        {resume && !("resume" in resume) && (
          <div className="stack" style={{ gap: 12 }}>
            <div>
              <strong>{resume.name}</strong>
              {resume.headline && <div className="muted">{resume.headline}</div>}
            </div>
            {resume.summary && <p className="muted" style={{ margin: 0 }}>{resume.summary}</p>}
            {resume.skills?.length > 0 && (
              <p className="muted" style={{ margin: 0 }}>{resume.skills.join(" • ")}</p>
            )}
            {resume.experience?.length > 0 && (
              <div className="stack" style={{ gap: 8 }}>
                {resume.experience.map((job, i) => (
                  <div key={i}>
                    <div>
                      <strong>{job.title}</strong> — {job.company}
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {job.bullets.map((b, j) => (
                        <li key={j} className="muted">{b}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
