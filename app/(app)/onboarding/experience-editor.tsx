"use client";

import { useState, useTransition, type FormEvent } from "react";
import type { ProfileExperienceEntry } from "@/db/schema";
import { deleteExperience, saveExperience } from "./actions";

function ExperienceFields({ entry }: { entry?: ProfileExperienceEntry }) {
  return (
    <>
      <input type="hidden" name="id" defaultValue={entry?.id ?? ""} />
      <div className="row wrap" style={{ gap: 12 }}>
        <div className="field" style={{ flex: 1, minWidth: 180 }}>
          <label>Title</label>
          <input name="title" defaultValue={entry?.title ?? ""} required />
        </div>
        <div className="field" style={{ flex: 1, minWidth: 180 }}>
          <label>Company</label>
          <input name="company" defaultValue={entry?.company ?? ""} required />
        </div>
      </div>
      <div className="row wrap" style={{ gap: 12 }}>
        <div className="field" style={{ flex: 1, minWidth: 160 }}>
          <label>Dates</label>
          <input name="dates" defaultValue={entry?.dates ?? ""} placeholder="e.g. Jan 2022 – Present" />
        </div>
        <div className="field" style={{ flex: 1, minWidth: 160 }}>
          <label>Location</label>
          <input name="location" defaultValue={entry?.location ?? ""} />
        </div>
      </div>
      <div className="field">
        <label>Bullets (one per line)</label>
        <textarea name="bullets" defaultValue={(entry?.bullets ?? []).join("\n")} style={{ minHeight: 100 }} />
      </div>
    </>
  );
}

function ExperienceCard({ entry }: { entry: ProfileExperienceEntry }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      setError(null);
      const res = await saveExperience(fd);
      if (res?.error) setError(res.error);
      else setEditing(false);
    });
  };

  const onDelete = () => {
    start(async () => {
      await deleteExperience(entry.id);
    });
  };

  if (editing) {
    return (
      <form onSubmit={onSubmit} className="card stack" style={{ gap: 10 }}>
        <ExperienceFields entry={entry} />
        {error && <p className="error">{error}</p>}
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-primary" type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </button>
          <button type="button" className="btn-quiet" onClick={() => setEditing(false)} disabled={pending}>
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="tl-item">
      <div className="tl-dot" />
      <div className="tl-head">
        <div>
          <div className="tl-role">{entry.title} — {entry.company}</div>
          <div className="tl-meta">{[entry.location, entry.dates].filter(Boolean).join("  ·  ")}</div>
        </div>
        <div className="tl-actions">
          <button type="button" className="icon-btn" onClick={() => setEditing(true)} aria-label="Edit">✎</button>
          <button type="button" className="icon-btn" onClick={onDelete} disabled={pending} aria-label="Delete">×</button>
        </div>
      </div>
      {entry.bullets.length > 0 && (
        <ul className="tl-bullets">
          {entry.bullets.map((b, i) => <li key={i}>{b}</li>)}
        </ul>
      )}
    </div>
  );
}

function AddExperienceForm() {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    start(async () => {
      setError(null);
      const res = await saveExperience(fd);
      if (res?.error) setError(res.error);
      else {
        form.reset();
        setOpen(false);
      }
    });
  };

  if (!open) {
    return (
      <button type="button" className="add-dashed" onClick={() => setOpen(true)}>
        + Add experience
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card stack" style={{ gap: 10 }}>
      <ExperienceFields />
      {error && <p className="error">{error}</p>}
      <div className="row" style={{ gap: 8 }}>
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add"}
        </button>
        <button type="button" className="btn-quiet" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function ExperienceSection({ entries }: { entries: ProfileExperienceEntry[] }) {
  return (
    <div className="card stack" style={{ gap: 16 }}>
      <div>
        <p className="eyebrow">Experience</p>
        <h2 style={{ marginTop: 4 }}>Your work history</h2>
        <p className="muted" style={{ margin: 0 }}>
          What resumes are actually built from. Add anything extraction missed, fix anything it got wrong.
        </p>
      </div>
      {entries.length > 0 && (
        <div className="timeline">
          {entries.map((entry) => <ExperienceCard key={entry.id} entry={entry} />)}
        </div>
      )}
      <AddExperienceForm />
    </div>
  );
}
