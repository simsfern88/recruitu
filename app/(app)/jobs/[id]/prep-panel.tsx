"use client";

import { type ReactNode, useState, useTransition } from "react";
import type { Artifact } from "@/db/schema";
import type { CheatSheetContent, CoverLetterContent, QuestionPackContent } from "@/lib/anthropic";
import { Modal } from "@/components/modal";
import {
  generateCheatSheetArtifact,
  generateCoverLetterArtifact,
  generateQuestionPackArtifact,
} from "./artifacts-actions";
import { ResumeCard } from "./resume-card";

type Artifacts = Partial<Record<Artifact["type"], Artifact>>;
type Action = (jobId: string) => Promise<{ error?: string }>;

/** Cuts text at a word boundary near `max` chars — used to keep an inline
 * preview short without chopping a word in half. */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut) + "…";
}

/** One generate-able card: empty state with a button, or a short clickable
 * preview that opens the full content in a modal. Keeping the job page
 * itself to previews (rather than dumping a whole cover letter or 25
 * interview questions inline) is what keeps four of these scannable on one
 * page — the full content is one click away, not gone. */
function PrepCard({
  jobId,
  title,
  blurb,
  action,
  hasProfile,
  hasContent,
  downloadHref,
  generatingLabel,
  buttonLabel,
  preview,
  full,
}: {
  jobId: string;
  title: string;
  blurb: string;
  action: Action;
  hasProfile: boolean;
  hasContent: boolean;
  downloadHref?: string;
  generatingLabel: string;
  buttonLabel: string;
  preview: ReactNode;
  full: ReactNode;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const run = () =>
    start(async () => {
      setError(null);
      const res = await action(jobId);
      if (res?.error) setError(res.error);
    });

  return (
    <div className="card stack" style={{ gap: 12 }}>
      <div className="row between wrap" style={{ gap: 12 }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>{title}</h2>
          <p className="muted" style={{ margin: 0, maxWidth: 480 }}>{blurb}</p>
        </div>
        <div className="row" style={{ gap: 8, flexShrink: 0 }}>
          {hasContent && downloadHref && (
            <a href={downloadHref} className="btn btn-primary" download>
              Download PDF
            </a>
          )}
          {hasContent ? (
            <button onClick={run} disabled={pending} className="btn-quiet">
              {pending ? generatingLabel : "Regenerate"}
            </button>
          ) : (
            <button className="btn btn-primary" onClick={run} disabled={pending || !hasProfile}>
              {pending ? generatingLabel : buttonLabel}
            </button>
          )}
        </div>
      </div>
      {!hasProfile && !hasContent && (
        <p className="hint">Add your CV first to generate this.</p>
      )}
      {pending && <p className="hint">This can take a minute or two for the longer ones.</p>}
      {error && <p className="error">{error}</p>}

      {hasContent && (
        <button type="button" className="prep-preview-click" onClick={() => setOpen(true)}>
          {preview}
          <span className="view-full">View full {title.toLowerCase()} →</span>
        </button>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={title}>
        {full}
      </Modal>
    </div>
  );
}

function downloadUrl(jobId: string, artifact: Artifact | undefined): string | undefined {
  return artifact ? `/jobs/${jobId}/artifacts/${artifact.id}/download` : undefined;
}

export function PrepPanel({
  jobId,
  hasProfile,
  artifacts,
}: {
  jobId: string;
  hasProfile: boolean;
  artifacts: Artifacts;
}) {
  const coverLetter = artifacts.cover_letter?.content as CoverLetterContent | undefined;
  const cheatSheet = artifacts.cheat_sheet?.content as CheatSheetContent | undefined;
  const questionPack = artifacts.question_pack?.content as QuestionPackContent | undefined;

  const cheatSheetCounts = cheatSheet
    ? [
        cheatSheet.keyConcepts?.length ? `${cheatSheet.keyConcepts.length} key concepts` : null,
        cheatSheet.talkingPoints?.length ? `${cheatSheet.talkingPoints.length} talking points` : null,
        cheatSheet.questionsToAsk?.length ? `${cheatSheet.questionsToAsk.length} questions to ask` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  const cheatSheetFull = (
    <div className="stack" style={{ gap: 12 }}>
      {!!cheatSheet?.keyConcepts?.length && (
        <div>
          <p className="eyebrow" style={{ marginBottom: 6 }}>Key concepts</p>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {cheatSheet.keyConcepts.map((k, i) => <li key={i}>{k}</li>)}
          </ul>
        </div>
      )}
      {!!cheatSheet?.companyInsights?.length && (
        <div>
          <p className="eyebrow" style={{ marginBottom: 6 }}>Company insights</p>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {cheatSheet.companyInsights.map((k, i) => <li key={i} className="muted">{k}</li>)}
          </ul>
        </div>
      )}
      {!!cheatSheet?.productContext?.length && (
        <div>
          <p className="eyebrow" style={{ marginBottom: 6 }}>Product & market context</p>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {cheatSheet.productContext.map((k, i) => <li key={i} className="muted">{k}</li>)}
          </ul>
        </div>
      )}
      {!!cheatSheet?.cultureAndValues?.length && (
        <div>
          <p className="eyebrow" style={{ marginBottom: 6 }}>Culture & values</p>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {cheatSheet.cultureAndValues.map((k, i) => <li key={i} className="muted">{k}</li>)}
          </ul>
        </div>
      )}
      {!!cheatSheet?.talkingPoints?.length && (
        <div>
          <p className="eyebrow" style={{ marginBottom: 6 }}>Talking points</p>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {cheatSheet.talkingPoints.map((k, i) => <li key={i} className="muted">{k}</li>)}
          </ul>
        </div>
      )}
      {!!cheatSheet?.questionsToAsk?.length && (
        <div>
          <p className="eyebrow" style={{ marginBottom: 6 }}>Questions to ask</p>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {cheatSheet.questionsToAsk.map((k, i) => <li key={i} className="muted">{k}</li>)}
          </ul>
        </div>
      )}
    </div>
  );

  const questionPackFull = (
    <div className="stack" style={{ gap: 14 }}>
      {questionPack?.questions.map((q, i) => (
        <div key={i}>
          <div className="row" style={{ gap: 8, alignItems: "baseline" }}>
            <span className="tag" style={{ textTransform: "uppercase" }}>{q.category}</span>
            <strong>{q.question}</strong>
          </div>
          <p className="muted" style={{ marginTop: 4, marginBottom: 0 }}>{q.suggestedAnswer}</p>
        </div>
      ))}
    </div>
  );

  return (
    <div className="prep-grid">
      <div className="span-2">
        <ResumeCard
          jobId={jobId}
          hasProfile={hasProfile}
          artifact={artifacts.resume}
          downloadHref={downloadUrl(jobId, artifacts.resume)}
        />
      </div>

      <PrepCard
        jobId={jobId}
        title="Cover letter"
        blurb="A short letter grounded in your real experience, addressed to this specific role."
        action={generateCoverLetterArtifact}
        hasProfile={hasProfile}
        hasContent={!!coverLetter}
        downloadHref={downloadUrl(jobId, artifacts.cover_letter)}
        generatingLabel="Writing…"
        buttonLabel="Generate cover letter"
        preview={<p className="muted" style={{ margin: 0 }}>{truncate(coverLetter?.letter ?? "", 180)}</p>}
        full={<p className="muted" style={{ whiteSpace: "pre-wrap", margin: 0 }}>{coverLetter?.letter}</p>}
      />

      <PrepCard
        jobId={jobId}
        title="Cheat sheet"
        blurb="Key concepts, company & product context, culture signals, talking points, and questions to ask."
        action={generateCheatSheetArtifact}
        hasProfile={hasProfile}
        hasContent={!!cheatSheet}
        downloadHref={downloadUrl(jobId, artifacts.cheat_sheet)}
        generatingLabel="Building…"
        buttonLabel="Generate cheat sheet"
        preview={
          <div>
            {cheatSheet?.keyConcepts?.[0] && (
              <p className="muted" style={{ margin: "0 0 6px" }}>{truncate(cheatSheet.keyConcepts[0], 140)}</p>
            )}
            <p className="hint" style={{ margin: 0 }}>{cheatSheetCounts}</p>
          </div>
        }
        full={cheatSheetFull}
      />

      <div className="span-2">
        <PrepCard
          jobId={jobId}
          title="Interview Q&A pack"
          blurb="20-30 realistic questions for this role, each with an in-depth suggested answer grounded in your background."
          action={generateQuestionPackArtifact}
          hasProfile={hasProfile}
          hasContent={!!questionPack?.questions?.length}
          downloadHref={downloadUrl(jobId, artifacts.question_pack)}
          generatingLabel="Writing…"
          buttonLabel="Generate question pack"
          preview={
            <div>
              {questionPack?.questions?.[0] && (
                <p className="muted" style={{ margin: "0 0 6px" }}>
                  <strong>{questionPack.questions[0].question}</strong>
                </p>
              )}
              <p className="hint" style={{ margin: 0 }}>{questionPack?.questions?.length ?? 0} questions ready</p>
            </div>
          }
          full={questionPackFull}
        />
      </div>

      <div className="span-2">
        <div className="card stack" style={{ gap: 10 }}>
          <div>
            <p className="eyebrow">Coming soon</p>
            <h2 style={{ marginTop: 4, marginBottom: 4 }}>Mock interview</h2>
            <p className="muted" style={{ margin: 0, maxWidth: 560 }}>
              A voiced, simulated interview for this role — questions drawn from the
              job, its requirements, your master profile, and the Q&amp;A pack above.
              Answer out loud; get graded and critiqued at the end.
            </p>
          </div>
          <div>
            <button
              className="btn btn-primary"
              disabled
              title="Needs live voice infrastructure (speech-in, speech-out, and a grading pass) that isn't built yet."
            >
              Start mock interview (voice)
            </button>
            <p className="hint" style={{ marginTop: 8 }}>
              {questionPack?.questions?.length
                ? "Your Q&A pack is ready — mock interviews will draw their questions from it once voice is built."
                : "Generate the Q&A pack above first — mock interviews will draw their questions from it."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
