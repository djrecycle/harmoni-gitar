/**
 * Create the first teacher account (there is no public sign-up).
 *
 *   npm run setup:teacher -- --name "Pak Rangga" --email guru@contoh.com --password "kata-sandi-kuat" [--username rangga]
 *
 * Missing arguments are read from TEACHER_NAME / TEACHER_EMAIL / TEACHER_PASSWORD / TEACHER_USERNAME (.env.local).
 * Refuses to run when a teacher already exists.
 */
import "./_env";
import { parseArgs } from "node:util";

async function main() {
  const { values } = parseArgs({
    options: { name: { type: "string" }, email: { type: "string" }, password: { type: "string" }, username: { type: "string" } },
  });
  const name = (values.name ?? process.env.TEACHER_NAME ?? "").trim();
  const email = (values.email ?? process.env.TEACHER_EMAIL ?? "").trim().toLowerCase();
  const password = values.password ?? process.env.TEACHER_PASSWORD ?? "";
  const username = (values.username ?? process.env.TEACHER_USERNAME ?? "").trim().toLowerCase() || undefined;

  const { z } = await import("zod");
  const { usernameField } = await import("../src/lib/username");
  const input = z
    .object({
      name: z.string().min(2, "--name minimal 2 karakter"),
      email: z.email("--email tidak valid"),
      password: z.string().min(8, "--password minimal 8 karakter").max(128),
      username: usernameField.optional(),
    })
    .safeParse({ name, email, password, username });
  if (!input.success) {
    console.error("Data akun guru belum lengkap:\n" + input.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n"));
    console.error('\nContoh: npm run setup:teacher -- --name "Pak Rangga" --email guru@contoh.com --password "kata-sandi-kuat"');
    process.exit(1);
  }

  const { eq } = await import("drizzle-orm");
  const { db, schema, closeDb } = await import("../src/db");
  const { auth, signupContext } = await import("../src/lib/auth");

  try {
    const [existing] = await db.select({ email: schema.user.email }).from(schema.user).where(eq(schema.user.role, "teacher")).limit(1);
    if (existing) {
      console.error(`Sudah ada akun guru (${existing.email}). Skrip ini hanya untuk membuat guru pertama.`);
      process.exitCode = 1;
      return;
    }
    const v = input.data;
    const res = await signupContext.run({ via: "setup", role: "teacher" }, () =>
      auth.api.createUser({ body: { name: v.name, email: v.email, password: v.password, data: { emailVerified: true, ...(v.username ? { username: v.username } : {}) } } }),
    );
    console.log(`Akun guru dibuat: ${res.user.name} <${res.user.email}>${v.username ? ` (username: ${v.username})` : ""}`);
    console.log("Masuk di /masuk dengan email" + (v.username ? " atau username" : "") + " dan kata sandi tadi.");
  } finally {
    await closeDb();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
