"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { withUser } from "@/db";
import { artifacts, trackedJobs, type MasterProfile, type TrackedJob } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import {
  generateCheatSheet,
  generateCoverLetter,
  generateQuestionPack,
  tailorResume,
} from "@/lib/anthropic";
import {
  renderCheatSheetPdf,
  renderCoverLetterPdf,
  renderQuestionPackPdf,
  renderResumePdf,
  type ResumeTemplateId,
} from "@/lib/pdf";
import { getJob, getProfile } from "@/lib/queries";
import { getFile, putFile } from "@/lib/storage";

type State = { error?: string };
type PrepKey = keyof TrackedJob["prepProgress"];

async function loadCvText(profile: MasterProfile): Promise<string> {
  if (!profile.masterCvRef) return "";
  try {
    return (await getFile(profile.masterCvRef)).toString("utf8");
  } catch {
    return "";
  }
}

/** Store the rendered PDF, insert a new artifact version pointing at it, and
 * flip the matching prep-progress chip on. Artifacts are versioned (see
 * db/schema.ts) so regenerating never loses the previous copy — it just adds
 * a newer one, PDF included. */
async function saveArtifact(
  userId: string,
  job: TrackedJob,
  type: (typeof artifacts.$inferInsert)["type"],
  prepKey: PrepKey,
  profileVersion: number,
  content: object,
  pdf: Buffer,
) {
  const contentRef = await putFile(pdf, "pdf");

  await withUser(userId, async (tx) => {
    const [latest] = await tx
      .select({ version: artifacts.version })
      .from(artifacts)
      .where(and(eq(artifacts.trackedJobId, job.id), eq(artifacts.type, type)))
      .orderBy(desc(artifacts.version))
      .limit(1);

    await tx.insert(artifacts).values({
      trackedJobId: job.id,
      type,
      version: (latest?.version ?? 0) + 1,
      basedOnProfileVersion: profileVersion,
      content,
      contentRef,
    });

    await tx
      .update(trackedJobs)
      .set({
        prepProgress: { ...job.prepProgress, [prepKey]: true },
        updatedAt: new Date(),
      })
      .where(eq(trackedJobs.id, job.id));
  });

  revalidatePath(`/jobs/${job.id}`);
}

export async function generateResume(
  jobId: string,
  templateId: ResumeTemplateId = "classic",
): Promise<State> {
  const user = await requireUser();
  const [job, profile] = await Promise.all([getJob(user.id, jobId), getProfile(user.id)]);
  if (!job) return { error: "Job not found." };
  if (!profile) return { error: "Add your CV first so there's something to tailor." };

  try {
    const cvText = await loadCvText(profile);
    const content = await tailorResume(cvText, profile, job, user.displayName);
    const pdf = await renderResumePdf(content, profile.styleAccentColor, templateId);
    // templateId rides along in the stored content (not part of the AI's own
    // output schema) so "Regenerate" can default back to whichever template
    // was picked last time.
    await saveArtifact(user.id, job, "resume", "resume_tailored", profile.version, { ...content, templateId }, pdf);
  } catch (err) {
    console.error("generateResume failed:", err);
    return { error: "Couldn't generate a resume — try again in a moment." };
  }
  return {};
}

export async function generateCoverLetterArtifact(jobId: string): Promise<State> {
  const user = await requireUser();
  const [job, profile] = await Promise.all([getJob(user.id, jobId), getProfile(user.id)]);
  if (!job) return { error: "Job not found." };
  if (!profile) return { error: "Add your CV first so there's something to draw on." };

  try {
    const cvText = await loadCvText(profile);
    const content = await generateCoverLetter(cvText, profile, job, user.displayName);
    const pdf = await renderCoverLetterPdf(
      user.displayName,
      job.title,
      job.company,
      content,
      profile.styleAccentColor,
    );
    await saveArtifact(user.id, job, "cover_letter", "cover_letter", profile.version, content, pdf);
  } catch (err) {
    console.error("generateCoverLetterArtifact failed:", err);
    return { error: "Couldn't generate a cover letter — try again in a moment." };
  }
  return {};
}

export async function generateCheatSheetArtifact(jobId: string): Promise<State> {
  const user = await requireUser();
  const [job, profile] = await Promise.all([getJob(user.id, jobId), getProfile(user.id)]);
  if (!job) return { error: "Job not found." };
  if (!profile) return { error: "Add your CV first." };

  try {
    const content = await generateCheatSheet(profile, job);
    const pdf = await renderCheatSheetPdf(job.title, job.company, content, profile.styleAccentColor);
    await saveArtifact(user.id, job, "cheat_sheet", "cheat_sheet", profile.version, content, pdf);
  } catch (err) {
    console.error("generateCheatSheetArtifact failed:", err);
    return { error: "Couldn't generate a cheat sheet — try again in a moment." };
  }
  return {};
}

export async function generateQuestionPackArtifact(jobId: string): Promise<State> {
  const user = await requireUser();
  const [job, profile] = await Promise.all([getJob(user.id, jobId), getProfile(user.id)]);
  if (!job) return { error: "Job not found." };
  if (!profile) return { error: "Add your CV first so answers can be grounded in your background." };

  try {
    const cvText = await loadCvText(profile);
    const content = await generateQuestionPack(cvText, profile, job, user.displayName);
    const pdf = await renderQuestionPackPdf(
      job.title,
      job.company,
      content,
      profile.styleAccentColor,
    );
    await saveArtifact(user.id, job, "question_pack", "question_pack", profile.version, content, pdf);
  } catch (err) {
    console.error("generateQuestionPackArtifact failed:", err);
    return { error: "Couldn't generate a question pack — try again in a moment." };
  }
  return {};
}
