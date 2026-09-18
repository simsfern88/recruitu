import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withUser } from "@/db";
import { artifacts, trackedJobs } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getFile } from "@/lib/storage";

const slugify = (s: string | null) =>
  (s ?? "job").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "job";

/** Streams a generated artifact's PDF. Scoped through withUser so the same
 * RLS policy that protects `artifacts` (via its parent job's ownership)
 * decides access here too — there's no separate authorization to get wrong. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; artifactId: string }> },
) {
  const { artifactId } = await params;
  const user = await requireUser();

  const row = await withUser(user.id, async (tx) => {
    const [r] = await tx
      .select({
        contentRef: artifacts.contentRef,
        type: artifacts.type,
        version: artifacts.version,
        company: trackedJobs.company,
        title: trackedJobs.title,
      })
      .from(artifacts)
      .innerJoin(trackedJobs, eq(trackedJobs.id, artifacts.trackedJobId))
      .where(eq(artifacts.id, artifactId))
      .limit(1);
    return r ?? null;
  });

  if (!row || !row.contentRef) {
    return new NextResponse("Not found", { status: 404 });
  }

  const bytes = await getFile(row.contentRef);
  const filename = `${row.type}-${slugify(row.company ?? row.title)}-v${row.version}.pdf`;
  const body = new Uint8Array(bytes); // copies into a plain (non-shared) ArrayBuffer

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
