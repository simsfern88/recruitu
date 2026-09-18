"use client";

import { useState, useTransition } from "react";

type State = { error?: string; ok?: boolean };

/** Removable-chip editor — Skills, Languages, Certifications, and Licenses
 * all share this shape: a short, order-doesn't-matter list. Each add/remove
 * persists immediately (the whole list is resent as newline-joined text,
 * same wire format the old textarea used) rather than needing an explicit
 * Save button. */
export function ChipEditor({
  label,
  fieldName,
  placeholder,
  items,
  action,
  emptyNote,
}: {
  label: string;
  fieldName: string;
  placeholder: string;
  items: string[];
  action: (form: FormData) => Promise<State>;
  emptyNote?: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const persist = (next: string[]) => {
    const fd = new FormData();
    fd.set(fieldName, next.join("\n"));
    start(async () => {
      setError(null);
      const res = await action(fd);
      if (res?.error) setError(res.error);
    });
  };

  const addItem = () => {
    const v = draft.trim();
    if (!v || pending) return;
    persist([...items, v]);
    setDraft("");
  };

  const removeItem = (i: number) => {
    if (pending) return;
    persist(items.filter((_, idx) => idx !== i));
  };

  return (
    <div className="chip-panel">
      <h3>{label}</h3>
      {items.length === 0 ? (
        <p className="empty-note">{emptyNote ?? "Nothing added yet."}</p>
      ) : (
        <div className="chip-list">
          {items.map((item, i) => (
            <span key={`${item}-${i}`} className="chip-item">
              {item}
              <button
                type="button"
                className="x"
                onClick={() => removeItem(i)}
                disabled={pending}
                aria-label={`Remove ${item}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="chip-add">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addItem();
            }
          }}
          placeholder={placeholder}
          disabled={pending}
        />
        <button type="button" onClick={addItem} disabled={pending || !draft.trim()} aria-label={`Add to ${label}`}>
          +
        </button>
      </div>
      {error && <p className="error" style={{ marginTop: 8 }}>{error}</p>}
    </div>
  );
}
