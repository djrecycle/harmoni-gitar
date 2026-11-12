import { Crosshair, Lightbulb, Music, Target } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { Illustration } from "@/components/illustrations";
import { Checklist } from "@/components/lesson/checklist";
import { Quiz } from "@/components/lesson/quiz";
import { PieceCard } from "@/components/score/piece-card";
import { parseBlock, type BlockType } from "@/lib/blocks";
import type { PieceView } from "@/lib/pieces";
import { cn } from "@/lib/utils";
import { getT } from "@/i18n/server";

export type LessonBlockRow = { id: string; type: string; data: Record<string, unknown> };

const callout = {
  tip: { Icon: Lightbulb, title: "Tip", className: "border-accent/40 bg-warning-soft" },
  focus: { Icon: Crosshair, title: "Pay attention", className: "border-primary/30 bg-primary-soft" },
  target: { Icon: Target, title: "Target", className: "border-success/30 bg-success-soft" },
} as const;

/** All blocks of a lesson, top to bottom. A block whose data does not match its type is skipped. */
export async function LessonBlocks({
  blocks,
  checklists,
  pieces,
  readOnly,
}: {
  blocks: LessonBlockRow[];
  checklists: Map<string, number[]>;
  /** Pieces this viewer may open, by slug. */
  pieces: Map<string, PieceView>;
  readOnly?: boolean;
}) {
  const t = await getT();
  return (
    <div className="grid gap-4">
      {blocks.map((b) => {
        const type = b.type as BlockType;
        switch (type) {
          case "text": {
            const d = parseBlock("text", b.data);
            return d && <Markdown key={b.id}>{d.markdown}</Markdown>;
          }
          case "tip":
          case "focus":
          case "target": {
            const d = parseBlock(type, b.data);
            if (!d) return null;
            const c = callout[type];
            return (
              <div key={b.id} className={cn("rounded-xl border p-4", c.className)}>
                <p className="mb-1.5 flex items-center gap-2 text-sm font-bold">
                  <c.Icon className="size-4.5" /> {d.title ?? t(c.title)}
                </p>
                <Markdown className="text-sm">{d.markdown}</Markdown>
              </div>
            );
          }
          case "checklist": {
            const d = parseBlock("checklist", b.data);
            return d && <Checklist key={b.id} blockId={b.id} title={d.title} items={d.items} checked={checklists.get(b.id) ?? []} readOnly={readOnly} />;
          }
          case "quiz": {
            const d = parseBlock("quiz", b.data);
            return d && <Quiz key={b.id} question={d.question} options={d.options} answer={d.answer} explain={d.explain} />;
          }
          case "image": {
            const d = parseBlock("image", b.data);
            return (
              d && (
                <figure key={b.id} className="overflow-hidden rounded-xl border bg-card">
                  {/* A plain <img>: the file is served by /api/files after an access check, not by the image optimizer. */}
                  <img src={`/api/files/${d.fileKey}`} alt={d.alt} className="w-full" loading="lazy" />
                  {d.caption && <figcaption className="p-3 text-sm text-muted-foreground">{d.caption}</figcaption>}
                </figure>
              )
            );
          }
          case "illustration": {
            const d = parseBlock("illustration", b.data);
            return d && <Illustration key={b.id} name={d.name} caption={d.caption} />;
          }
          case "video": {
            const d = parseBlock("video", b.data);
            if (!d) return null;
            return (
              <figure key={b.id} className="overflow-hidden rounded-xl border bg-card">
                <video src={d.fileKey ? `/api/files/${d.fileKey}` : d.url} controls preload="metadata" playsInline className="w-full" />
                {d.caption && <figcaption className="p-3 text-sm text-muted-foreground">{d.caption}</figcaption>}
              </figure>
            );
          }
          case "score": {
            const d = parseBlock("score", b.data);
            const piece = d && pieces.get(d.piece);
            if (piece) return <PieceCard key={b.id} piece={piece} note={d.note} withStages={!readOnly} />;
            // No notation yet (or not shown because its copyright status is unclear).
            return (
              d && (
                <div key={b.id} className="flex items-start gap-3 rounded-xl border border-dashed bg-card p-4 text-sm">
                  <Music className="mt-0.5 size-5 shrink-0 text-primary" />
                  <p>
                    {d.note && <span className="font-semibold">{d.note}. </span>}
                    {t("The interactive notation for this exercise is coming soon. Use the printed module for now.")}
                  </p>
                </div>
              )
            );
          }
          default:
            return null;
        }
      })}
    </div>
  );
}
