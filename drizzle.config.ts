import type { Config } from "drizzle-kit";

// Migrations run as an OWNER/admin role (they create types & tables). The app
// itself connects as the restricted `recruitu_app` role via DATABASE_URL so RLS
// applies. Set ADMIN_DATABASE_URL for pushes; falls back to DATABASE_URL.
export default {
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.ADMIN_DATABASE_URL ?? process.env.DATABASE_URL!,
  },
} satisfies Config;
