import "server-only";
import PDFDocument from "pdfkit";
import type {
  CheatSheetContent,
  CoverLetterContent,
  QuestionPackContent,
  ResumeContent,
} from "./anthropic";
import { RESUME_TEMPLATES, type ResumeTemplateId } from "./resume-templates";

export { RESUME_TEMPLATES, type ResumeTemplateId };

// Used whenever a CV's own accent color wasn't detected (plain-text CV, no
// clear signal, or detection failed) — every render function below takes the
// same accentColor param, so one theme applies uniformly across all four
// document types.
const DEFAULT_ACCENT = "#1F4E79";
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function resolveAccent(accentColor?: string | null): string {
  return accentColor && HEX_RE.test(accentColor) ? accentColor : DEFAULT_ACCENT;
}

function toBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

function newDoc(): PDFKit.PDFDocument {
  return new PDFDocument({
    size: "LETTER",
    margins: { top: 56, bottom: 56, left: 56, right: 56 },
    bufferPages: true,
  });
}

function title(doc: PDFKit.PDFDocument, text: string, accent: string) {
  doc.font("Helvetica-Bold").fontSize(18).fillColor(accent).text(text);
  doc.moveDown(0.2);
}

function meta(doc: PDFKit.PDFDocument, text: string) {
  doc.font("Helvetica").fontSize(10).fillColor("#666666").text(text);
}

/** A thin accent-colored rule under the header block — the one recurring
 * visual element every document type shares. */
function headerRule(doc: PDFKit.PDFDocument, accent: string) {
  doc.moveDown(0.6);
  const y = doc.y;
  doc
    .save()
    .strokeColor(accent)
    .lineWidth(1.5)
    .moveTo(doc.page.margins.left, y)
    .lineTo(doc.page.width - doc.page.margins.right, y)
    .stroke()
    .restore();
  doc.moveDown(0.8);
}

function section(doc: PDFKit.PDFDocument, text: string, accent: string) {
  doc.moveDown(0.7);
  doc.font("Helvetica-Bold").fontSize(13).fillColor(accent).text(text);
  doc.moveDown(0.3);
  doc.fillColor("#000000");
}

function paragraph(doc: PDFKit.PDFDocument, text: string) {
  doc.font("Helvetica").fontSize(10.5).fillColor("#222222").text(text, { lineGap: 3 });
  doc.moveDown(0.5);
}

function bulletList(doc: PDFKit.PDFDocument, items: string[]) {
  doc.font("Helvetica").fontSize(10.5).fillColor("#222222");
  for (const item of items) {
    doc.text(`•  ${item}`, { lineGap: 2 });
  }
  doc.moveDown(0.4);
}

const roleLine = (jobTitle: string | null, company: string | null) =>
  [jobTitle, company ? `at ${company}` : null].filter(Boolean).join(" ");

/** Contact line: the pieces that exist, joined with a middle dot — never a
 * fixed set of fields, since most CVs only give some of email/phone/etc. */
function contactLine(contact: ResumeContent["contact"]): string {
  return [contact.email, contact.phone, contact.location, ...(contact.links ?? [])]
    .filter(Boolean)
    .join("   ·   ");
}

/**
 * Every template stays within ATS-safe bounds by construction: single
 * column, real selectable text (never an image), standard PDF base fonts
 * (Helvetica/Times — no embedded/decorative fonts), fixed section headings
 * (never AI-chosen), and no tables/text-boxes/headers-footers. Templates only
 * vary typography and color — never layout structure — so "professional
 * variety" never trades away parseability.
 */
type ResumeStyle = {
  bodyFont: string;
  boldFont: string;
  heading: (s: string) => string;
  nameColor: string;
  headingColor: string;
  ruleColor: string;
  subColor: string;
};

function resumeStyle(templateId: ResumeTemplateId, accentColor?: string | null): ResumeStyle {
  const accent = resolveAccent(accentColor);
  switch (templateId) {
    case "modern":
      return {
        bodyFont: "Helvetica",
        boldFont: "Helvetica-Bold",
        heading: (s) => s.toUpperCase(),
        nameColor: "#111111",
        headingColor: "#111111",
        ruleColor: accent,
        subColor: "#666666",
      };
    case "minimal":
      return {
        bodyFont: "Times-Roman",
        boldFont: "Times-Bold",
        heading: (s) => s,
        nameColor: "#111111",
        headingColor: "#111111",
        ruleColor: "#111111",
        subColor: "#444444",
      };
    case "classic":
    default:
      return {
        bodyFont: "Helvetica",
        boldFont: "Helvetica-Bold",
        heading: (s) => s,
        nameColor: accent,
        headingColor: accent,
        ruleColor: accent,
        subColor: "#666666",
      };
  }
}

export async function renderResumePdf(
  content: ResumeContent,
  accentColor?: string | null,
  templateId: ResumeTemplateId = "classic",
): Promise<Buffer> {
  const style = resumeStyle(templateId, accentColor);
  const doc = newDoc();

  doc.font(style.boldFont).fontSize(20).fillColor(style.nameColor).text(content.name);
  if (content.headline) {
    doc.font(style.bodyFont).fontSize(11.5).fillColor(style.subColor).text(content.headline);
  }
  const contact = contactLine(content.contact);
  if (contact) {
    doc.moveDown(0.15);
    doc.font(style.bodyFont).fontSize(10).fillColor(style.subColor).text(contact);
  }

  doc.moveDown(0.6);
  const ruleY = doc.y;
  doc
    .save()
    .strokeColor(style.ruleColor)
    .lineWidth(1.5)
    .moveTo(doc.page.margins.left, ruleY)
    .lineTo(doc.page.width - doc.page.margins.right, ruleY)
    .stroke()
    .restore();
  doc.moveDown(0.8);

  const heading = (text: string) => {
    doc.moveDown(0.7);
    doc.font(style.boldFont).fontSize(12.5).fillColor(style.headingColor).text(style.heading(text));
    doc.moveDown(0.3);
    doc.fillColor("#000000");
  };

  const inlineList = (items: string[]) => {
    doc.font(style.bodyFont).fontSize(10.5).fillColor("#222222").text(items.join("   •   "), { lineGap: 3 });
    doc.moveDown(0.4);
  };

  if (content.summary) {
    doc.font(style.bodyFont).fontSize(10.5).fillColor("#222222").text(content.summary, { lineGap: 3 });
    doc.moveDown(0.5);
  }

  if (content.skills.length > 0) {
    heading("Skills");
    inlineList(content.skills);
  }

  if (content.experience.length > 0) {
    heading("Experience");
    content.experience.forEach((job, i) => {
      if (i > 0) doc.moveDown(0.5);
      doc.font(style.boldFont).fontSize(11).fillColor("#111111").text(`${job.title} — ${job.company}`);
      const sub = [job.location, job.dates].filter(Boolean).join("   ·   ");
      if (sub) doc.font(style.bodyFont).fontSize(9.5).fillColor(style.subColor).text(sub);
      doc.moveDown(0.2);
      doc.font(style.bodyFont).fontSize(10.5).fillColor("#222222");
      for (const b of job.bullets) doc.text(`•  ${b}`, { lineGap: 2 });
      doc.moveDown(0.4);
    });
  }

  if (content.education.length > 0) {
    heading("Education");
    content.education.forEach((edu, i) => {
      if (i > 0) doc.moveDown(0.4);
      const line = [edu.credential, edu.school].filter(Boolean).join(", ") || edu.school;
      doc.font(style.boldFont).fontSize(10.5).fillColor("#111111").text(line);
      if (edu.dates) doc.font(style.bodyFont).fontSize(9.5).fillColor(style.subColor).text(edu.dates);
      if (edu.details) {
        doc.font(style.bodyFont).fontSize(10).fillColor("#222222").text(edu.details, { lineGap: 2 });
      }
    });
  }

  if (content.certifications?.length) {
    heading("Certifications");
    inlineList(content.certifications);
  }

  if (content.licenses?.length) {
    heading("Licenses");
    inlineList(content.licenses);
  }

  if (content.languages?.length) {
    heading("Languages");
    inlineList(content.languages);
  }

  return toBuffer(doc);
}

export async function renderCoverLetterPdf(
  displayName: string | null,
  jobTitle: string | null,
  company: string | null,
  content: CoverLetterContent,
  accentColor?: string | null,
): Promise<Buffer> {
  const accent = resolveAccent(accentColor);
  const doc = newDoc();
  title(doc, "Cover Letter", accent);
  meta(doc, [displayName, roleLine(jobTitle, company)].filter(Boolean).join(" — "));
  headerRule(doc, accent);
  paragraph(doc, content.letter);
  return toBuffer(doc);
}

export async function renderCheatSheetPdf(
  jobTitle: string | null,
  company: string | null,
  content: CheatSheetContent,
  accentColor?: string | null,
): Promise<Buffer> {
  const accent = resolveAccent(accentColor);
  const doc = newDoc();
  title(doc, "Interview Cheat Sheet", accent);
  meta(doc, roleLine(jobTitle, company));
  headerRule(doc, accent);

  section(doc, "Key Concepts", accent);
  bulletList(doc, content.keyConcepts);

  section(doc, "Company Insights", accent);
  bulletList(doc, content.companyInsights);

  if (content.productContext?.length) {
    section(doc, "Product & Market Context", accent);
    bulletList(doc, content.productContext);
  }

  if (content.cultureAndValues?.length) {
    section(doc, "Culture & Values", accent);
    bulletList(doc, content.cultureAndValues);
  }

  section(doc, "Talking Points", accent);
  bulletList(doc, content.talkingPoints);

  if (content.questionsToAsk?.length) {
    section(doc, "Smart Questions to Ask", accent);
    bulletList(doc, content.questionsToAsk);
  }

  return toBuffer(doc);
}

export async function renderQuestionPackPdf(
  jobTitle: string | null,
  company: string | null,
  content: QuestionPackContent,
  accentColor?: string | null,
): Promise<Buffer> {
  const accent = resolveAccent(accentColor);
  const doc = newDoc();
  title(doc, "Interview Q&A Prep", accent);
  meta(doc, `${roleLine(jobTitle, company)} — ${content.questions.length} questions`);
  headerRule(doc, accent);

  content.questions.forEach((q, i) => {
    if (i > 0) doc.moveDown(0.7);
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(accent)
      .text(q.category.toUpperCase().replace("-", " "));
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#111111").text(q.question);
    doc.moveDown(0.15);
    doc.font("Helvetica").fontSize(10.5).fillColor("#222222")
      .text(q.suggestedAnswer, { lineGap: 2 });
  });

  return toBuffer(doc);
}
