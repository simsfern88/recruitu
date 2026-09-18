import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { unscopedDb } from "@/db";
import { sessions, type User } from "@/db/schema";

const COOKIE = "ru_session";
const TTL_DAYS = 30;

// We store only a hash of the token, so a leaked DB dump can't be replayed.
const hash = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TTL_DAYS * 864e5);
  await unscopedDb.insert(sessions).values({ id: hash(token), userId, expiresAt });

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Resolve the signed-in user, or null. Cheap enough to call per request. */
export async function getCurrentUser(): Promise<User | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;

  // users is only readable once app_current_user() is set (see db/rls.sql),
  // which is exactly what we're trying to determine here — so this goes
  // through the same narrow SECURITY DEFINER lookup as login/signup.
  const { rows } = await unscopedDb.execute<{
    id: string;
    role: User["role"];
    institution_id: string | null;
    program: string | null;
    cohort: string | null;
    email: string;
    password_hash: string | null;
    display_name: string | null;
    created_at: string;
  }>(sql`select * from auth_user_by_session(${hash(token)})`);
  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    role: row.role,
    institutionId: row.institution_id,
    program: row.program,
    cohort: row.cohort,
    email: row.email,
    passwordHash: row.password_hash,
    displayName: row.display_name,
    createdAt: new Date(row.created_at),
  };
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await unscopedDb.delete(sessions).where(eq(sessions.id, hash(token)));
  jar.delete(COOKIE);
}
