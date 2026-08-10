# RecruitU

A single place for job seekers to organize, tailor, and prepare their entire job
hunt — resume tailoring, cover letters, application tracking with an explainable
fit score, interview prep, and mock interviews.

**Status:** pre-development. This repository begins as a provenance record and the
documented v1 prototype; application code has not been written yet.

## What's here so far

| Path | What it is |
|---|---|
| `docs/PROTOTYPE_v1_2026-06-01.md` | The original working prototype (verbatim system spec) + build map. The starting point of the product. |
| `provenance/` | Dated evidence of prior invention. See its README. |

## Product pillars

Encoded in the v1 prototype:
- Find & match job postings (with a fit score)
- Tailor resume + cover letter to a specific posting
- Track applications from "found" to "offer"

To be built into real features:
- Explainable compatibility score
- Company/role cheat sheet
- Interview question-and-answer prep pack
- Voice mock-interview runner (configurable)
- Multi-user accounts with per-user data separation
- Advisor / administrator dashboard
- Outcome analytics (response / interview / offer funnel)

## Intended context

First pilot: a university career-services department. The individual job-seeker
experience is the center of gravity; the advisor/admin dashboard is what the
institution buys. Build with FERPA / data-privacy and accessibility in mind from
the start.

## Notes

- This is a **private** repository. It contains personal data and pre-release IP.
- Do not commit secrets (API keys, `.env` files). See `.gitignore`.
