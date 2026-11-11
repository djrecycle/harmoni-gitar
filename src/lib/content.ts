import { z } from "zod";
import { copyrightStatusEnum, lessonBlockTypeEnum, lessonKindEnum } from "@/db/schema";
import { blockDataSchemas } from "./blocks";

/** Format of content/units/*.json (documented in content/README.md). */

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "slug: lowercase letters, numbers and dashes only");

export const blockFileSchema = z
  .object({
    type: z.enum(lessonBlockTypeEnum.enumValues),
    data: z.record(z.string(), z.unknown()).default({}),
  })
  .superRefine((b, ctx) => {
    // Check the data against its block type, so a broken block is caught by `npm run db:seed`, not by a student.
    const r = blockDataSchemas[b.type].safeParse(b.data);
    if (!r.success) for (const i of r.error.issues) ctx.addIssue({ code: "custom", path: ["data", ...i.path.map(String)], message: i.message });
  });

export const lessonFileSchema = z.object({
  slug,
  title: z.string().min(1),
  kind: z.enum(lessonKindEnum.enumValues),
  summary: z.string().optional(),
  estimatedMinutes: z.number().int().positive().optional(),
  published: z.boolean().default(false),
  blocks: z.array(blockFileSchema).default([]),
});

export const unitFileSchema = z.object({
  slug,
  order: z.number().int().positive(),
  title: z.string().min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "color: hex like #0f766e").optional(),
  description: z.string().optional(),
  lessons: z.array(lessonFileSchema).default([]),
  checkItems: z.array(z.string().min(1)).default([]),
});

export type UnitFile = z.infer<typeof unitFileSchema>;

const bpm = z.number().int().min(20).max(300);

/** Format of content/pieces/<slug>.json (documented in content/pieces/README.md). */
export const pieceFileSchema = z
  .object({
    slug,
    title: z.string().min(1),
    composer: z.string().optional(),
    defaultBpm: bpm,
    stageBpm: z.object({ "1": bpm, "2": bpm, "3": bpm }),
    timeSignature: z.string().regex(/^\d+\/\d+$/, "timeSignature: like 4/4"),
    copyrightStatus: z.enum(copyrightStatusEnum.enumValues),
    sourceNote: z.string().optional(),
  })
  .refine((p) => p.stageBpm["1"] <= p.stageBpm["2"] && p.stageBpm["2"] <= p.stageBpm["3"], "stageBpm: stage 1 <= stage 2 <= stage 3");

export type PieceFile = z.infer<typeof pieceFileSchema>;
