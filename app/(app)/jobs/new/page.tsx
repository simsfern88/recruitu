import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getProfile } from "@/lib/queries";
import { SuggestedRoles } from "@/components/suggested-roles";
import { CaptureForm } from "./form";

export default async function NewJobPage() {
  const user = await requireUser();
  const profile = await getProfile(user.id);

  return (
    <div className="stack" style={{ gap: 20, maxWidth: 720 }}>
      <div>
        <p className="eyebrow">Capture</p>
        <h1>Bring in a job</h1>
        <p className="muted">
          Found something on LinkedIn, a company site, anywhere — bring it in
          here. Paste the text, drop a screenshot, or give a link.
        </p>
      </div>

      {!profile && (
        <div className="card" style={{ borderColor: "var(--warn)" }}>
          <p style={{ margin: 0 }}>
            You can capture jobs now, but fit scoring needs your profile first.{" "}
            <Link href="/onboarding">Add your CV →</Link>
          </p>
        </div>
      )}

      <SuggestedRoles roles={profile?.targetRoles ?? []} hasProfile={!!profile} />

      <CaptureForm />
    </div>
  );
}
