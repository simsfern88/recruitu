// Client-safe: no "server-only" import, so this can be pulled into the
// template-picker UI (resume-card.tsx) without dragging pdfkit into the
// browser bundle. lib/pdf.ts imports the same list for rendering.
export type ResumeTemplateId = "classic" | "modern" | "minimal";

export const RESUME_TEMPLATES: { id: ResumeTemplateId; label: string; blurb: string }[] = [
  { id: "classic", label: "Classic", blurb: "Accent-colored headings, warm and versatile." },
  { id: "modern", label: "Modern", blurb: "Bold uppercase headings, sparing use of color." },
  { id: "minimal", label: "Minimal", blurb: "Black & white serif — the most traditional look." },
];
