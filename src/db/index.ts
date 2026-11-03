import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type Db = ReturnType<typeof create>["db"];

type Global = typeof globalThis & { __harmoniGitar?: ReturnType<typeof create> };

/** One connection pool per process (safe against Next.js hot reload). PostgreSQL only: see DATABASE_URL in .env.example. */
function create() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
  const pool = new Pool({ connectionString: url, max: Number(process.env.DB_POOL_MAX ?? 10) });
  return { db: drizzle(pool, { schema }), close: () => pool.end() };
}

const g = globalThis as Global;
g.__harmoniGitar ??= create();

export const db = g.__harmoniGitar.db;
export const closeDb = () => g.__harmoniGitar!.close();
export { schema };
