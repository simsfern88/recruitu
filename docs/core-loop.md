# RecruitU — Core Loop (v1)

> How the data model becomes something a student touches. This spec defines the
> student-facing flow: the one-time onboarding, the repeating per-job cycle, and
> the dashboard that ties them together. It pairs with `data-model.md`.

---

## Scope boundary

**The loop starts at capture. Job discovery is out of scope.** The student finds
and applies to jobs elsewhere (LinkedIn, Indeed, company sites) and brings the
job *in*. Discovery is fragile, competitive, expensive, and already owned by
incumbents; entering it would blow up scope and token costs for little
differentiation. RecruitU's value begins the moment a job is captured.

---

## Shape of the loop

- **Onboarding** — done once. Produces the master profile.
- **Dashboard** — home base. The list of all tracked jobs; returned to between
  jobs. This is the consolidation that a Claude-project workflow lacks.
- **Per-job cycle** — capture → score → tailor → prep → (mock, phase 2),
  repeated for each job, with outcome status updated alongside throughout.

**Not a wizard.** Because students routinely apply *before* prepping (the two
orthogonal dimensions in `data-model.md`), the per-job steps must be enterable in
any order, at any outcome stage, or skipped. The dashboard is the spine; the
steps are things you pick up whenever.

---

## 0. Onboarding — master profile (once)

| | |
|---|---|
| Student does | Uploads a CV. |
| System does | Extracts ~15 candidate roles and ~15 skills; offers to enhance the CV into a polished master version. |
| Data | Creates `Master Profile` (version 1). |
| Why it matters | Highest-friction, highest-drop moment. The instant extraction is the payoff that earns the friction — the "this gets me" moment. |
| Design decision | **Honesty line lives here.** Enhancement reframes and sharpens real accomplishments; it never invents. The student stays in control of every change — no silent rewrites. |

---

## Dashboard — home base

| | |
|---|---|
| Shows | Each tracked job as a row: company/role, outcome status, fit score, prep checklist, next action. |
| Data | Reads across all `Tracked Job` records for the user. |
| Why it matters | The single place showing the whole hunt — the core consolidation value. |

---

## 1. Capture a job

| | |
|---|---|
| Student does | Pastes text, drops a screenshot, or gives a URL. |
| System does | Parses the source into the job snapshot. |
| Data | Creates `Tracked Job` + job snapshot; stores `source_raw`. |
| Design decision | **URL is fragile; paste/screenshot is the reliable default.** URL is a convenience that degrades gracefully — if a scrape fails, fall back to "paste the text," never a dead error. `source_raw` is kept so a bad parse can be re-run later. |

## 2. Fit score

| | |
|---|---|
| Student does | Reviews the assessment. |
| System does | Scores the snapshot against the master profile. |
| Data | Writes the `fit assessment` + `scored_against_profile_version`. |
| Design decision | **Show the breakdown, never a bare number.** Requirements met / partial / gap, with gaps framed as "how to close or reframe." A low score directs effort toward a reach role — it never gatekeeps or says "don't apply." |

## 3. Tailor documents

| | |
|---|---|
| Student does | Sets interest, decides to pursue, reviews/edits output. |
| System does | Produces a role-specific CV and cover letter mirroring the posting's language. |
| Data | Creates versioned `Artifact`s (resume vN, cover letter); updates `prep_progress`. |
| Design decision | **Never fabricate; human stays in control.** Interest is student-set, independent of the fit score. Tailoring reframes real content and the student approves edits. |

## 4. Interview prep

| | |
|---|---|
| Student does | Studies the cheat sheet and Q&A pack. |
| System does | Generates a role/company cheat sheet and a likely-question pack with model answers. |
| Data | Creates `Artifact`s (cheat_sheet, question_pack); updates `prep_progress`. |
| Design decision | **Coach, don't script.** This is where the power-user-vs-student gap is widest: a raw Q&A list is enough for an expert, but a student needs to understand *why* an answer works, not memorize a script that makes them sound rehearsed. |

## 5. Mock interview (phase 2)

| | |
|---|---|
| Student does | Runs a voice mock; configures type, depth, difficulty. |
| System does | Conducts a realistic live interview and (later) feedback. |
| Data | Creates `Artifact`s (mock_session); updates `prep_progress`. |
| Status | **Deferred to phase 2** — most expensive and latency-sensitive; not needed to prove core value. Plugs in here, drawing on all prior artifacts. |

---

## Outcome tracking (runs throughout)

As real-world events happen (applied, recruiter call, rejection, offer), the
student updates the outcome status. Each change is appended to `status_events`
— the substrate for institutional analytics. This is not a step in the cycle; it
rides alongside every step.

---

## Phase boundaries

| In MVP | Deferred |
|---|---|
| Master profile + extraction | Voice mock interviews (phase 2) |
| Dashboard / tracker | Job discovery (out of scope) |
| Capture (paste/screenshot/URL) | Institution roster / SSO onboarding (companion spec) |
| Fit score with breakdown | Advisor & admin surfaces (built on the two-layer model) |
| Tailoring (CV + cover letter) | |
| Interview prep (cheat sheet + Q&A) | |
| Outcome tracking + event log | |
