import { z } from "zod";

/** Shape of `lesson_block.data` per block type (documented in content/README.md). Safe for client code. */

const markdown = z.object({ markdown: z.string().min(1) });

export const blockDataSchemas = {
  text: markdown,
  tip: markdown.extend({ title: z.string().optional() }),
  focus: markdown.extend({ title: z.string().optional() }),
  target: markdown.extend({ title: z.string().optional() }),
  image: z.object({ fileKey: z.string().min(1), alt: z.string().default(""), caption: z.string().optional() }),
  video: z.object({ url: z.url().optional(), fileKey: z.string().optional(), caption: z.string().optional() }).refine((v) => v.url || v.fileKey, "video: url or fileKey"),
  score: z.object({ piece: z.string().min(1), note: z.string().optional() }),
  checklist: z.object({ title: z.string().optional(), items: z.array(z.string().min(1)).min(1).max(30) }),
  quiz: z
    .object({
      question: z.string().min(1),
      options: z.array(z.string().min(1)).min(2).max(6),
      answer: z.number().int().min(0),
      explain: z.string().optional(),
    })
    .refine((q) => q.answer < q.options.length, "quiz: answer must point at one of the options"),
} as const;

export type BlockType = keyof typeof blockDataSchemas;
export type BlockData<T extends BlockType> = z.infer<(typeof blockDataSchemas)[T]>;

/** Parse a block's data for its type; null when it does not match (the block is then skipped). */
export function parseBlock<T extends BlockType>(type: T, data: unknown): BlockData<T> | null {
  const r = blockDataSchemas[type].safeParse(data);
  return r.success ? (r.data as BlockData<T>) : null;
}
