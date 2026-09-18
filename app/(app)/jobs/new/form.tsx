"use client";

import { useActionState, useState } from "react";
import { captureJob } from "./actions";

type Mode = "paste" | "url" | "screenshot_ocr";

const TABS: { id: Mode; label: string }[] = [
  { id: "paste", label: "Paste text" },
  { id: "url", label: "URL" },
  { id: "screenshot_ocr", label: "Screenshot" },
];

export function CaptureForm() {
  const [mode, setMode] = useState<Mode>("paste");
  const [state, action, pending] = useActionState(captureJob, {});

  return (
    <form action={action} className="card stack" style={{ gap: 16 }}>
      <input type="hidden" name="sourceType" value={mode} />

      <div className="row wrap" style={{ gap: 12 }}>
        <div className="field" style={{ flex: 1, minWidth: 200 }}>
          <label htmlFor="companyName">Company name</label>
          <input id="companyName" name="companyName" type="text" placeholder="e.g. Acme Robotics" />
        </div>
        <div className="field" style={{ flex: 1, minWidth: 200 }}>
          <label htmlFor="roleName">Role name</label>
          <input id="roleName" name="roleName" type="text" placeholder="e.g. Senior Backend Engineer" />
        </div>
      </div>
      <div className="field">
        <label htmlFor="companyUrl">Company website (optional)</label>
        <input id="companyUrl" name="companyUrl" type="url" placeholder="https://…" />
        <p className="hint">
          We'll pull a bit of context from their site to enrich your fit score,
          cheat sheet, and other prep — only where it's actually relevant.
        </p>
      </div>

      <div className="row" style={{ gap: 4 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setMode(t.id)}
            className={`btn ${mode === t.id ? "btn-primary" : "btn-ghost"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {mode === "paste" && (
        <div className="field">
          <label htmlFor="text">Job posting text</label>
          <textarea id="text" name="text" placeholder="Paste the full posting — title, description, requirements…" />
        </div>
      )}

      {mode === "url" && (
        <div className="field">
          <label htmlFor="url">Job posting URL</label>
          <input id="url" name="url" type="url" placeholder="https://…" />
          <p className="hint">
            Some sites block scraping. If a link doesn't work, paste the text —
            that always does.
          </p>
        </div>
      )}

      {mode === "screenshot_ocr" && (
        <div className="field">
          <label htmlFor="screenshot">Screenshot of the posting</label>
          <input id="screenshot" name="screenshot" type="file" accept="image/png,image/jpeg,image/webp" />
        </div>
      )}

      {state?.error && <p className="error">{state.error}</p>}

      <button className="btn btn-primary" type="submit" disabled={pending} style={{ alignSelf: "flex-start" }}>
        {pending ? "Reading the posting…" : "Capture job"}
      </button>
    </form>
  );
}
