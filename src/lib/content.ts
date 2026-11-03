import { z } from "zod";
import { lessonBlockTypeEnum, lessonKindEnum } from "@/db/schema";

/** Format of content/units/*.json (documented in content/README.md). */

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "slug: lowercase letters, numbers and dashes only");

export const blockFileSchema = z.object({
  type: z.enum(lessonBlockTypeEnum.enumValues),
  data: z.record(z.string(), z.unknown()).default({}),
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
