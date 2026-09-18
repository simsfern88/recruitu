import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * A single pool for the app. The application connects as a NON-superuser,
 * non-BYPASSRLS role so the policies in rls.sql actually bite.
 */
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const db = drizzle(pool, { schema });
export { schema };

/**
 * Run a unit of work with RLS scoped to a specific user.
 *
 * We grab one connection, set `app.current_user_id` as a LOCAL setting inside a
 * transaction (so it can never leak to another pooled request), run the work,
 * and commit. Every query inside `fn` is filtered by the policies keyed on that
 * id. This is the single choke point through which all user data flows.
 */
export async function withUser<T>(
  userId: string,
  fn: (tx: typeof db) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('app.current_user_id', ${userId}, true)`,
    );
    return fn(tx as unknown as typeof db);
  });
}

/**
 * For the few operations that must run WITHOUT a user context — signup, login
 * lookups, session validation. These touch only the auth tables. Keep this
 * surface tiny and audited; never route user-data reads through it.
 */
export const unscopedDb = db;
