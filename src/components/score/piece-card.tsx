import { Music } from "lucide-react";
import { Badge } from "@/components/ui/misc";
import type { PieceView } from "@/lib/pieces";
import { getT } from "@/i18n/server";
import { PieceStages } from "./piece-stages";
import { ScorePlayer } from "./score-player";

const STATUS_LABEL: Record<string, string> = { public_domain: "Public domain", own_work: "Own work", licensed: "Licensed", unknown: "Unknown" };

/** A piece with its player, and (for a student) the three stage boxes. */
export async function PieceCard({ piece, note, withStages = true }: { piece: PieceView; note?: string; withStages?: boolean }) {
  const t = await getT();
  const { stage } = piece.progress;
  const initialBpm = piece.stageBpm[String(Math.min(3, stage + 1)) as "1" | "2" | "3"];
  return (
    <section className="grid gap-3 rounded-2xl border bg-card p-3 shadow-xs sm:p-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
            <Music className="size-5" />
          </span>
          <div className="min-w-0">
            <h3 className="font-bold leading-tight">{piece.title}</h3>
            <p className="text-xs text-muted-foreground">
              {[piece.composer, piece.timeSignature, note && note !== piece.title ? note : null].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        <Badge tone="neutral">{t(STATUS_LABEL[piece.copyrightStatus] ?? piece.copyrightStatus)}</Badge>
      </header>
      <ScorePlayer fileUrl={piece.fileUrl} defaultBpm={piece.defaultBpm} stageBpm={piece.stageBpm} initialBpm={withStages ? initialBpm : piece.defaultBpm} />
      {withStages && <PieceStages pieceId={piece.id} stageBpm={piece.stageBpm} progress={piece.progress} />}
      {piece.sourceNote && <p className="text-xs text-muted-foreground">{piece.sourceNote}</p>}
    </section>
  );
}
