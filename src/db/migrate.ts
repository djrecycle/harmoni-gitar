import path from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "./index";

/** Runs the migrations in the ./drizzle folder (idempotent). */
export async function runMigrations() {
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
}
