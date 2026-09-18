"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { withUser } from "@/db";
import { trackedJobs } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { summarizeCompany } from "@/lib/anthropic";
import { scrapeCompanySite } from "@/lib/scrape";
import { getJob } from "@/lib/queries";

type State = { error?: string };

/** Manual re-fill of "About the company" after capture — a URL to (re-)scrape,
 * pasted text, or a straight hand-typed replacement. Never touches the role's
 * own parsed fields (title, requirements, etc.), only companyUrl/
 * companyResearch/companyDescription. */
export async function refreshCompanyInfo(jobId: string, form: FormData): Promise<State> {
  const user = await requireUser();
  const job = await getJob(user.id, jobId);
  if (!job) return { error: "Job not found." };

  const mode = form.get("mode") as string;

  if (mode === "manual") {
    const text = (form.get("description") as string | null)?.trim();
    if (!text) return { error: "Add a description." };

    await withUser(user.id, (tx) =>
      tx
        .update(trackedJobs)
        .set({ companyDescription: text, updatedAt: new Date() })
        .where(eq(trackedJobs.id, jobId)),
    );
    revalidatePath(`/jobs/${jobId}`);
    return {};
  }

  let companyMaterial: string;
  let companyUrl = job.companyUrl;

  if (mode === "url") {
    const url = (form.get("companyUrl") as string | null)?.trim();
    if (!url) return { error: "Add a URL." };
    const scraped = await scrapeCompanySite(url);
    if (!scraped.ok) {
      return { error: `${scraped.reason} Try pasting the text instead — that always works.` };
    }
    companyMaterial = scraped.text;
    companyUrl = url;
  } else {
    const text = (form.get("pasteText") as string | null)?.trim();
    if (!text) return { error: "Paste some text about the company." };
    companyMaterial = text;
  }

  let companyDescription: string;
  try {
    companyDescription = await summarizeCompany(companyMaterial, job);
  } catch {
    return { error: "Couldn't summarize that — try again in a moment." };
  }

  await withUser(user.id, (tx) =>
    tx
      .update(trackedJobs)
      .set({
        companyUrl,
        companyResearch: companyMaterial,
        companyDescription,
        updatedAt: new Date(),
      })
      .where(eq(trackedJobs.id, jobId)),
  );

  revalidatePath(`/jobs/${jobId}`);
  return {};
}
