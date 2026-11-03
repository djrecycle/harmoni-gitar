/**
 * Load the curriculum from content/units/*.json into the database (safe to run again).
 *
 *   npm run db:seed
 *
 * Units are matched by slug, lessons by (unit, slug), blocks and Cek Unit items by position. Matching rows are
 * updated in place so student progress keeps pointing at them; extra blocks/check items are removed. Lessons
 * that are no longer in a file are left alone (only reported), because deleting them would delete progress.
 */
import "./_env";
import fs from "node:fs";
import path from "node:path";

async function main() {
  const { and, eq, gt, notInArray } = await import("drizzle-orm");
  const { db, schema, closeDb } = await import("../src/db");
  const { unitFileSchema } = await import("../src/lib/content");
  const S = schema;

  const dir = path.join(process.cwd(), "content", "units");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  if (!files.length) throw new Error(`Tidak ada file JSON di ${dir}`);

  // Validate everything first, so a typo in one file changes nothing.
  const units = files.map((f) => {
    const parsed = unitFileSchema.safeParse(JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));
    if (!parsed.success) {
      throw new Error(`${f} tidak valid:\n` + parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n"));
    }
    return { file: f, unit: parsed.data };
  });

  try {
    await db.transaction(async (tx) => {
      for (const { file, unit: u } of units) {
        const fields = { order: u.order, title: u.title, color: u.color ?? null, description: u.description ?? null };
        const [row] = await tx
          .insert(S.unit)
          .values({ slug: u.slug, ...fields })
          .onConflictDoUpdate({ target: S.unit.slug, set: fields })
          .returning({ id: S.unit.id });
        const unitId = row.id;

        for (const [i, l] of u.lessons.entries()) {
          const lessonFields = {
            order: i + 1,
            title: l.title,
            kind: l.kind,
            summary: l.summary ?? null,
            estimatedMinutes: l.estimatedMinutes ?? null,
            published: l.published,
          };
          const [lr] = await tx
            .insert(S.lesson)
            .values({ unitId, slug: l.slug, ...lessonFields })
            .onConflictDoUpdate({ target: [S.lesson.unitId, S.lesson.slug], set: lessonFields })
            .returning({ id: S.lesson.id });

          for (const [j, b] of l.blocks.entries()) {
            await tx
              .insert(S.lessonBlock)
              .values({ lessonId: lr.id, order: j + 1, type: b.type, data: b.data })
              .onConflictDoUpdate({ target: [S.lessonBlock.lessonId, S.lessonBlock.order], set: { type: b.type, data: b.data } });
          }
          await tx.delete(S.lessonBlock).where(and(eq(S.lessonBlock.lessonId, lr.id), gt(S.lessonBlock.order, l.blocks.length)));
        }

        for (const [k, text] of u.checkItems.entries()) {
          await tx
            .insert(S.unitCheckItem)
            .values({ unitId, order: k + 1, text })
            .onConflictDoUpdate({ target: [S.unitCheckItem.unitId, S.unitCheckItem.order], set: { text } });
        }
        await tx.delete(S.unitCheckItem).where(and(eq(S.unitCheckItem.unitId, unitId), gt(S.unitCheckItem.order, u.checkItems.length)));

        const slugs = u.lessons.map((l) => l.slug);
        const orphans = await tx
          .select({ slug: S.lesson.slug })
          .from(S.lesson)
          .where(slugs.length ? and(eq(S.lesson.unitId, unitId), notInArray(S.lesson.slug, slugs)) : eq(S.lesson.unitId, unitId));
        const blocks = u.lessons.reduce((n, l) => n + l.blocks.length, 0);
        console.log(`${file}: unit "${u.title}", ${u.lessons.length} pelajaran, ${blocks} blok, ${u.checkItems.length} butir Cek Unit`);
        if (orphans.length) console.warn(`  ! Pelajaran di database yang tidak ada di file (dibiarkan): ${orphans.map((o) => o.slug).join(", ")}`);
      }
    });
    console.log("Seed kurikulum selesai.");
  } finally {
    await closeDb();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
