"use client";

import { useState, useTransition } from "react";
import type { TrackedJob } from "@/db/schema";
import { updateJobStatus } from "./actions";

const STAGES: { value: TrackedJob["status"]; label: string }[] = [
  { value: "saved", label: "Saved" },
  { value: "applied", label: "Applied" },
  { value: "interviewing", label: "Interviewing" },
  { value: "offer", label: "Offer" },
  { value: "accepted", label: "Accepted" },
];

const EXITS: { value: TrackedJob["status"]; label: string }[] = [
  { value: "no_response", label: "No response" },
  { value: "rejected", label: "Rejected" },
  { value: "withdrawn", label: "Withdrew / declined offer" },
];

export function StatusControl({
  jobId,
  status,
}: {
  jobId: string;
  status: TrackedJob["status"];
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isExit = EXITS.some((e) => e.value === status);
  const stageIdx = STAGES.findIndex((s) => s.value === status);

  const set = (value: TrackedJob["status"]) => {
    if (value === status || pending) return;
    start(async () => {
      setError(null);
      const res = await updateJobStatus(jobId, value);
      if (res?.error) setError(res.error);
    });
  };

  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="ladder" aria-label="Set outcome stage" style={{ flexWrap: "wrap" }}>
        {STAGES.map((s, i) => {
          const cls =
            !isExit && i < stageIdx ? "rung done" : !isExit && i === stageIdx ? "rung at" : "rung";
          return (
            <button
              key={s.value}
              type="button"
              onClick={() => set(s.value)}
              disabled={pending}
              className={cls}
              style={{ cursor: pending ? "default" : "pointer" }}
            >
              {s.label}
            </button>
          );
        })}
      </div>
      <div className="row wrap" style={{ gap: 6 }}>
        {EXITS.map((e) => (
          <button
            key={e.value}
            type="button"
            onClick={() => set(e.value)}
            disabled={pending}
            className={status === e.value ? "rung exit" : "rung"}
            style={{
              cursor: pending ? "default" : "pointer",
              borderStyle: status === e.value ? "solid" : "dashed",
            }}
          >
            {e.label}
          </button>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
