"use client";

import { useState, useTransition, type FormEvent } from "react";
import type { ProfileEducationEntry } from "@/db/schema";
import { deleteEducation, saveEducation } from "./actions";

function EducationFields({ entry }: { entry?: ProfileEducationEntry }) {
  return (
    <>
      <input type="hidden" name="id" defaultValue={entry?.id ?? ""} />
      <div className="field">
        <label>School</label>
        <input name="school" defaultValue={entry?.school ?? ""} required />
      </div>
      <div className="row wrap" style={{ gap: 12 }}>
        <div className="field" style={{ flex: 1, minWidth: 180 }}>
          <label>Credential</label>
          <input name="credential" defaultValue={entry?.credential ?? ""} placeholder="e.g. B.S. Computer Science" />
        </div>
        <div className="field" style={{ flex: 1, minWidth: 160 }}>
          <label>Dates</label>
          <input name="dates" defaultValue={entry?.dates ?? ""} placeholder="e.g. 2019" />
        </div>
      </div>
      <div className="field">
        <label>Details</label>
        <input name="details" defaultValue={entry?.details ?? ""} placeholder="Honors, coursework, GPA — optional" />
      </div>
    </>
  );
}

function EducationCard({ entry }: { entry: ProfileEducationEntry }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      setError(null);
      const res = await saveEducation(fd);
      if (res?.error) setError(res.error);
      else setEditing(false);
    });
  };

  const onDelete = () => {
    start(async () => {
      await deleteEducation(entry.id);
    });
  };

  if (editing) {
    return (
      <form onSubmit={onSubmit} className="card stack" style={{ gap: 10 }}>
        <EducationFields entry={entry} />
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
    <div className="edu-item">
      <div>
        <div className="edu-title">{[entry.credential, entry.school].filter(Boolean).join(", ") || entry.school}</div>
        <div className="edu-meta">{entry.dates}</div>
        {entry.details && <p className="muted" style={{ margin: "4px 0 0" }}>{entry.details}</p>}
      </div>
      <div className="tl-actions">
        <button type="button" className="icon-btn" onClick={() => setEditing(true)} aria-label="Edit">✎</button>
        <button type="button" className="icon-btn" onClick={onDelete} disabled={pending} aria-label="Delete">×</button>
      </div>
    </div>
  );
}

function AddEducationForm() {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    start(async () => {
      setError(null);
      const res = await saveEducation(fd);
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
        + Add education
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card stack" style={{ gap: 10 }}>
      <EducationFields />
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

export function EducationSection({ entries }: { entries: ProfileEducationEntry[] }) {
  return (
    <div className="card stack" style={{ gap: 16 }}>
      <div>
        <p className="eyebrow">Education</p>
        <h2 style={{ marginTop: 4 }}>Your education</h2>
      </div>
      {entries.map((entry) => <EducationCard key={entry.id} entry={entry} />)}
      <AddEducationForm />
    </div>
  );
}
