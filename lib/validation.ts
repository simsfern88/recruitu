import { z } from "zod";

export const credentials = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Use at least 8 characters."),
  displayName: z.string().trim().min(1).max(120).optional(),
});

// Capture accepts any ONE of: pasted text, a URL, or an uploaded screenshot.
// The screenshot arrives as a separate form file; this validates the text side.
export const captureInput = z
  .object({
    sourceType: z.enum(["paste", "url", "screenshot_ocr"]),
    text: z.string().trim().optional(),
    url: z.string().url().optional(),
  })
  .refine(
    (v) =>
      (v.sourceType === "paste" && !!v.text) ||
      (v.sourceType === "url" && !!v.url) ||
      v.sourceType === "screenshot_ocr",
    { message: "Provide the job text, a URL, or a screenshot." },
  );

export type CaptureInput = z.infer<typeof captureInput>;
