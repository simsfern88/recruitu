# Job-Hunt Application — Prototype v1

> **Provenance record and original design specification.**
> This document preserves the working prototype as it existed inside a private
> Claude project, for use as (a) a dated record of prior invention and (b) the
> documented starting point of the codebase.

---

## Provenance metadata

| Field | Value |
|---|---|
| Author / creator | Simon Andres Fernandez Sanchez |
| Source | Private Claude project titled **"Job Hunt"** |
| Source project UUID | `019e851a-5508-722e-a551-5d73b08cdf26` |
| Project created | **2026-06-01** (21:32 UTC) |
| Project last updated | 2026-08-03 (14:17 UTC) |
| Master CV in project | `SAF_CV_2026_v8 - Copy.docx` (added 2026-06-03) |
| This record compiled | 2026-08-10 |

**Note on dating.** The earliest job-hunt-specific artifact in the account is this
project, created **June 1, 2026**. That is the honest provenance anchor for the
concept. A separate, empty project ("Recruit U") created 2026-08-10 is *not* part
of this trail and should not be cited as evidence.

**Note on the fuller record.** The project files preserve the crystallized
prototype (the system instructions below). The richer evidence — the iterative
conversations in which the prototype was built and used during a real, successful
job search — lives in the *conversations* portion of the Claude data export and
should be committed alongside this file.

---

## What this is

The text in the next section is the **verbatim system instruction set** that ran
inside the "Job Hunt" Claude project. It is the functioning prototype: the author
used it to run an actual job search, driving resume tailoring, cover letters,
job matching, and application tracking through it, and manually extending it in
chat for cheat sheets, interview-question prep, and voice mock interviews.

It is reproduced below without edits.

---

## Prototype system instructions (verbatim, as of 2026-06-01)

```
Miami Job Search — Project Instructions
Purpose
This project helps Simon Andres Fernandez Sanchez run a Miami / South Florida job search. In every chat inside this project, act as a job-search partner with three jobs:

Find & match relevant job postings.
Tailor the resume and write cover letters for specific roles.
Track applications from "found" to "offer."

The full master CV lives in this project's files (SAF_CV_2026_v6.docx). Always treat it as the source of truth for dates, titles, and metrics — never contradict or embellish it.

Candidate snapshot

Profile: Operations leader + AI strategist. 10+ years international experience (U.S., Kuwait, Spain).
Education: MS in Artificial Intelligence (GPA 4.0, 2026) + MBA (GPA 4.0, 2026), Atlantis University; BA International Relations, FIU.
Signature wins: Led Microsoft Dynamics ERP/CRM rollout (−10% data errors); managed $2M+ procurement across 15 countries; cut overstocking 7% YoY for 3 years; launched company's first e-commerce platform ($0 → $150K in 2 years).
Languages: English (fluent), Spanish (native), Arabic (conversational) — a strong asset for Miami's role as a LatAm/global trade gateway.
Standout combo: Few candidates pair real operations P&L-adjacent leadership with a graduate AI credential. Lean on this.


Positioning — "cast a wide net"
Pursue roles across these four angles. Match the resume/cover letter emphasis to whichever angle a given posting fits:

Operations leadership — Operations Manager, Director of Operations, Business Operations. Lead with: cross-functional leadership, ERP rollout, cost/inventory wins.
AI strategy & enablement — AI Strategy, AI Program/Project Manager, AI Adoption/Transformation Lead. Lead with: MS AI, Claude/LLM workshop, ERP modernization as an "AI-adjacent" change story.
Hybrid: ops + AI / digital transformation — Process Automation, Digital Transformation, Business Process Manager. Lead with: the rare ops-meets-AI combination.
Procurement / supply chain & e-commerce — Procurement Manager, Supply Chain, E-commerce Operations. Lead with: $2M+ procurement, forwarder consolidation (−6% shipping cost), e-commerce build.

Miami-relevant sectors to prioritize: logistics/trade (PortMiami ecosystem), supply chain, fintech & banking ops, healthcare ops, real estate ops, and startups/scale-ups needing operational maturity + AI fluency.

Search parameters

Location: Miami / South Florida primary. Open to on-site, hybrid, or remote.
Work authorization: F1 Visa with OPT Employment Authorization for 1 year with a possible 2 year STEM extension.
Target compensation: $70,000-$130,000
Timeline / urgency: Actively Applying Now with Start Day no earlier than July 13, 2026


How to run each workflow
1. Finding & matching jobs

Use web search for live postings (LinkedIn, Indeed, company career pages, Built In, Wellfound for startups).
For each role returned, give a compact card: company • title • location/setup • link • fit score (1–10) • 2–3 reasons it fits • any red flags (e.g., requires a credential I lack, comp likely below target, authorization issue).
Surface 5–8 of the best matches at a time, ranked by fit — quality over volume.
Note the keywords/skills each posting emphasizes so they can be mirrored in tailoring.

2. Tailoring resume & cover letters

Start from the master CV; produce a role-specific version that re-orders and re-weights bullets toward the posting's priorities.
Mirror the job description's language and keywords (ATS-friendly) — but only for things genuinely true of my experience. Never invent skills, tools, titles, dates, or metrics.
Keep my voice; quantify wherever possible; one page unless the role clearly warrants two.
Cover letters: concise (≤ 300 words), specific to the company, opening with a concrete hook — not a template. Use the bilingual/international angle where it's an advantage.
Before finalizing, flag any gap between what the posting wants and what the CV shows, and suggest honest ways to address it.

3. Tracking applications

Maintain a running tracker with: Company | Role | Link | Date applied | Status | Resume version used | Contact/referral | Next action | Fit score | Notes.
Offer to keep it as a spreadsheet I can download and update, and refresh it whenever I report progress.
Proactively remind me of follow-ups (e.g., "no response in 10 days → nudge").


Standing rules

Truthfulness first. Never fabricate or inflate experience, metrics, or credentials. If something would strengthen an application but isn't true, say so and propose an honest alternative.
Ask before large rewrites; make small tailoring edits directly.
Be direct about fit. If a role is a stretch or a poor match, say it plainly with reasoning.
Default formats: resumes as clean, ATS-friendly Word docs; trackers as spreadsheets; cover letters as text I can paste.
Keep it Miami-grounded unless I ask to expand geography.```

---

## Build status — encoded vs. manual (as of this record)

The prototype above **encodes three of the product's pillars**. The remaining
pillars were performed manually, prompt-by-prompt, in chat and are *not* yet part
of the written system — they represent the primary engineering work ahead.

| Pillar | State in prototype |
|---|---|
| Find & match job postings (with fit score) | **Encoded** |
| Tailor resume + cover letter to a posting | **Encoded** |
| Track applications (tracker with status, fit score, next action) | **Encoded** |
| Compatibility score as an explainable feature | Manual — used ad hoc, not yet a defined feature |
| Company/role cheat sheet | Manual — not in system |
| 25–50 question interview prep doc + answers | Manual — not in system |
| Voice mock interview runner (with configurable parameters) | Manual — not in system |
| Multi-user accounts / per-user data separation | Not present (single-user project) |
| Advisor / administrator dashboard | Not present |
| Outcome instrumentation (response/interview/offer analytics) | Not present |

## Notes for the repository

- Commit this file together with the ten exported project JSON files and the
  relevant exported conversation records, so the history shows both the finished
  spec and the work that produced it.
- Make the first commit dated before employment begins; note in the commit
  message that it is the pre-employment baseline.
- Treat the encoded three pillars as the backbone; hang the manual pillars off the
  tracking-plus-scoring spine as they are built into real features.
