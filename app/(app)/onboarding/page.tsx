import { requireUser } from "@/lib/auth";
import { getProfile } from "@/lib/queries";
import { SuggestedRoles } from "@/components/suggested-roles";
import { saveCertifications, saveLanguages, saveLicenses, saveSkills } from "./actions";
import { BasicInfoForm } from "./basic-info";
import { ChipEditor } from "./chip-editor";
import { ContactForm } from "./contact-form";
import { EducationSection } from "./education-editor";
import { ProfileEditor } from "./editor";
import { ExperienceSection } from "./experience-editor";

export default async function OnboardingPage() {
  const user = await requireUser();
  const profile = await getProfile(user.id);

  // This page is a builder, not a feed — what's still missing is the one
  // thing worth surfacing before the detail below.
  const contact = profile?.contact;
  const sections = [
    { label: "Name", done: !!user.displayName },
    { label: "Contact", done: !!(contact?.email || contact?.phone || contact?.location || contact?.links?.length) },
    { label: "Experience", done: (profile?.experience.length ?? 0) > 0 },
    { label: "Education", done: (profile?.education.length ?? 0) > 0 },
    { label: "Skills", done: (profile?.extractedSkills.length ?? 0) > 0 },
    { label: "Languages", done: (profile?.languages.length ?? 0) > 0 },
    { label: "Certifications", done: (profile?.certifications.length ?? 0) > 0 },
    { label: "Licenses", done: (profile?.licenses.length ?? 0) > 0 },
  ];
  const doneCount = sections.filter((s) => s.done).length;
  const missing = sections.filter((s) => !s.done).map((s) => s.label);

  return (
    <div className="stack" style={{ gap: 24, maxWidth: 780 }}>
      <div>
        <p className="eyebrow">Master profile</p>
        <h1>{user.displayName || "Your profile"}</h1>
        <p className="muted" style={{ maxWidth: 560, marginBottom: 16 }}>
          This is the source of truth. Every tailored resume, cover letter, and fit score reframes
          what's really here — <strong>it never invents.</strong>
        </p>
        <div className="complete-strip">
          {sections.map((s) => (
            <span key={s.label} className={s.done ? "complete-pill done" : "complete-pill"}>{s.label}</span>
          ))}
        </div>
        <p className="hint" style={{ marginTop: 8 }}>
          {missing.length === 0
            ? `All ${sections.length} sections filled in.`
            : `${doneCount} of ${sections.length} sections filled in. ${missing.join(", ")} still ${missing.length === 1 ? "needs" : "need"} something — add them if they apply.`}
        </p>
      </div>

      <BasicInfoForm fullName={user.displayName} />
      <ProfileEditor initial={profile} />
      <SuggestedRoles roles={profile?.targetRoles ?? []} hasProfile={!!profile} />
      <ContactForm contact={profile?.contact} />
      <ExperienceSection entries={profile?.experience ?? []} />
      <EducationSection entries={profile?.education ?? []} />

      <div className="card">
        <p className="eyebrow">Credentials</p>
        <h2 style={{ marginTop: 4, marginBottom: 16 }}>Skills, languages, certifications &amp; licenses</h2>
        <div className="chip-grid">
          <ChipEditor
            label="Skills"
            fieldName="skills"
            placeholder="Add a skill…"
            items={profile?.extractedSkills ?? []}
            action={saveSkills}
          />
          <ChipEditor
            label="Languages"
            fieldName="languages"
            placeholder="e.g. Spanish (fluent)"
            items={profile?.languages ?? []}
            action={saveLanguages}
          />
          <ChipEditor
            label="Certifications"
            fieldName="certifications"
            placeholder="e.g. AWS Certified, 2023"
            items={profile?.certifications ?? []}
            action={saveCertifications}
          />
          <ChipEditor
            label="Licenses"
            fieldName="licenses"
            placeholder="e.g. RN License, State of Texas"
            items={profile?.licenses ?? []}
            action={saveLicenses}
            emptyNote="Nothing added yet — skip if not applicable to your field."
          />
        </div>
      </div>
    </div>
  );
}
