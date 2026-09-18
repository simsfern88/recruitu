"use server";

import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { unscopedDb } from "@/db";
import { users } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { createSession, destroySession } from "@/lib/session";
import { credentials } from "@/lib/validation";

type State = { error?: string };

// users is only readable/writable once app_current_user() is set (see
// db/rls.sql), which isn't true yet during signup/login. auth_user_by_email
// is a narrow SECURITY DEFINER lookup made exactly for this.
async function findUserByEmail(email: string) {
  const { rows } = await unscopedDb.execute<{
    id: string;
    password_hash: string | null;
  }>(sql`select id, password_hash from auth_user_by_email(${email})`);
  return rows[0];
}

export async function signup(_prev: State, form: FormData): Promise<State> {
  const parsed = credentials.safeParse({
    email: form.get("email"),
    password: form.get("password"),
    displayName: form.get("displayName") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details." };
  }
  const { email, password, displayName } = parsed.data;

  const existing = await findUserByEmail(email.toLowerCase());
  if (existing) return { error: "That email is already registered." };

  // Generate the id here rather than relying on the DB default + RETURNING:
  // RETURNING re-checks the new row against the (correctly) restrictive read
  // policy, which no identity has been established to satisfy yet.
  const id = randomUUID();
  await unscopedDb.insert(users).values({
    id,
    email: email.toLowerCase(),
    passwordHash: await hashPassword(password),
    displayName: displayName ?? null,
    role: "seeker",
  });

  await createSession(id);
  redirect("/onboarding");
}

export async function login(_prev: State, form: FormData): Promise<State> {
  const parsed = credentials.safeParse({
    email: form.get("email"),
    password: form.get("password"),
  });
  if (!parsed.success) return { error: "Enter your email and password." };

  const { email, password } = parsed.data;
  const user = await findUserByEmail(email.toLowerCase());

  // Uniform failure message; don't reveal whether the email exists.
  const bad = { error: "Email or password is incorrect." };
  if (!user?.password_hash) return bad;
  if (!(await verifyPassword(user.password_hash, password))) return bad;

  await createSession(user.id);
  redirect("/dashboard");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}
