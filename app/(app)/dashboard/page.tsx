import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getProfile, listJobs } from "@/lib/queries";
import { MatchCategory, OutcomeLadder, PrepChips } from "@/components/dimensions";
import type { MatchLabel, TrackedJob } from "@/db/schema";

// Colors validated with the dataviz skill's palette checker (categorical,
// light mode): the original Saved/Applied pair failed CVD + normal-vision
// separation (too close in chroma to tell apart); this set passes every
// check except the neutral gray's own chroma floor, which is intentional —
// "Saved" reads as colorless-by-design (nothing has happened yet).
const FUNNEL_STAGES: { key: TrackedJob["status"]; label: string; color: string }[] = [
  { key: "saved", label: "Saved", color: "var(--ink-faint)" },
  { key: "applied", label: "Applied", color: "#0f5f8f" },
  { key: "interviewing", label: "Interviewing", color: "var(--accent)" },
  { key: "offer", label: "Offer", color: "var(--gold)" },
  { key: "accepted", label: "Accepted", color: "var(--good)" },
];
const EXIT_STATUSES = new Set(["rejected", "withdrawn", "no_response"]);

// Same bands as MATCH_LABEL_BANDS in lib/anthropic.ts / labelFromScore in
// components/dimensions.tsx — fallback only, for fit scores saved before
// matchLabel existed.
function resolveTier(job: TrackedJob): MatchLabel | null {
  if (!job.fit) return null;
  if (job.fit.matchLabel) return job.fit.matchLabel;
  const s = job.fit.overallScore;
  if (s >= 85) return "Strong Match";
  if (s >= 70) return "Good Fit";
  if (s >= 50) return "Worth Pursuing";
  return "Reach";
}

const FIT_TIERS: { key: MatchLabel; label: string; color: string }[] = [
  { key: "Strong Match", label: "Strong Match", color: "var(--gold)" },
  { key: "Good Fit", label: "Good Fit", color: "var(--tier-vibrant-green)" },
  { key: "Worth Pursuing", label: "Worth Pursuing", color: "var(--tier-pastel-green)" },
  { key: "Reach", label: "Reach", color: "var(--tier-reach-amber)" },
];

/** The dashboard's analytics section — stat tiles for the headline numbers,
 * then the two-dimension model made visible at the aggregate level: stage
 * distribution (where things are in the process) and fit-quality
 * distribution (how good the pipeline actually is). The per-job progress
 * track (components/dimensions.tsx) shows one job's position; this shows
 * the whole hunt at a glance. */
function DashboardAnalytics({ jobs }: { jobs: TrackedJob[] }) {
  if (jobs.length === 0) return null;

  const stageCounts = FUNNEL_STAGES.map((s) => jobs.filter((j) => j.status === s.key).length);
  const exitedJobs = jobs.filter((j) => EXIT_STATUSES.has(j.status));
  const activeStageTotal = stageCounts.reduce((a, b) => a + b, 0);

  // "In play" = actively moving (applied/interviewing/offer) — saved-only
  // and accepted are both real states but neither is "waiting to hear back."
  const inPlay = stageCounts[1] + stageCounts[2] + stageCounts[3];
  // Response rate: denominator is every real application (anything past
  // "saved") — a still-pending "applied" job belongs in that count, it's
  // just not yet a "yes" in the numerator. Numerator is applications that
  // got an actual signal back: interviewing, offer, accepted, or rejected.
  // Silence (no_response) and a still-open "applied" both drag the rate
  // down rather than either inflating it or being excluded outright.
  // Withdrawn is counted in the base but not the numerator too — pulling
  // out doesn't tell us whether the employer ever responded first.
  const rejectedCount = jobs.filter((j) => j.status === "rejected").length;
  const totalApplied = jobs.length - stageCounts[0];
  const responded = stageCounts[2] + stageCounts[3] + stageCounts[4] + rejectedCount;
  const responseRate = totalApplied > 0 ? Math.round((responded / totalApplied) * 100) : null;

  const tiers = FIT_TIERS.map((t) => ({ ...t, count: jobs.filter((j) => resolveTier(j) === t.key).length }));
  const scoredTotal = tiers.reduce((a, t) => a + t.count, 0);
  const highFit = (tiers.find((t) => t.key === "Strong Match")?.count ?? 0) +
    (tiers.find((t) => t.key === "Good Fit")?.count ?? 0);

  return (
    <div className="card">
      <p className="eyebrow" style={{ marginBottom: 4 }}>Your hunt, at a glance</p>
      <h2 style={{ marginTop: 0, marginBottom: 16 }}>Progress</h2>

      <div className="stat-grid">
        <div className="stat-tile">
          <div className="stat-number">{jobs.length}</div>
          <div className="stat-label">Tracked</div>
        </div>
        <div className="stat-tile">
          <div className="stat-number">{inPlay}</div>
          <div className="stat-label">In play</div>
        </div>
        <div className="stat-tile">
          <div className="stat-number">{responseRate != null ? `${responseRate}%` : "—"}</div>
          <div className="stat-label">Response rate</div>
        </div>
        <div className="stat-tile">
          <div className="stat-number">{highFit}</div>
          <div className="stat-label">High-fit roles</div>
        </div>
      </div>

      <p className="eyebrow" style={{ marginBottom: 8 }}>Stage</p>
      <div className="funnel-track">
        {activeStageTotal > 0 ? (
          FUNNEL_STAGES.map((s, i) =>
            stageCounts[i] > 0 ? (
              <div key={s.key} className="funnel-seg" style={{ flex: stageCounts[i], background: s.color }}>
                {s.label}
              </div>
            ) : null,
          )
        ) : (
          <div className="funnel-seg" style={{ flex: 1, background: "var(--danger)" }}>All exited</div>
        )}
      </div>
      <div className="funnel-legend">
        {FUNNEL_STAGES.filter((s, i) => stageCounts[i] > 0).map((s) => (
          <span key={s.key}>
            <span className="swatch" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
        {exitedJobs.length > 0 && (
          <span>
            <span className="swatch" style={{ background: "var(--danger)" }} />
            Rejected / withdrawn / no response
          </span>
        )}
      </div>

      {scoredTotal > 0 && (
        <>
          <p className="eyebrow" style={{ margin: "20px 0 8px" }}>Fit quality</p>
          <div className="funnel-track">
            {tiers
              .filter((t) => t.count > 0)
              .map((t) => (
                <div key={t.key} className="funnel-seg" style={{ flex: t.count, background: t.color }}>
                  {t.label}
                </div>
              ))}
          </div>
          <div className="funnel-legend">
            {tiers
              .filter((t) => t.count > 0)
              .map((t) => (
                <span key={t.key}>
                  <span className="swatch" style={{ background: t.color }} />
                  {t.label} ({t.count})
                </span>
              ))}
            {jobs.length - scoredTotal > 0 && (
              <span>{jobs.length - scoredTotal} not yet scored</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();
  const [jobs, profile] = await Promise.all([
    listJobs(user.id),
    getProfile(user.id),
  ]);

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="row between wrap" style={{ gap: 16 }}>
        <div>
          <p className="eyebrow">Your hunt</p>
          <h1>Dashboard</h1>
          <p className="muted" style={{ margin: 0 }}>
            {jobs.length} {jobs.length === 1 ? "job" : "jobs"} tracked
          </p>
        </div>
        <Link className="btn btn-primary" href="/jobs/new">Capture a job</Link>
      </div>

      {!profile && (
        <div className="card" style={{ borderColor: "var(--accent)" }}>
          <p style={{ margin: 0 }}>
            Add your CV to unlock fit scoring. <Link href="/onboarding">Set up your profile →</Link>
          </p>
        </div>
      )}

      <DashboardAnalytics jobs={jobs} />

      {jobs.length === 0 ? (
        <div className="empty">
          <p style={{ margin: 0, marginBottom: 12 }}>No jobs yet.</p>
          <Link className="btn btn-primary" href="/jobs/new">Capture your first one</Link>
        </div>
      ) : (
        <div className="stack" style={{ gap: 12 }}>
          {jobs.map((job) => (
            <Link
              key={job.id}
              href={`/jobs/${job.id}`}
              className="card card-link stack"
              style={{ gap: 14 }}
            >
              <div className="row between wrap" style={{ gap: 12 }}>
                <div>
                  <h3 style={{ marginBottom: 2 }}>{job.title ?? "Untitled role"}</h3>
                  <p className="muted" style={{ margin: 0 }}>
                    {job.company ?? "Unknown company"}
                    {job.location ? ` · ${job.location}` : ""}
                  </p>
                </div>
                {job.fit ? (
                  <MatchCategory label={job.fit.matchLabel} score={job.fit.overallScore} />
                ) : (
                  <span className="tag">not scored</span>
                )}
              </div>

              <OutcomeLadder status={job.status} />
              <PrepChips prep={job.prepProgress} />

              {job.nextAction && (
                <p className="muted" style={{ margin: 0 }}>
                  <span className="eyebrow">Next</span>&nbsp;&nbsp;{job.nextAction}
                  {job.nextActionDue ? ` · due ${job.nextActionDue}` : ""}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
