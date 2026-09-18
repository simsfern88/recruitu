import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getJob, getLatestArtifacts, getProfile } from "@/lib/queries";
import { PrepChips } from "@/components/dimensions";
import { CompanyInfoEditor } from "./company-info-editor";
import { FitPanel } from "./fit-panel";
import { PrepPanel } from "./prep-panel";
import { StatusControl } from "./status-control";

export default async function JobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const [job, profile] = await Promise.all([
    getJob(user.id, id),
    getProfile(user.id),
  ]);
  if (!job) notFound();
  const artifacts = await getLatestArtifacts(user.id, id);

  // Staleness: the fit score is a function of job × profile, so when the
  // profile advances past the version it was scored against, we nudge a
  // recompute rather than showing a number that no longer means what it says.
  const stale =
    !!job.fit &&
    !!profile &&
    profile.version > job.fit.scoredAgainstProfileVersion;

  return (
    <div className="stack" style={{ gap: 24, maxWidth: 820 }}>
      <div>
        <Link href="/dashboard" className="back-link">
          ← Dashboard
        </Link>
        <h1 style={{ marginTop: 8 }}>{job.title ?? "Untitled role"}</h1>
        <p className="muted" style={{ margin: 0 }}>
          {job.company ?? "Unknown company"}
          {job.location ? ` · ${job.location}` : ""}
          {job.workMode ? ` · ${job.workMode}` : ""}
          {job.employmentType ? ` · ${job.employmentType.replace("_", "-")}` : ""}
          {job.companyUrl && (
            <>
              {" · "}
              <a href={job.companyUrl} target="_blank" rel="noopener noreferrer">
                company site ↗
              </a>
            </>
          )}
        </p>
      </div>

      <div className="stack" style={{ gap: 16 }}>
        {job.description && (
          <div className="card">
            <h2 style={{ marginBottom: 8 }}>About the role</h2>
            <p className="muted" style={{ whiteSpace: "pre-wrap", margin: 0 }}>
              {job.description}
            </p>
          </div>
        )}
        <div className="card">
          <h2 style={{ marginBottom: 8 }}>About the company</h2>
          {job.companyDescription ? (
            <p className="muted" style={{ whiteSpace: "pre-wrap", margin: 0 }}>
              {job.companyDescription}
            </p>
          ) : (
            <p className="hint" style={{ margin: 0 }}>No company info yet.</p>
          )}
          <CompanyInfoEditor
            jobId={job.id}
            companyUrl={job.companyUrl}
            companyDescription={job.companyDescription}
          />
        </div>
      </div>

      <div className="card stack" style={{ gap: 16 }}>
        <div>
          <p className="eyebrow" style={{ marginBottom: 8 }}>Outcome</p>
          <StatusControl jobId={job.id} status={job.status} />
        </div>
        <div>
          <p className="eyebrow" style={{ marginBottom: 8 }}>Prep</p>
          <PrepChips prep={job.prepProgress} />
        </div>
      </div>

      <FitPanel
        jobId={job.id}
        fit={job.fit}
        hasProfile={!!profile}
        stale={stale}
      />

      <PrepPanel jobId={job.id} hasProfile={!!profile} artifacts={artifacts} />

      {job.requirements && (
        <div className="card stack" style={{ gap: 12 }}>
          <h2>Requirements</h2>
          <div className="req-cols">
            {job.requirements.must_have.length > 0 && (
              <div>
                <p className="eyebrow" style={{ marginBottom: 6 }}>Must have</p>
                <ul>
                  {job.requirements.must_have.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
            {job.requirements.nice_to_have.length > 0 && (
              <div>
                <p className="eyebrow" style={{ marginBottom: 6 }}>Nice to have</p>
                <ul>
                  {job.requirements.nice_to_have.map((r, i) => (
                    <li key={i} className="muted">{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
