"use server";

import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { withUser } from "@/db";
import {
  masterProfiles,
  users,
  type ProfileContact,
  type ProfileEducationEntry,
  type ProfileExperienceEntry,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { extractProfile, suggestTargetRoles } from "@/lib/anthropic";
import { getProfile } from "@/lib/queries";
import { readCvPdf } from "@/lib/pdf-read";
import { putFile } from "@/lib/storage";

type State = { error?: string; ok?: boolean };

/** Applies a partial edit to the profile, creating it if this is the user's
 * first manual entry (the "build it from scratch, no CV" path) and bumping
 * `version` either way — every field here is a material edit. */
async function upsertProfile(
  userId: string,
  patch: Partial<typeof masterProfiles.$inferInsert>,
) {
  await withUser(userId, async (tx) => {
    await tx
      .insert(masterProfiles)
      .values({ userId, version: 1, ...patch })
      .onConflictDoUpdate({
        target: masterProfiles.userId,
        set: { ...patch, version: sql`${masterProfiles.version} + 1`, updatedAt: new Date() },
      });
  });
}

const str = (form: FormData, key: string): string | undefined => {
  const v = (form.get(key) as string | null)?.trim();
  return v || undefined;
};

const lines = (form: FormData, key: string): string[] =>
  ((form.get(key) as string | null) ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * The highest-friction, highest-drop moment. The payoff that earns the friction
 * is the instant extraction — so we do it inline and show the result. We accept
 * a pasted CV, a text/markdown upload, or a PDF (extracted below); docx
 * extraction is a fast-follow that feeds the same `extractProfile`.
 */
export async function createProfile(_prev: State, form: FormData): Promise<State> {
  const user = await requireUser();

  const pasted = (form.get("cvText") as string | null)?.trim();
  const file = form.get("cvFile") as File | null;

  let cvText = pasted ?? "";
  let cvRef: string | null = null;
  // Detected only when a PDF is uploaded; null means "keep whatever the
  // profile already had" (see the onConflictDoUpdate fallback below) — a
  // plain-text edit shouldn't wipe out a style already picked up from a
  // previously uploaded PDF.
  let accentColor: string | null = null;

  if (file && file.size > 0) {
    const buf = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    cvRef = await putFile(buf, ext);

    if (ext === "pdf") {
      const parsed = await readCvPdf(buf);
      if (!cvText) cvText = parsed.text;
      // Independent of whether we needed the extracted text — a PDF with an
      // accent color still carries that signal even if you also pasted the
      // text yourself.
      accentColor = parsed.accentColor;
    } else if (!cvText && /(^|\.)(txt|md|markdown)$/i.test(file.name)) {
      cvText = buf.toString("utf8");
    } else if (!cvText) {
      return {
        error:
          "That file type needs the Word importer (coming next). For now, paste the CV text or upload a PDF.",
      };
    }
  }

  if (cvText.length < 80) {
    return { error: "Add your CV — paste the text or upload a .txt/.md/.pdf file." };
  }

  // Keep the full CV text on file (not just the extracted summary) — tailored
  // resumes/cover letters/prep need real material to reframe, never invent.
  if (!cvRef) {
    cvRef = await putFile(Buffer.from(cvText, "utf8"), "txt");
  }

  let extracted;
  try {
    extracted = await extractProfile(cvText);
  } catch {
    return { error: "Couldn't read that CV. Try again, or paste cleaner text." };
  }

  // Extraction is best-effort and re-running it replaces these sections
  // wholesale (same as it always has for skills/roles) — the editor below
  // lets the person fix whatever it missed or got wrong.
  const experience: ProfileExperienceEntry[] = extracted.experience.map((e) => ({
    ...e,
    id: randomUUID(),
  }));
  const education: ProfileEducationEntry[] = extracted.education.map((e) => ({
    ...e,
    id: randomUUID(),
  }));

  await withUser(user.id, async (tx) => {
    await tx
      .insert(masterProfiles)
      .values({
        userId: user.id,
        version: 1,
        masterCvRef: cvRef,
        styleAccentColor: accentColor,
        extractedSkills: extracted.extractedSkills,
        targetRoles: extracted.targetRoles,
        summaryFacts: extracted.summaryFacts,
        contact: extracted.contact,
        experience,
        education,
        languages: extracted.languages,
        certifications: extracted.certifications,
        licenses: extracted.licenses,
      })
      .onConflictDoUpdate({
        target: masterProfiles.userId,
        set: {
          // A material edit bumps the version — this is what lets fit scores go
          // stale honestly against `scoredAgainstProfileVersion`.
          version: sql`${masterProfiles.version} + 1`,
          masterCvRef: cvRef ?? sql`${masterProfiles.masterCvRef}`,
          styleAccentColor: accentColor ?? sql`${masterProfiles.styleAccentColor}`,
          extractedSkills: extracted.extractedSkills,
          targetRoles: extracted.targetRoles,
          summaryFacts: extracted.summaryFacts,
          contact: extracted.contact,
          experience,
          education,
          languages: extracted.languages,
          certifications: extracted.certifications,
          licenses: extracted.licenses,
          updatedAt: new Date(),
        },
      });
  });

  revalidatePath("/onboarding");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Recomputes targetRoles from the profile's current structured state
 * (experience/education/skills/etc. as hand-edited), not the original CV
 * text — so edits made after the initial extraction are reflected. */
export async function updateTargetRoles(): Promise<State> {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  if (!profile) return { error: "Add your CV or build your profile first." };

  let result;
  try {
    result = await suggestTargetRoles(profile);
  } catch {
    return { error: "Couldn't update roles — try again in a moment." };
  }

  await upsertProfile(user.id, { targetRoles: result.targetRoles });
  revalidatePath("/onboarding");
  return { ok: true };
}

/** The account's real name — used verbatim on generated resumes/cover
 * letters (see NAME_RULE in lib/anthropic.ts). Kept separate from the CV
 * upload/extraction flow since it's not something to re-derive each time. */
export async function updateBasicInfo(_prev: State, form: FormData): Promise<State> {
  const user = await requireUser();
  const fullName = (form.get("fullName") as string | null)?.trim();
  if (!fullName) return { error: "Add your name." };

  await withUser(user.id, async (tx) => {
    await tx.update(users).set({ displayName: fullName }).where(eq(users.id, user.id));
  });

  revalidatePath("/onboarding");
  return { ok: true };
}

/** Manual edit path: contact info, direct entry (not gated on ever having
 * uploaded a CV — a profile row is created on first save if none exists). */
export async function saveContact(_prev: State, form: FormData): Promise<State> {
  const user = await requireUser();
  const contact: ProfileContact = {
    email: str(form, "email"),
    phone: str(form, "phone"),
    location: str(form, "location"),
    links: lines(form, "links"),
  };
  await upsertProfile(user.id, { contact });
  revalidatePath("/onboarding");
  return { ok: true };
}

/** Manual edit path: the full skills list, replacing it wholesale (mirrors
 * what re-extraction already does — the whole point is the person controls
 * the final list either way). Direct-call signature (not useActionState) —
 * the chip editor persists on every add/remove, not via a single submit. */
export async function saveSkills(form: FormData): Promise<State> {
  const user = await requireUser();
  await upsertProfile(user.id, { extractedSkills: lines(form, "skills") });
  revalidatePath("/onboarding");
  return { ok: true };
}

/** Same list-replace pattern as saveSkills, for languages/certifications/licenses. */
export async function saveLanguages(form: FormData): Promise<State> {
  const user = await requireUser();
  await upsertProfile(user.id, { languages: lines(form, "languages") });
  revalidatePath("/onboarding");
  return { ok: true };
}

export async function saveCertifications(form: FormData): Promise<State> {
  const user = await requireUser();
  await upsertProfile(user.id, { certifications: lines(form, "certifications") });
  revalidatePath("/onboarding");
  return { ok: true };
}

export async function saveLicenses(form: FormData): Promise<State> {
  const user = await requireUser();
  await upsertProfile(user.id, { licenses: lines(form, "licenses") });
  revalidatePath("/onboarding");
  return { ok: true };
}

/** Add or update one experience entry — an empty/missing `id` field means
 * "new entry"; a matching `id` replaces that entry in place. */
export async function saveExperience(form: FormData): Promise<State> {
  const user = await requireUser();
  const company = str(form, "company");
  const title = str(form, "title");
  if (!company || !title) return { error: "Title and company are required." };

  const entry: ProfileExperienceEntry = {
    id: (form.get("id") as string) || randomUUID(),
    company,
    title,
    dates: str(form, "dates"),
    location: str(form, "location"),
    bullets: lines(form, "bullets"),
  };

  const profile = await getProfile(user.id);
  const existing = profile?.experience ?? [];
  const idx = existing.findIndex((e) => e.id === entry.id);
  const next = idx >= 0 ? existing.map((e, i) => (i === idx ? entry : e)) : [...existing, entry];

  await upsertProfile(user.id, { experience: next });
  revalidatePath("/onboarding");
  return { ok: true };
}

export async function deleteExperience(id: string): Promise<void> {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  if (!profile) return;
  await upsertProfile(user.id, { experience: profile.experience.filter((e) => e.id !== id) });
  revalidatePath("/onboarding");
}

/** Add or update one education entry — same new-vs-replace rule as
 * saveExperience above. */
export async function saveEducation(form: FormData): Promise<State> {
  const user = await requireUser();
  const school = str(form, "school");
  if (!school) return { error: "School is required." };

  const entry: ProfileEducationEntry = {
    id: (form.get("id") as string) || randomUUID(),
    school,
    credential: str(form, "credential"),
    dates: str(form, "dates"),
    details: str(form, "details"),
  };

  const profile = await getProfile(user.id);
  const existing = profile?.education ?? [];
  const idx = existing.findIndex((e) => e.id === entry.id);
  const next = idx >= 0 ? existing.map((e, i) => (i === idx ? entry : e)) : [...existing, entry];

  await upsertProfile(user.id, { education: next });
  revalidatePath("/onboarding");
  return { ok: true };
}

export async function deleteEducation(id: string): Promise<void> {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  if (!profile) return;
  await upsertProfile(user.id, { education: profile.education.filter((e) => e.id !== id) });
  revalidatePath("/onboarding");
}
