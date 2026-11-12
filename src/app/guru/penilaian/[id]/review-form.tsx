"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { saveReview } from "@/app/actions/assignments";
import { AudioRecorder, uploadRecording, type Recorded } from "@/components/recording/audio-recorder";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/input";
import { LEVELS, MAX_VOICE_COMMENT_SECONDS, RUBRIC, type RubricKey, type RubricScores } from "@/lib/rubric";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/client";

/** Score a recording on the module's 5-aspect rubric, with a written and/or spoken comment. */
export function ReviewForm({
  recordingId,
  studentId,
  initial,
  targetStage,
  nextHref,
}: {
  recordingId: string;
  studentId: string;
  initial: { scores: Partial<RubricScores>; comment: string; audioKey: string | null; done: boolean } | null;
  /** The assignment's target stage, when it has a piece and one. */
  targetStage: number | null;
  /** Where to go after saving (the next recording waiting, or the queue). */
  nextHref: string;
}) {
  const t = useT();
  const router = useRouter();
  const [scores, setScores] = useState<Partial<RubricScores>>(initial?.scores ?? {});
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [audio, setAudio] = useState<Recorded | null>(null);
  const [keepAudio, setKeepAudio] = useState(Boolean(initial?.audioKey));
  const [markDone, setMarkDone] = useState(initial?.done ?? true);
  const [confirmStage, setConfirmStage] = useState(true);
  const [saving, setSaving] = useState(false);
  const complete = RUBRIC.every((r) => scores[r.key]);

  async function save() {
    if (!complete) return void toast.error(t("Give every aspect a score from 1 to 4."));
    setSaving(true);
    try {
      let audioKey: string | null | undefined = undefined;
      if (audio) audioKey = (await uploadRecording(audio.blob, studentId)).key;
      else if (initial?.audioKey && !keepAudio) audioKey = null;
      const r = await saveReview(recordingId, {
        scores: scores as RubricScores,
        comment: comment || undefined,
        audioKey,
        audioSeconds: audio?.seconds,
        markDone,
        confirmStage: Boolean(targetStage) && confirmStage,
      });
      if (!r.ok) throw new Error(r.error);
      toast.success(r.message);
      router.push(nextHref);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("Could not save the review."));
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-3">
        {RUBRIC.map((r) => (
          <fieldset key={r.key} className="grid gap-2 rounded-xl border bg-card p-3">
            <legend className="sr-only">{t(r.label)}</legend>
            <div>
              <p className="font-bold">{t(r.label)}</p>
              <p className="text-xs text-muted-foreground">{t(r.hint)}</p>
            </div>
            <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label={t(r.label)}>
              {LEVELS.map((l) => {
                const on = scores[r.key as RubricKey] === l.value;
                return (
                  <button
                    key={l.value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setScores({ ...scores, [r.key]: l.value })}
                    className={cn(
                      "grid min-h-14 place-items-center gap-0.5 rounded-lg border px-1 py-1.5 text-center transition-colors",
                      on ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                    )}
                  >
                    <span className="text-lg font-extrabold leading-none">{l.value}</span>
                    <span className={cn("text-[0.65rem] leading-tight", on ? "text-primary-foreground/85" : "text-muted-foreground")}>{t(l.label)}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>

      <Field label={t("Comment for the student")} htmlFor="comment" hint={t("What went well, and one thing to work on next.")}>
        <Textarea id="comment" rows={4} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={3000} />
      </Field>

      <div className="grid gap-2 rounded-xl border bg-card p-3">
        <p className="text-sm font-semibold">{t("Voice comment (optional)")}</p>
        {initial?.audioKey && keepAudio && !audio ? (
          <div className="grid gap-2">
            <audio controls preload="none" src={`/api/files/${initial.audioKey}`} className="w-full" />
            <div>
              <Button type="button" size="sm" variant="ghost" onClick={() => setKeepAudio(false)}>
                <Trash2 /> {t("Remove voice comment")}
              </Button>
            </div>
          </div>
        ) : (
          <AudioRecorder maxSeconds={MAX_VOICE_COMMENT_SECONDS} onChange={setAudio} disabled={saving} compact />
        )}
      </div>

      <div className="grid gap-2">
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={markDone} onChange={(e) => setMarkDone(e.target.checked)} />
          {t("The assignment is done (otherwise the student may record it again)")}
        </label>
        {markDone && targetStage && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={confirmStage} onChange={(e) => setConfirmStage(e.target.checked)} />
            {t("Record stage {0} of this piece as reached and checked", targetStage)}
          </label>
        )}
      </div>

      <Button size="lg" onClick={save} disabled={saving || !complete}>
        {saving ? <LoaderCircle className="animate-spin" /> : <Save />} {t("Save review")}
      </Button>
    </div>
  );
}
