import type { MatchLabel, PrepProgress } from "@/db/schema";

/**
 * Dimension A — outcome funnel, read-only summary use (the dashboard job
 * list). A filled progress track: how far along, not just which stage is
 * lit. The interactive version (click any stage to set it) lives in
 * app/(app)/jobs/[id]/status-control.tsx as a segmented pill row instead —
 * a track can't be clicked stage-by-stage the way a row of buttons can.
 */
const STAGES = ["saved", "applied", "interviewing", "offer", "accepted"] as const;
const EXITS = ["rejected", "withdrawn", "no_response"] as const;

export function OutcomeLadder({ status }: { status: string }) {
  const isExit = (EXITS as readonly string[]).includes(status);
  const currentIdx = STAGES.indexOf(status as (typeof STAGES)[number]);
  const pct = isExit ? 100 : ((currentIdx + 1) / STAGES.length) * 100;

  return (
    <div aria-label={`Outcome: ${status}`}>
      <div className="outcome-labels">
        {STAGES.map((s, i) => (
          <span key={s} className={!isExit && i === currentIdx ? "at" : undefined}>
            {s}
          </span>
        ))}
      </div>
      <div className="track">
        <div className={`track-fill${isExit ? " exit" : ""}`} style={{ width: `${pct}%` }} />
      </div>
      {isExit && (
        <div style={{ marginTop: 8 }}>
          <span className={`status-tag ${status}`}>{status.replace("_", " ")}</span>
        </div>
      )}
    </div>
  );
}

/**
 * Dimension B — prep as presence/absence chips, ANY order. Never a funnel:
 * these can be filled before or after applying, which is exactly why the two
 * dimensions are modeled separately.
 */
const PREP_LABELS: Record<keyof PrepProgress, string> = {
  scored: "scored",
  resume_tailored: "resume",
  cover_letter: "cover letter",
  cheat_sheet: "cheat sheet",
  question_pack: "Q&A pack",
  mock_interviews_run: "mock",
};

export function PrepChips({ prep }: { prep: PrepProgress }) {
  return (
    <div className="chips" aria-label="Prep progress">
      {(Object.keys(PREP_LABELS) as (keyof PrepProgress)[]).map((k) => (
        <span key={k} className={prep[k] ? "chip on" : "chip"}>
          {PREP_LABELS[k]}
        </span>
      ))}
    </div>
  );
}

/**
 * Fit score, as a radial dial — a number has to compete for attention on a
 * busy card; a partially-filled ring reads at a glance the way a battery
 * icon does. Percentage is drawn via stroke-dasharray/offset computed here;
 * globals.css only supplies the static ring styling.
 */
export function FitDial({
  score,
  color,
  size = 54,
  strokeWidth,
}: {
  score: number;
  color: string;
  size?: number;
  strokeWidth?: number;
}) {
  const sw = strokeWidth ?? (size >= 90 ? 9 : 5);
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = c * (1 - clamped / 100);
  const mid = size / 2;

  return (
    <div className="dial" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <circle className="dial-track" cx={mid} cy={mid} r={r} strokeWidth={sw} />
        <circle
          className="dial-value"
          cx={mid}
          cy={mid}
          r={r}
          strokeWidth={sw}
          style={{ stroke: color }}
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="dial-center">
        <div className="dial-num" style={{ fontSize: size * 0.32 }}>{score}</div>
        {size >= 90 && <div className="dial-of100" style={{ fontSize: size * 0.1 }}>/ 100</div>}
      </div>
    </div>
  );
}

/**
 * Fit score, led with the plain-language label — a bare "52/100" reads as a
 * failing grade regardless of how the number is calibrated; "Worth
 * Pursuing" carries the actual verdict on its own. The dial and the label
 * both encode the same tier so they never disagree.
 */
const MATCH_LABEL_CLASS: Record<MatchLabel, string> = {
  "Strong Match": "match-strong-match",
  "Good Fit": "match-good-fit",
  "Worth Pursuing": "match-worth-pursuing",
  Reach: "match-reach",
};

// Gold is reserved for exactly this moment — the one time the app
// celebrates a number — so it stays meaningful everywhere else. The rest of
// the scale runs amber (Reach) → pastel green → vibrant green, distinct
// from --warn/--danger so a low score never reads as an alarm.
const MATCH_DIAL_COLOR: Record<MatchLabel, string> = {
  "Strong Match": "var(--gold)",
  "Good Fit": "var(--tier-vibrant-green)",
  "Worth Pursuing": "var(--tier-pastel-green)",
  Reach: "var(--tier-reach-amber)",
};

// Same bands as MATCH_LABEL_BANDS in lib/anthropic.ts — fallback only, for
// fit scores saved before matchLabel existed. New scores always come with
// their own label from the model; this never runs for them.
function labelFromScore(score: number): MatchLabel {
  if (score >= 85) return "Strong Match";
  if (score >= 70) return "Good Fit";
  if (score >= 50) return "Worth Pursuing";
  return "Reach";
}

/** The bigger, standalone dial used on the job page's fit panel — dial
 * stacked over the label, centered, distinct from MatchBadge's inline
 * dial-beside-text layout (which suits a tight card row on the dashboard). */
export function FitScoreHero({
  label,
  score,
  size = 112,
}: {
  label: MatchLabel | null | undefined;
  score: number;
  size?: number;
}) {
  const resolved = label ?? labelFromScore(score);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <FitDial score={score} color={MATCH_DIAL_COLOR[resolved]} size={size} />
      <div className={`match-label ${MATCH_LABEL_CLASS[resolved]}`} style={{ textAlign: "center" }}>
        {resolved}
      </div>
    </div>
  );
}

/** Category-only fit read — no dial, no number. Used on the dashboard list
 * where scanning many jobs at once matters more than one score's precision;
 * see MatchBadge/FitScoreHero for where the number still earns its place. */
export function MatchCategory({
  label,
  score,
}: {
  label: MatchLabel | null | undefined;
  score: number;
}) {
  const resolved = label ?? labelFromScore(score);
  return <span className={`match-pill ${MATCH_LABEL_CLASS[resolved]}`}>{resolved}</span>;
}

export function MatchBadge({
  label,
  score,
  size = 54,
}: {
  label: MatchLabel | null | undefined;
  score: number;
  size?: number;
}) {
  const resolved = label ?? labelFromScore(score);
  return (
    <div className="dial-wrap">
      <FitDial score={score} color={MATCH_DIAL_COLOR[resolved]} size={size} />
      <div>
        <div className={`match-label ${MATCH_LABEL_CLASS[resolved]}`}>{resolved}</div>
        <span className="tag">{score} / 100</span>
      </div>
    </div>
  );
}
