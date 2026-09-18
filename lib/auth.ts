import "server-only";
import { hash as argonHash, verify as argonVerify } from "@node-rs/argon2";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import type { User } from "@/db/schema";

// Argon2id params — sensible interactive defaults.
const OPTS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export const hashPassword = (pw: string) => argonHash(pw, OPTS);
export const verifyPassword = (digest: string, pw: string) =>
  argonVerify(digest, pw, OPTS);

/** Use at the top of any protected page/action. Redirects if not signed in. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
