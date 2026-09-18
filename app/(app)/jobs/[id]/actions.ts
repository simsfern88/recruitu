"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { withUser } from "@/db";
import { outcomeStatus, statusEvents, trackedJobs, type TrackedJob } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { scoreFit } from "@/lib/anthropic";
import { getJob, getProfile } from "@/lib/queries";

type State = { error?: string };

const VALID_STATUSES = new Set(outcomeStatus.enumValues);

export async function updateJobStatus(
  jobId: string,
  toStatus: TrackedJob["status"],
): Promise<State> {
  const user = await requireUser();
  if (!VALID_STATUSES.has(toStatus)) return { error: "Invalid status." };

  const job = await getJob(user.id, jobId);
  if (!job) return { error: "Job not found." };
  if (job.status === toStatus) return {};

  await withUser(user.id, async (tx) => {
    await tx
      .update(trackedJobs)
      .set({ status: toStatus, updatedAt: new Date() })
      .where(eq(trackedJobs.id, jobId));
    await tx.insert(statusEvents).values({
      trackedJobId: jobId,
      fromStatus: job.status,
      toStatus,
    });
  });

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/dashboard");
  return {};
}

export async function scoreJob(jobId: string): Promise<State> {
  const user = await requireUser();

  const [job, profile] = await Promise.all([
    getJob(user.id, jobId),
    getProfile(user.id),
  ]);
  if (!job) return { error: "Job not found." };
  if (!profile) return { error: "Add your CV first so we can score against it." };

  let fit;
  try {
    fit = await scoreFit(job, profile);
  } catch {
    return { error: "Scoring failed — try again in a moment." };
  }

  await withUser(user.id, async (tx) => {
    await tx
      .update(trackedJobs)
      .set({
        fit,
        prepProgress: { ...job.prepProgress, scored: true },
        updatedAt: new Date(),
      })
      .where(eq(trackedJobs.id, jobId));
  });

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/dashboard");
  return {};
}
