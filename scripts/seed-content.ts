/**
 * Load the curriculum from content/pieces/*.json (+ .musicxml) and content/units/*.json into the database
 * (safe to run again). Each piece's MusicXML is copied to file storage as score/<slug>-<hash>.musicxml.
 *
 *   npm run db:seed
 *
 * Units are matched by slug, lessons by (unit, slug), blocks and Cek Unit items by position. Matching rows are
 * updated in place so student progress keeps pointing at them; extra blocks/check items are removed. Lessons
 * that are no longer in a file are left alone (only reported), because deleting them would delete progress.
 * Lessons and pieces the teacher made in the app (created_by set) are never changed; a file that uses one of their
 * slugs is an error. The teacher's lessons in a unit are numbered after the unit's file lessons.
 */
import "./_env";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

async function main() {
  const { and, asc, eq, gt, isNotNull, isNull, notInArray } = await import("drizzle-orm");
  const { db, schema, closeDb } = await import("../src/db");
  const { pieceFileSchema, unitFileSchema } = await import("../src/lib/content");
  const { deleteFile, saveFile } = await import("../src/lib/storage");
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

  // Pieces: validate all first, like the units.
  const pieceDir = path.join(process.cwd(), "content", "pieces");
  const pieces = fs
    .readdirSync(pieceDir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => {
      const parsed = pieceFileSchema.safeParse(JSON.parse(fs.readFileSync(path.join(pieceDir, f), "utf8")));
      if (!parsed.success) throw new Error(`pieces/${f} tidak valid:\n` + parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n"));
      if (`${parsed.data.slug}.json` !== f) throw new Error(`pieces/${f}: slug "${parsed.data.slug}" harus sama dengan nama file`);
      const xmlPath = path.join(pieceDir, `${parsed.data.slug}.musicxml`);
      const xml = fs.existsSync(xmlPath) ? fs.readFileSync(xmlPath) : null;
      return { piece: parsed.data, xml };
    });
  const pieceSlugs = new Set(pieces.map((p) => p.piece.slug));
  for (const { file, unit: u } of units)
    for (const l of u.lessons)
      for (const b of l.blocks)
        if (b.type === "score" && !pieceSlugs.has(String(b.data.piece)))
          console.warn(`  ! ${file}, pelajaran "${l.slug}": blok score merujuk karya "${b.data.piece}" yang tidak ada di content/pieces`);

  try {
    for (const { piece: p, xml } of pieces) {
      const [old] = await db.select().from(S.piece).where(eq(S.piece.slug, p.slug)).limit(1);
      if (old?.createdBy) throw new Error(`pieces/${p.slug}: slug ini sudah dipakai partitur buatan guru di aplikasi. Ganti slug file.`);
      // The key changes with the content, so browsers never keep an old cached copy. The file is always written:
      // `npm run dev` (./uploads) and Docker (a volume) keep their files apart but share this database.
      let key: string | null = null;
      if (xml) {
        key = `score/${p.slug}-${createHash("sha256").update(xml).digest("hex").slice(0, 10)}.musicxml`;
        await saveFile(key, xml, "application/vnd.recordare.musicxml+xml");
      }
      const fields = {
        title: p.title,
        composer: p.composer ?? null,
        musicXmlFileKey: key,
        defaultBpm: p.defaultBpm,
        stageBpm: p.stageBpm,
        timeSignature: p.timeSignature,
        copyrightStatus: p.copyrightStatus,
        sourceNote: p.sourceNote ?? null,
      };
      await db.insert(S.piece).values({ slug: p.slug, ...fields }).onConflictDoUpdate({ target: S.piece.slug, set: fields });
      if (old?.musicXmlFileKey && old.musicXmlFileKey !== key) await deleteFile(old.musicXmlFileKey);
      console.log(`pieces/${p.slug}: ${p.title} (${p.copyrightStatus})${xml ? "" : " — belum ada .musicxml"}`);
    }

    await db.transaction(async (tx) => {
      for (const { file, unit: u } of units) {
        const fields = { order: u.order, title: u.title, color: u.color ?? null, description: u.description ?? null };
        const [row] = await tx
          .insert(S.unit)
          .values({ slug: u.slug, ...fields })
          .onConflictDoUpdate({ target: S.unit.slug, set: fields })
          .returning({ id: S.unit.id });
        const unitId = row.id;

        const teacherOwned = await tx
          .select({ id: S.lesson.id, slug: S.lesson.slug })
          .from(S.lesson)
          .where(and(eq(S.lesson.unitId, unitId), isNotNull(S.lesson.createdBy)))
          .orderBy(asc(S.lesson.order));
        const clash = u.lessons.find((l) => teacherOwned.some((o) => o.slug === l.slug));
        if (clash) throw new Error(`${file}: pelajaran "${clash.slug}" sudah dipakai materi buatan guru di unit ini. Ganti slug di file.`);

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

        for (const [k, o] of teacherOwned.entries()) await tx.update(S.lesson).set({ order: u.lessons.length + k + 1 }).where(eq(S.lesson.id, o.id));

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
          .where(and(eq(S.lesson.unitId, unitId), isNull(S.lesson.createdBy), slugs.length ? notInArray(S.lesson.slug, slugs) : undefined));
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
