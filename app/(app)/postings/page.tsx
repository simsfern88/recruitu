import { requireUser } from "@/lib/auth";
import { getProfile } from "@/lib/queries";
import { SuggestedRoles } from "@/components/suggested-roles";

const PLACEHOLDER_POSTINGS = [
  { title: "Sample posting", company: "—", location: "—" },
  { title: "Sample posting", company: "—", location: "—" },
  { title: "Sample posting", company: "—", location: "—" },
  { title: "Sample posting", company: "—", location: "—" },
];

/** Preview of a not-yet-built feature: match postings from a manually
 * uploaded database (career center CSV, etc. — no upload path exists yet)
 * against the roles/titles/competencies the profile is eligible for. Reuses
 * the real SuggestedRoles data as the actual matching criteria, so only the
 * postings side of this page is placeholder — the "what we'd match against"
 * side is real. */
export default async function PostingsPage() {
  const user = await requireUser();
  const profile = await getProfile(user.id);

  return (
    <div className="stack" style={{ gap: 20, maxWidth: 720 }}>
      <div>
        <p className="eyebrow">Postings</p>
        <h1>Job postings</h1>
        <p className="muted" style={{ margin: 0 }}>
          Once a postings database is uploaded, roles will show up here — automatically
          matched against the titles and competencies your profile is eligible for.
        </p>
      </div>

      <div className="card" style={{ borderColor: "var(--warn)" }}>
        <p style={{ margin: 0 }}>
          No postings database is connected yet. The list below previews the layout —
          it'll fill in with real, matched postings once one is uploaded.
        </p>
      </div>

      <SuggestedRoles roles={profile?.targetRoles ?? []} hasProfile={!!profile} />

      <div className="stack" style={{ gap: 12 }}>
        {PLACEHOLDER_POSTINGS.map((p, i) => (
          <div key={i} className="card row between wrap" style={{ gap: 12, opacity: 0.55 }}>
            <div>
              <h2 style={{ marginBottom: 4 }}>{p.title}</h2>
              <p className="muted" style={{ margin: 0 }}>
                {p.company} · {p.location}
              </p>
            </div>
            <div className="row" style={{ gap: 8, alignItems: "center" }}>
              <span className="tag">Match —</span>
              <button className="btn-quiet" disabled title="Postings matching isn't connected yet.">
                View match
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
