import "./_env";

async function main() {
  const { runMigrations } = await import("../src/db/migrate");
  const { closeDb } = await import("../src/db");
  await runMigrations();
  console.log("Migrasi selesai.");
  await closeDb();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
