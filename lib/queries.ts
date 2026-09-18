import "server-only";
import { desc, eq } from "drizzle-orm";
import { withUser } from "@/db";
import { artifacts, masterProfiles, trackedJobs, type Artifact, type TrackedJob } from "@/db/schema";

export async function getProfile(userId: string) {
  return withUser(userId, async (tx) => {
    const [p] = await tx
      .select()
      .from(masterProfiles)
      .where(eq(masterProfiles.userId, userId))
      .limit(1);
    return p ?? null;
  });
}

export async function listJobs(userId: string): Promise<TrackedJob[]> {
  return withUser(userId, (tx) =>
    tx
      .select()
      .from(trackedJobs)
      .where(eq(trackedJobs.userId, userId))
      .orderBy(desc(trackedJobs.updatedAt)),
  );
}

export async function getJob(
  userId: string,
  jobId: string,
): Promise<TrackedJob | null> {
  return withUser(userId, async (tx) => {
    const [j] = await tx
      .select()
      .from(trackedJobs)
      .where(eq(trackedJobs.id, jobId))
      .limit(1);
    return j ?? null;
  });
}

/** The latest version of each artifact type generated for a job, keyed by type. */
export async function getLatestArtifacts(
  userId: string,
  jobId: string,
): Promise<Partial<Record<Artifact["type"], Artifact>>> {
  return withUser(userId, async (tx) => {
    const rows = await tx
      .select()
      .from(artifacts)
      .where(eq(artifacts.trackedJobId, jobId))
      .orderBy(desc(artifacts.version));

    const latest: Partial<Record<Artifact["type"], Artifact>> = {};
    for (const row of rows) {
      if (!latest[row.type]) latest[row.type] = row;
    }
    return latest;
  });
}
