import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type {
  FitAssessment,
  JobRequirements,
  MasterProfile,
  ProfileContact,
  ProfileEducationEntry,
  ProfileExperienceEntry,
  SummaryFacts,
  TrackedJob,
} from "@/db/schema";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Writing/judgment work (tailoring, scoring, cover letters) -> Sonnet 5,
// where quality is worth paying for. Mechanical extraction (reading a CV or
// a job posting into structured fields) -> Haiku 4.5, which is meaningfully
// cheaper and doesn't need Sonnet-level reasoning for that kind of task.
const MODEL = "claude-sonnet-5";
const MODEL_FAST = "claude-haiku-4-5";

/**
 * Force a single structured result out of the model via tool-use. We define one
 * tool with a JSON schema and require it, so we get validated-shape JSON back
 * instead of parsing prose. Returns the tool input as T.
 */
async function structured<T>(args: {
  system: string;
  content: Anthropic.MessageParam["content"];
  toolName: string;
  schema: Anthropic.Tool.InputSchema;
  maxTokens?: number;
  model?: string;
  // A large, non-streamed max_tokens request sits silent (zero bytes) for
  // however long the full generation takes — observed taking 60-90+s for
  // the question pack, right where a connection is most likely to time out
  // client-side or at a proxy in between. Streaming avoids that: the
  // connection stays active the whole time even though we still just wait
  // for the final assembled message. Anthropic's own guidance is to default
  // to streaming for anything with long output; set this for those calls.
  stream?: boolean;
}): Promise<T> {
  const params = {
    model: args.model ?? MODEL,
    max_tokens: args.maxTokens ?? 4096,
    system: args.system,
    tools: [
      {
        name: args.toolName,
        description: "Return the requested structured result.",
        input_schema: args.schema,
      },
    ],
    tool_choice: { type: "tool" as const, name: args.toolName },
    messages: [{ role: "user" as const, content: args.content }],
  };

  const res = args.stream
    ? await anthropic.messages.stream(params).finalMessage()
    : await anthropic.messages.create(params);

  // stop_reason "max_tokens" means the response was cut off mid-generation —
  // the most likely explanation when a large structured call comes back
  // missing fields it was told are required, so it's worth knowing which
  // one actually happened rather than guessing from the shape of the result.
  if (res.stop_reason === "max_tokens") {
    console.error(`structured(${args.toolName}): truncated at max_tokens (limit was ${args.maxTokens ?? 4096}).`);
  }

  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") {
    throw new Error("Model did not return a structured result.");
  }
  return block.input as T;
}

/* ------------------------------------------------------- profile extraction */

const HONESTY =
  "Only use facts actually present in the source. Never invent, inflate, or " +
  "assume experience, titles, dates, or skills that are not clearly stated.";

const COMPANY_RESEARCH_NOTE =
  "companyResearch, if present, is raw material scraped from the company's " +
  "own website — draw on specific, concrete details from it ONLY where " +
  "genuinely relevant to the task at hand. Don't force it in just because " +
  "it's there, and never let it override or contradict the job posting " +
  "itself.";

export type ExtractedProfile = {
  targetRoles: string[];
  extractedSkills: string[];
  summaryFacts: SummaryFacts;
  contact: ProfileContact;
  experience: Omit<ProfileExperienceEntry, "id">[];
  education: Omit<ProfileEducationEntry, "id">[];
  languages: string[];
  certifications: string[];
  licenses: string[];
};

/**
 * Onboarding: pull a full structured profile out of a CV — not just a rough
 * summary. contact/experience/education become the actual editable elements
 * on the profile (pre-filled here, hand-correctable after — see
 * app/(app)/onboarding/actions.ts), so this has to capture EVERY entry the
 * CV states, not a top-N sample.
 */
export async function extractProfile(cvText: string): Promise<ExtractedProfile> {
  return structured<ExtractedProfile>({
    system:
      "You extract a complete structured profile from a job-seeker's CV. " +
      HONESTY +
      " Extract EVERY work experience entry and EVERY education entry the CV " +
      "states — this feeds an editable profile the person will build tailored " +
      "resumes from, so missing an entry means it's simply gone until they " +
      "notice and re-add it by hand. Do not summarize or drop older/shorter " +
      "entries. For each experience entry, capture company, title, dates as " +
      "written, location if given, and each bullet/accomplishment as its own " +
      "array item (split a dense paragraph into separate bullets rather than " +
      "leaving it as one blob). contact fields (email, phone, location, and " +
      "links such as LinkedIn/GitHub/portfolio) come only from what's actually " +
      "printed in the CV — omit any field not present. targetRoles are " +
      "realistic target job titles this person could apply to based on their " +
      "demonstrated experience. extractedSkills are drawn from the CV, not a " +
      "generic list. languages are spoken/written languages stated (with " +
      "proficiency if given, e.g. 'Spanish (fluent)'). certifications are " +
      "professional certifications (e.g. 'AWS Certified Solutions Architect, " +
      "2023'). licenses are professional/regulatory licenses (e.g. 'RN " +
      "License, State of Texas'). Don't invent items for languages, " +
      "certifications, or licenses — leave the list empty if the CV doesn't " +
      "state any. Aim for up to ~15 target roles and ~20 skills; fewer is " +
      "fine if the CV is thin.",
    content: `CV text:\n\n${cvText}`,
    model: MODEL_FAST,
    maxTokens: 4096,
    toolName: "record_profile",
    schema: {
      type: "object",
      properties: {
        targetRoles: { type: "array", items: { type: "string" }, maxItems: 20 },
        extractedSkills: { type: "array", items: { type: "string" }, maxItems: 25 },
        summaryFacts: {
          type: "object",
          properties: {
            yearsExperience: { type: "number" },
            education: { type: "array", items: { type: "string" } },
            certifications: { type: "array", items: { type: "string" } },
            locations: { type: "array", items: { type: "string" } },
          },
        },
        contact: {
          type: "object",
          properties: {
            email: { type: "string" },
            phone: { type: "string" },
            location: { type: "string" },
            links: { type: "array", items: { type: "string" } },
          },
        },
        experience: {
          type: "array",
          items: {
            type: "object",
            properties: {
              company: { type: "string" },
              title: { type: "string" },
              dates: { type: "string" },
              location: { type: "string" },
              bullets: { type: "array", items: { type: "string" } },
            },
            required: ["company", "title", "bullets"],
          },
        },
        education: {
          type: "array",
          items: {
            type: "object",
            properties: {
              school: { type: "string" },
              credential: { type: "string" },
              dates: { type: "string" },
              details: { type: "string" },
            },
            required: ["school"],
          },
        },
        languages: { type: "array", items: { type: "string" }, maxItems: 12 },
        certifications: { type: "array", items: { type: "string" }, maxItems: 15 },
        licenses: { type: "array", items: { type: "string" }, maxItems: 10 },
      },
      required: [
        "targetRoles",
        "extractedSkills",
        "summaryFacts",
        "contact",
        "experience",
        "education",
        "languages",
        "certifications",
        "licenses",
      ],
    },
  });
}

/**
 * Re-derives target roles from the CURRENT structured profile — not the raw
 * CV text extractProfile ran once at upload time. Since experience/education/
 * skills are hand-editable after extraction (see the onboarding editors),
 * targetRoles can drift out of date as the person edits; this recomputes it
 * from whatever the profile actually says right now.
 */
export type SuggestedRoles = { targetRoles: string[] };

export async function suggestTargetRoles(profile: MasterProfile): Promise<SuggestedRoles> {
  return structured<SuggestedRoles>({
    system:
      "You determine realistic job titles/roles a candidate should apply to " +
      "or is eligible for, based on their FULL current profile — every " +
      "experience entry, education entry, skill, certification, license, " +
      "and language given, not just their most recent title. " +
      HONESTY +
      " Every role must be genuinely justified by the profile — don't " +
      "suggest a role that requires a qualification, seniority level, or " +
      "domain the candidate has no evidence of. Include a realistic spread: " +
      "roles that match their current level and, only where the trajectory " +
      "genuinely supports it, a couple of reasonable next-step roles — never " +
      "a stretch that isn't backed by the profile. Order by relevance, most " +
      "relevant first. Aim for up to ~15; fewer is fine if the profile is thin.",
    content: JSON.stringify({
      experience: profile.experience,
      education: profile.education,
      skills: profile.extractedSkills,
      certifications: profile.certifications,
      licenses: profile.licenses,
      languages: profile.languages,
      summaryFacts: profile.summaryFacts,
    }),
    model: MODEL_FAST,
    toolName: "record_target_roles",
    schema: {
      type: "object",
      properties: {
        targetRoles: { type: "array", items: { type: "string" }, maxItems: 20 },
      },
      required: ["targetRoles"],
    },
  });
}

/* -------------------------------------------------------------- job parsing */

export type ParsedJob = {
  company?: string;
  title?: string;
  location?: string;
  workMode?: "onsite" | "hybrid" | "remote";
  employmentType?: "full_time" | "contract" | "internship";
  compRange?: string;
  deadline?: string; // ISO date
  description?: string;
  companyDescription?: string;
  requirements: JobRequirements;
  keywords: string[];
};

const JOB_SCHEMA: Anthropic.Tool.InputSchema = {
  type: "object",
  properties: {
    company: { type: "string" },
    title: { type: "string" },
    location: { type: "string" },
    workMode: { type: "string", enum: ["onsite", "hybrid", "remote"] },
    employmentType: {
      type: "string",
      enum: ["full_time", "contract", "internship"],
    },
    compRange: { type: "string" },
    deadline: { type: "string", description: "ISO date if stated, else omit" },
    description: {
      type: "string",
      description: "cleaned description of the role itself: duties, day-to-day, what the job is",
    },
    companyDescription: {
      type: "string",
      description: "cleaned description of the company: mission, product, culture — not the role",
    },
    requirements: {
      type: "object",
      properties: {
        must_have: { type: "array", items: { type: "string" } },
        nice_to_have: { type: "array", items: { type: "string" } },
      },
      required: ["must_have", "nice_to_have"],
    },
    keywords: {
      type: "array",
      items: { type: "string" },
      description: "ATS keywords for mirroring + scoring",
    },
  },
  required: ["requirements", "keywords"],
};

const JOB_SYSTEM =
  "You parse a raw job posting into a clean snapshot. " +
  HONESTY +
  " Omit any field the posting does not state rather than guessing — leave " +
  "it out of the tool call entirely. Never fill a field with a placeholder " +
  "like '<UNKNOWN>', 'N/A', 'unknown', or 'unspecified' — an omitted field " +
  "and a placeholder string are not the same thing to the code reading this, " +
  "so a placeholder will break things a true omission won't. This matters " +
  "most for workMode and employmentType, which only accept their exact " +
  "listed enum values or nothing at all. Split " +
  "requirements into genuine must-haves vs nice-to-haves. Keywords are the " +
  "terms an applicant-tracking system would scan for. Keep the role " +
  "description and the company description strictly separate: description " +
  "is what the job itself involves (duties, day-to-day, responsibilities); " +
  "companyDescription is about the employer (mission, product, culture, " +
  "size, industry) with no role duties in it. If material scraped from the " +
  "company's own website is provided, use it to make companyDescription " +
  "richer and more accurate — " +
  COMPANY_RESEARCH_NOTE;

const withCompanyResearch = (raw: string, companyResearch?: string) =>
  companyResearch
    ? `Job posting source:\n\n${raw}\n\n---\n\nMaterial scraped from the company's own website (see the rules on companyResearch above):\n\n${companyResearch}`
    : `Job posting source:\n\n${raw}`;

/** Capture from pasted text or a scraped URL body. `companyResearch`, if
 * given, is a scrape of the company's own site (see jobs/new/actions.ts). */
export async function parseJobText(
  raw: string,
  companyResearch?: string,
): Promise<ParsedJob> {
  return structured<ParsedJob>({
    system: JOB_SYSTEM,
    content: withCompanyResearch(raw, companyResearch),
    model: MODEL_FAST,
    toolName: "record_job",
    schema: JOB_SCHEMA,
  });
}

/** Capture from a screenshot: the image does OCR + parse in one step. */
export async function parseJobImage(
  imageBase64: string,
  mediaType: "image/png" | "image/jpeg" | "image/webp",
  companyResearch?: string,
): Promise<ParsedJob> {
  return structured<ParsedJob>({
    system: JOB_SYSTEM,
    content: [
      {
        type: "image",
        source: { type: "base64", media_type: mediaType, data: imageBase64 },
      },
      {
        type: "text",
        text: companyResearch
          ? `Parse this job posting screenshot.\n\n---\n\nMaterial scraped from the company's own website (see the rules on companyResearch above):\n\n${companyResearch}`
          : "Parse this job posting screenshot.",
      },
    ],
    model: MODEL_FAST,
    toolName: "record_job",
    schema: JOB_SCHEMA,
  });
}

/**
 * Re-derives just the "About the company" text from fresh material — a
 * re-scraped URL, pasted text, or anything else the person supplies after
 * capture — without touching the role's own parsed fields. Used by the job
 * page's manual company-info refresh (app/(app)/jobs/[id]/company-actions.ts),
 * not by initial capture (that still runs companyDescription through
 * parseJobText/parseJobImage alongside everything else).
 */
export async function summarizeCompany(
  companyMaterial: string,
  job: Pick<TrackedJob, "title" | "company">,
): Promise<string> {
  const result = await structured<{ companyDescription: string }>({
    system:
      "You write a clean 'About the company' summary from raw source " +
      "material (scraped from the company's own site, or pasted in by the " +
      "job-seeker). " +
      HONESTY +
      " Cover mission, product, culture, size, and industry — never role " +
      "duties or requirements, those belong to the job posting, not this. " +
      "If the material is thin, write a shorter, honest summary rather than " +
      "padding it with generic filler about the industry in general.",
    content: JSON.stringify({
      companyMaterial,
      roleContext: { title: job.title, company: job.company },
    }),
    model: MODEL_FAST,
    toolName: "record_company_description",
    schema: {
      type: "object",
      properties: {
        companyDescription: { type: "string" },
      },
      required: ["companyDescription"],
    },
  });
  return result.companyDescription;
}

/* --------------------------------------------------------------- fit scoring */

// The score and label are assigned together, in the same pass, so they can
// never contradict each other — see the system prompt below for the full
// calibration rules these bands are tied to.
const MATCH_LABEL_BANDS =
  "85-100 = Strong Match (meets essentially every must-have, strong overlap " +
  "on nice-to-haves). 70-84 = Good Fit (meets all or nearly all must-haves, " +
  "gaps are mostly on nice-to-haves). 50-69 = Worth Pursuing (meets most " +
  "must-haves but has a real gap or two worth addressing). 0-49 = Reach " +
  "(missing multiple must-haves).";

/**
 * Score a job snapshot against the master profile. The output is deliberately a
 * STRUCTURE, never a bare number: a breakdown per requirement plus gaps framed
 * as how-to-close/reframe. A low score points effort at a reach role; it must
 * never gatekeep or tell the person not to apply.
 */
export async function scoreFit(
  job: TrackedJob,
  profile: MasterProfile,
): Promise<FitAssessment> {
  const result = await structured<{
    overallScore: number;
    matchLabel: FitAssessment["matchLabel"];
    headline: string;
    breakdown: FitAssessment["breakdown"];
    gaps: FitAssessment["gaps"];
  }>({
    system:
      "You assess fit between a candidate and a role for a job-seeker's own " +
      "planning. " +
      HONESTY +
      " Judge each requirement against the profile as met / partial / gap / " +
      "unknown, with brief evidence from the profile. For every gap, give a " +
      "concrete way to close or reframe it. Tone is a supportive coach: the " +
      "score directs where to spend effort, it NEVER discourages applying and " +
      "you must never say or imply 'do not apply'. " +
      // Calibration: this is the fix for scores reading as harsher than the
      // actual match. Two rules that matter most: must-haves dominate the
      // score, and an unconfirmed requirement is NOT the same as a missing
      // one — most CVs simply don't mention every possible skill.
      "Weight must-have requirements far more heavily than nice-to-haves — " +
      "nice-to-have gaps should trim a few points, not tank the score. " +
      "'unknown' means the profile is silent on it, not that the candidate " +
      "lacks it — treat unknown as close to neutral, NOT the same as a gap; " +
      "only score it like a gap if the requirement is clearly central to the " +
      "role. Do not average verdicts mechanically (e.g. treat 4 of 5 " +
      "must-haves met as merely '80%') — a candidate who meets essentially " +
      "every must-have is a strong match even with one or two nice-to-have " +
      "gaps, and should score accordingly. " +
      MATCH_LABEL_BANDS +
      " Assign matchLabel from the SAME judgment as overallScore — they must " +
      "agree with each other. overallScore is 0–100. " +
      COMPANY_RESEARCH_NOTE,
    content: JSON.stringify({
      role: {
        title: job.title,
        company: job.company,
        requirements: job.requirements,
        keywords: job.keywords,
        description: job.description,
        companyDescription: job.companyDescription,
        companyResearch: job.companyResearch,
      },
      candidate: {
        targetRoles: profile.targetRoles,
        skills: profile.extractedSkills,
        summary: profile.summaryFacts,
      },
    }),
    toolName: "record_fit",
    schema: {
      type: "object",
      properties: {
        overallScore: { type: "number", minimum: 0, maximum: 100 },
        matchLabel: {
          type: "string",
          enum: ["Strong Match", "Good Fit", "Worth Pursuing", "Reach"],
        },
        headline: { type: "string" },
        breakdown: {
          type: "array",
          items: {
            type: "object",
            properties: {
              requirement: { type: "string" },
              verdict: {
                type: "string",
                enum: ["met", "partial", "gap", "unknown"],
              },
              evidence: { type: "string" },
            },
            required: ["requirement", "verdict"],
          },
        },
        gaps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              requirement: { type: "string" },
              howToClose: { type: "string" },
            },
            required: ["requirement", "howToClose"],
          },
        },
      },
      required: ["overallScore", "matchLabel", "headline", "breakdown", "gaps"],
    },
  });

  return {
    ...result,
    scoredAgainstProfileVersion: profile.version,
    scoredAt: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------- tailoring */

const candidateContext = (
  cvText: string,
  profile: MasterProfile,
  displayName: string | null,
) => ({
  // The account's on-file name — authoritative. Use it verbatim for any
  // header/signature; do not substitute a name pulled from the CV text.
  candidateName: displayName,
  // The profile's own structured, user-edited elements — this is the
  // authoritative source for experience/education/contact (the person has
  // seen and corrected these), NOT a re-parse of the raw CV on every call.
  candidateContact: profile.contact,
  candidateExperience: profile.experience,
  candidateEducation: profile.education,
  candidateLanguages: profile.languages,
  candidateCertifications: profile.certifications,
  candidateLicenses: profile.licenses,
  // Supplementary only — for phrasing/detail not yet captured in the
  // structured fields above. Never let it override or contradict them.
  candidateCv: cvText || "(no full CV text on file — use the structured fields above only)",
  candidateSummary: {
    targetRoles: profile.targetRoles,
    skills: profile.extractedSkills,
    summary: profile.summaryFacts,
  },
});

const STRUCTURED_PROFILE_NOTE =
  "candidateExperience, candidateEducation, candidateContact, " +
  "candidateLanguages, candidateCertifications, and candidateLicenses are " +
  "the candidate's own structured, hand-reviewed profile data — treat these " +
  "as the authoritative source for work history, education, contact " +
  "details, languages, certifications, and licenses. candidateCv is the " +
  "full original CV text, supplementary only: use it for phrasing, nuance, " +
  "or detail not already captured in the structured fields, but never let " +
  "it override or contradict them.";

const NAME_RULE =
  "The input's candidateName field is the account's real, on-file name. " +
  "If it is non-null, use that EXACT name for the header/signature — never " +
  "a placeholder like 'Candidate Name' or a name guessed from the CV body. " +
  "If candidateName is null, use a name found in the CV text if one is " +
  "clearly present, otherwise write '[Your Name]' as an explicit placeholder.";

// Applicant-tracking-system optimization — this is what actually determines
// whether a resume gets past the automated screen before a human ever sees
// it. Layout-level ATS safety (single column, real text, standard fonts, no
// tables/images) is handled entirely in renderResumePdf; this note covers
// the content-level half: matching the posting's own vocabulary.
const ATS_NOTE =
  "This resume will likely be scanned by an applicant tracking system (ATS) " +
  "before a human reads it, so keyword matching matters: where the target " +
  "role's requirements/keywords use specific terminology the candidate " +
  "genuinely has evidence of (e.g. 'Node.js', 'Salesforce', 'PMP', a " +
  "specific tool or certification name), mirror that EXACT terminology in " +
  "skills/bullets rather than a rephrased synonym — an ATS keyword match is " +
  "literal, not semantic. Never claim a keyword the candidate doesn't " +
  "actually have. Keep dates in a single consistent format across every " +
  "experience and education entry (e.g. 'Jan 2022 – Present') so a parser " +
  "can reliably read the timeline.";

const roleContext = (job: TrackedJob) => ({
  title: job.title,
  company: job.company,
  description: job.description,
  companyDescription: job.companyDescription,
  companyResearch: job.companyResearch,
  requirements: job.requirements,
  keywords: job.keywords,
});

export type ResumeContent = {
  name: string;
  headline?: string;
  contact: {
    email?: string;
    phone?: string;
    location?: string;
    links?: string[];
  };
  summary: string;
  skills: string[];
  experience: {
    company: string;
    title: string;
    dates?: string;
    location?: string;
    bullets: string[];
  }[];
  education: {
    school: string;
    credential?: string;
    dates?: string;
    details?: string;
  }[];
  languages?: string[];
  certifications?: string[];
  licenses?: string[];
};

/** A resume reframed toward one specific role — reorders/emphasizes real
 * material, never invents employers, titles, dates, or accomplishments.
 * Structured (not a text blob) so it can render as an actual resume layout —
 * see renderResumePdf in lib/pdf.ts. */
export async function tailorResume(
  cvText: string,
  profile: MasterProfile,
  job: TrackedJob,
  displayName: string | null,
): Promise<ResumeContent> {
  return structured<ResumeContent>({
    system:
      "You write a tailored resume for a specific job application, as " +
      "structured data for a proper resume layout — not prose. " +
      HONESTY +
      " " +
      NAME_RULE +
      " " +
      STRUCTURED_PROFILE_NOTE +
      " Reframe and emphasize what's genuinely in the candidate's background " +
      "to match this role — the output's experience/education entries should " +
      "draw directly from candidateExperience/candidateEducation (selecting " +
      "which to include and how to phrase bullets, not inventing new " +
      "entries), and contact should draw directly from candidateContact. If " +
      "the source material is thin, produce fewer, honest entries rather " +
      "than padding with invented detail. headline is a one-line " +
      "professional title positioning the candidate for THIS role, grounded " +
      "in their real background (not a copy of the job title unless it " +
      "genuinely matches their experience). summary is 2-4 sentences. " +
      "skills are ordered by relevance to this specific role. experience " +
      "entries are ordered reverse-chronologically (most recent first, " +
      "strictly by date — never reordered by relevance, which would confuse " +
      "an ATS parser's read of the candidate's timeline), each with 2-5 " +
      "bullets that are concrete and results-oriented where the source " +
      "material supports it, reframed toward this role without inventing " +
      "metrics or outcomes that aren't there. education lists degrees " +
      "actually stated. languages, certifications, and licenses should be " +
      "copied from candidateLanguages/candidateCertifications/" +
      "candidateLicenses as-is (omit the field entirely, don't include an " +
      "empty array, if the candidate has none) — these are factual credentials, " +
      "not something to reframe or select from. " +
      ATS_NOTE +
      " " +
      COMPANY_RESEARCH_NOTE,
    content: JSON.stringify({
      ...candidateContext(cvText, profile, displayName),
      targetRole: roleContext(job),
    }),
    toolName: "record_resume",
    schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        headline: { type: "string" },
        contact: {
          type: "object",
          properties: {
            email: { type: "string" },
            phone: { type: "string" },
            location: { type: "string" },
            links: { type: "array", items: { type: "string" } },
          },
        },
        summary: { type: "string" },
        skills: { type: "array", items: { type: "string" }, maxItems: 20 },
        experience: {
          type: "array",
          items: {
            type: "object",
            properties: {
              company: { type: "string" },
              title: { type: "string" },
              dates: { type: "string" },
              location: { type: "string" },
              bullets: { type: "array", items: { type: "string" }, maxItems: 6 },
            },
            required: ["company", "title", "bullets"],
          },
        },
        education: {
          type: "array",
          items: {
            type: "object",
            properties: {
              school: { type: "string" },
              credential: { type: "string" },
              dates: { type: "string" },
              details: { type: "string" },
            },
            required: ["school"],
          },
        },
        languages: { type: "array", items: { type: "string" } },
        certifications: { type: "array", items: { type: "string" } },
        licenses: { type: "array", items: { type: "string" } },
      },
      required: ["name", "contact", "summary", "skills", "experience", "education"],
    },
    maxTokens: 3500,
  });
}

export type CoverLetterContent = { letter: string };

/** A short cover letter grounded in real background, addressed to this role,
 * signed with the candidate's real name. */
export async function generateCoverLetter(
  cvText: string,
  profile: MasterProfile,
  job: TrackedJob,
  displayName: string | null,
): Promise<CoverLetterContent> {
  return structured<CoverLetterContent>({
    system:
      "You write a cover letter for a specific job application. " +
      HONESTY +
      " " +
      NAME_RULE +
      " " +
      STRUCTURED_PROFILE_NOTE +
      " Close with a sign-off line ('Sincerely,' or similar) followed by " +
      "that exact name. Three or four short paragraphs: genuine interest in " +
      "this specific role/company, the strongest honest match between the " +
      "candidate and the requirements, and a brief close. No generic filler " +
      "and no invented enthusiasm about things not evidenced in the source " +
      "material. " +
      COMPANY_RESEARCH_NOTE,
    content: JSON.stringify({
      ...candidateContext(cvText, profile, displayName),
      targetRole: roleContext(job),
    }),
    toolName: "record_cover_letter",
    schema: {
      type: "object",
      properties: {
        letter: { type: "string", description: "the cover letter, plain text" },
      },
      required: ["letter"],
    },
    maxTokens: 1800,
  });
}

export type CheatSheetContent = {
  keyConcepts: string[];
  companyInsights: string[];
  productContext: string[];
  cultureAndValues: string[];
  talkingPoints: string[];
  questionsToAsk: string[];
};

/** A detailed prep sheet: concepts to know, real facts about the company and
 * what it builds, culture signals, candidate-specific angles, and smart
 * questions to ask the interviewer. */
export async function generateCheatSheet(
  profile: MasterProfile,
  job: TrackedJob,
): Promise<CheatSheetContent> {
  return structured<CheatSheetContent>({
    system:
      "You build a thorough interview prep sheet for someone about to " +
      "interview for this role. " +
      HONESTY +
      " Write each item as 1-2 full sentences with real substance, not a " +
      "bare phrase — someone should be able to study this and walk in " +
      "prepared. keyConcepts are the technical/domain concepts this role " +
      "expects familiarity with, each with enough explanation to jog the " +
      "candidate's memory on what it means and why it's relevant here. " +
      "companyInsights are concrete facts about the company worth knowing, " +
      "drawn only from what's given — never invent facts about the company. " +
      "productContext covers what the company actually builds/sells and its " +
      "market position. cultureAndValues are signals about how the company " +
      "works and what it values. Draw companyInsights, productContext, and " +
      "cultureAndValues from BOTH the posting and companyResearch (the " +
      "company's own site) where available — companyResearch often has " +
      "richer material for these three than the posting alone. talkingPoints " +
      "are angles the candidate could genuinely raise, grounded in the " +
      "posting/company material and the candidate's real background below — " +
      "explain WHY each point is worth raising. questionsToAsk are smart, " +
      "specific questions the candidate could ask the interviewer that show " +
      "genuine engagement with this role and company, not generic " +
      "interview-prep-book questions. " +
      COMPANY_RESEARCH_NOTE,
    content: JSON.stringify({
      candidateSummary: {
        targetRoles: profile.targetRoles,
        skills: profile.extractedSkills,
        summary: profile.summaryFacts,
      },
      targetRole: roleContext(job),
    }),
    toolName: "record_cheat_sheet",
    schema: {
      type: "object",
      properties: {
        keyConcepts: { type: "array", items: { type: "string" }, maxItems: 16 },
        companyInsights: { type: "array", items: { type: "string" }, maxItems: 10 },
        productContext: { type: "array", items: { type: "string" }, maxItems: 8 },
        cultureAndValues: { type: "array", items: { type: "string" }, maxItems: 8 },
        talkingPoints: { type: "array", items: { type: "string" }, maxItems: 10 },
        questionsToAsk: { type: "array", items: { type: "string" }, maxItems: 8 },
      },
      required: [
        "keyConcepts",
        "companyInsights",
        "productContext",
        "cultureAndValues",
        "talkingPoints",
        "questionsToAsk",
      ],
    },
    maxTokens: 4096,
  });
}

export type QuestionPackContent = {
  questions: {
    question: string;
    suggestedAnswer: string;
    category: "behavioral" | "role-specific" | "company-fit";
  }[];
};

/** A deep set of realistic interview questions for this posting (20-30),
 * each with a substantive suggested answer grounded in the candidate's real
 * background. */
export async function generateQuestionPack(
  cvText: string,
  profile: MasterProfile,
  job: TrackedJob,
  displayName: string | null,
): Promise<QuestionPackContent> {
  const result = await structured<QuestionPackContent>({
    system:
      "You write a deep, realistic interview question bank for this " +
      "specific role, each with a substantive suggested answer. " +
      HONESTY +
      " " +
      STRUCTURED_PROFILE_NOTE +
      " Write AT LEAST 20 questions and up to 30, spread across all three " +
      "categories, covering the full range a real interview loop for this " +
      "posting would include (screening through onsite): behavioral " +
      "questions probing past experience relevant to this role's demands, " +
      "role-specific/technical questions tied directly to the requirements " +
      "and description, and company-fit questions tied to what the posting " +
      "and companyResearch say about the company and its culture. Suggested " +
      "answers must be 3-5 sentences, concrete, and draw on the candidate's " +
      "real background — reference actual skills/experience/projects given, " +
      "never invent accomplishments, metrics, or stories. Where the " +
      "candidate's material doesn't support a strong answer, honestly say " +
      "what to emphasize instead of fabricating a story. Avoid " +
      "near-duplicate questions. " +
      COMPANY_RESEARCH_NOTE,
    content: JSON.stringify({
      ...candidateContext(cvText, profile, displayName),
      targetRole: roleContext(job),
    }),
    toolName: "record_question_pack",
    schema: {
      type: "object",
      properties: {
        questions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              question: { type: "string" },
              suggestedAnswer: { type: "string" },
              category: {
                type: "string",
                enum: ["behavioral", "role-specific", "company-fit"],
              },
            },
            required: ["question", "suggestedAnswer", "category"],
          },
          minItems: 20,
          maxItems: 30,
        },
      },
      required: ["questions"],
    },
    // This is the single largest structured call in the app — 20-30 items,
    // each with a substantive multi-sentence answer. maxTokens has headroom
    // above the realistic content size specifically so a long generation
    // doesn't get cut off mid-tool-call: a `required` field in the schema
    // is a strong hint to the model, not a server-enforced guarantee, and a
    // truncated tool call is exactly how it can end up missing entirely
    // (seen in the wild — see the validation below).
    maxTokens: 12000,
    stream: true,
  });

  // The schema's `required` lists don't guarantee the model actually
  // includes those fields — a demanding generation like this one (20-30
  // required objects, each with 3 required fields) can produce a malformed
  // tool call that's missing the whole array, OR missing a field on just one
  // item buried in it (both observed in practice). Drop anything incomplete
  // rather than let a single bad item crash the PDF render for the other 25
  // good ones, and fail clearly here if nothing usable came back at all —
  // not downstream with a confusing "Cannot read properties of undefined" a
  // step removed from the real cause.
  const questions = (result.questions ?? []).filter(
    (q) => q.question && q.suggestedAnswer && q.category,
  );
  if (questions.length === 0) {
    throw new Error("Question pack response was missing questions.");
  }
  return { questions };
}
