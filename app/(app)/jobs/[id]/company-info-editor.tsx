"use client";

import { useState, useTransition, type FormEvent } from "react";
import { refreshCompanyInfo } from "./company-actions";

type Mode = "url" | "paste" | "manual";

const MODES: { id: Mode; label: string }[] = [
  { id: "url", label: "URL" },
  { id: "paste", label: "Paste text" },
  { id: "manual", label: "Type manually" },
];

/** Lets the person re-fill "About the company" any time after capture — not
 * just at the moment the job was first brought in. URL and paste both go
 * through the same honest summarize-from-material pass as capture does;
 * manual replaces the text outright with no AI involved. */
export function CompanyInfoEditor({
  jobId,
  companyUrl,
  companyDescription,
}: {
  jobId: string;
  companyUrl: string | null;
  companyDescription: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("url");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("mode", mode);
    start(async () => {
      setError(null);
      const res = await refreshCompanyInfo(jobId, fd);
      if (res?.error) setError(res.error);
      else setOpen(false);
    });
  };

  if (!open) {
    return (
      <button type="button" className="btn-quiet" style={{ marginTop: 10 }} onClick={() => setOpen(true)}>
        Update company info
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="stack" style={{ gap: 10, marginTop: 12 }}>
      <div className="seg-group" role="radiogroup" aria-label="Update method">
        {MODES.map((m) => (
          <label key={m.id} htmlFor={`company-mode-${jobId}-${m.id}`}>
            <input
              type="radio"
              id={`company-mode-${jobId}-${m.id}`}
              name="modeRadio"
              checked={mode === m.id}
              onChange={() => setMode(m.id)}
              disabled={pending}
            />
            {m.label}
          </label>
        ))}
      </div>

      {mode === "url" && (
        <div className="field">
          <label htmlFor={`company-url-${jobId}`}>Company website</label>
          <input
            id={`company-url-${jobId}`}
            name="companyUrl"
            type="url"
            defaultValue={companyUrl ?? ""}
            placeholder="https://…"
          />
          <p className="hint">We'll re-read the site and rewrite the summary below from it.</p>
        </div>
      )}

      {mode === "paste" && (
        <div className="field">
          <label htmlFor={`company-paste-${jobId}`}>Paste anything about the company</label>
          <textarea
            id={`company-paste-${jobId}`}
            name="pasteText"
            placeholder="From their About page, LinkedIn, a press release — anything."
            style={{ minHeight: 120 }}
          />
        </div>
      )}

      {mode === "manual" && (
        <div className="field">
          <label htmlFor={`company-manual-${jobId}`}>About the company</label>
          <textarea
            id={`company-manual-${jobId}`}
            name="description"
            defaultValue={companyDescription ?? ""}
            style={{ minHeight: 120 }}
          />
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <div className="row" style={{ gap: 8 }}>
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? "Updating…" : "Save"}
        </button>
        <button type="button" className="btn-quiet" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </button>
      </div>
    </form>
  );
}
