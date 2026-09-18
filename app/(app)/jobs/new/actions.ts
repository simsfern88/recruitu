"use server";

import { redirect } from "next/navigation";
import { withUser } from "@/db";
import {
  employmentType as employmentTypeEnum,
  statusEvents,
  trackedJobs,
  workMode as workModeEnum,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { parseJobImage, parseJobText, type ParsedJob } from "@/lib/anthropic";
import { scrapeCompanySite, scrapeUrl } from "@/lib/scrape";

type State = { error?: string };

const IMG_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

// The model is instructed to omit workMode/employmentType rather than guess,
// but tool-use enum constraints aren't hard-enforced server-side — it can
// still emit something outside the list (seen in the wild: a literal
// "<UNKNOWN>" placeholder). Both columns are strict Postgres enums, so an
// unvalidated pass-through is a guaranteed insert crash the moment the model
// slips even once. Validate against the schema's own enum values rather
// than trusting the AI's output or the TypeScript type alone.
function sanitizeEnum<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
): T | null {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

export async function captureJob(_prev: State, form: FormData): Promise<State> {
  const user = await requireUser();
  const sourceType = form.get("sourceType") as string;

  const companyName = (form.get("companyName") as string | null)?.trim() || null;
  const roleName = (form.get("roleName") as string | null)?.trim() || null;
  const companyUrl = (form.get("companyUrl") as string | null)?.trim() || null;

  // Best-effort: a lightweight crawl of the company's own site (homepage plus
  // a few likely About/Careers/Team pages) enriches company info and later
  // prep, but a failed scrape never blocks capture — same graceful-degrade
  // rule as the job-posting URL below.
  let companyResearch: string | undefined;
  if (companyUrl) {
    const scraped = await scrapeCompanySite(companyUrl);
    if (scraped.ok) companyResearch = scraped.text;
  }

  let parsed: ParsedJob;
  let sourceRaw = "";
  let sourceUrl: string | null = null;
  let sourceTypeStored: "paste" | "url" | "screenshot_ocr" = "paste";

  try {
    if (sourceType === "url") {
      const url = (form.get("url") as string)?.trim();
      if (!url) return { error: "Add a URL, or switch to paste." };
      sourceUrl = url;
      const scraped = await scrapeUrl(url);
      if (!scraped.ok) {
        // Graceful degrade: never a dead error. Tell them to paste instead.
        return {
          error: `${scraped.reason} Paste the job text instead — that always works.`,
        };
      }
      sourceRaw = scraped.text;
      sourceTypeStored = "url";
      parsed = await parseJobText(scraped.text, companyResearch);
    } else if (sourceType === "screenshot_ocr") {
      const file = form.get("screenshot") as File | null;
      if (!file || file.size === 0) return { error: "Add a screenshot." };
      if (!IMG_TYPES.includes(file.type as (typeof IMG_TYPES)[number])) {
        return { error: "Use a PNG, JPG, or WebP screenshot." };
      }
      const b64 = Buffer.from(await file.arrayBuffer()).toString("base64");
      sourceRaw = `[screenshot: ${file.name}]`;
      sourceTypeStored = "screenshot_ocr";
      parsed = await parseJobImage(b64, file.type as (typeof IMG_TYPES)[number], companyResearch);
    } else {
      const text = (form.get("text") as string)?.trim();
      if (!text) return { error: "Paste the job posting text." };
      sourceRaw = text;
      sourceTypeStored = "paste";
      parsed = await parseJobText(text, companyResearch);
    }
  } catch {
    return { error: "Couldn't parse that posting. The raw text is safe — try again." };
  }

  const jobId = await withUser(user.id, async (tx) => {
    const [job] = await tx
      .insert(trackedJobs)
      .values({
        userId: user.id,
        sourceType: sourceTypeStored,
        sourceRaw, // kept forever so a bad parse can be re-run later
        sourceUrl,
        // The person typed these in directly — trust that over an AI guess.
        company: companyName ?? parsed.company ?? null,
        title: roleName ?? parsed.title ?? null,
        companyUrl,
        location: parsed.location ?? null,
        workMode: sanitizeEnum(parsed.workMode, workModeEnum.enumValues),
        employmentType: sanitizeEnum(parsed.employmentType, employmentTypeEnum.enumValues),
        compRange: parsed.compRange ?? null,
        deadline: parsed.deadline ?? null,
        description: parsed.description ?? null,
        companyDescription: parsed.companyDescription ?? null,
        companyResearch: companyResearch ?? null, // kept forever, like sourceRaw
        requirements: parsed.requirements,
        keywords: parsed.keywords,
        status: "saved",
      })
      .returning({ id: trackedJobs.id });

    // Dimension A starts here: log the opening event for the analytics substrate.
    await tx.insert(statusEvents).values({
      trackedJobId: job.id,
      fromStatus: null,
      toStatus: "saved",
    });

    return job.id;
  });

  redirect(`/jobs/${jobId}`);
}
