export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Docker sets AUTO_MIGRATE=1; with `npm run dev` run `npm run db:migrate` yourself.
  if (process.env.AUTO_MIGRATE === "1") {
    const { runMigrations } = await import("@/db/migrate");
    await runMigrations();
  }
}
