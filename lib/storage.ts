import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Minimal storage seam. Dev writes to ./.storage; production swaps this module
 * for an S3-compatible implementation with the same signatures. Callers only
 * ever hold an opaque `ref`, never a path — so the backend can change without
 * touching the rest of the app.
 */

const ROOT = path.join(process.cwd(), ".storage");

export async function putFile(bytes: Buffer, ext: string): Promise<string> {
  const ref = `${randomUUID()}${ext ? `.${ext.replace(/^\./, "")}` : ""}`;
  await mkdir(ROOT, { recursive: true });
  await writeFile(path.join(ROOT, ref), bytes);
  return ref;
}

export async function getFile(ref: string): Promise<Buffer> {
  return readFile(path.join(ROOT, path.basename(ref)));
}
