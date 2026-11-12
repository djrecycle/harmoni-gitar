"use client";

import { useState } from "react";
import { LoaderCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { submitRecording } from "@/app/actions/assignments";
import { AudioRecorder, uploadRecording, type Recorded } from "@/components/recording/audio-recorder";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/input";
import { MAX_RECORDING_SECONDS } from "@/lib/rubric";
import { useT } from "@/i18n/client";

/** Record yourself playing, listen back, then send it to the teacher with an optional note. */
export function SendRecording({ assignmentId }: { assignmentId: string }) {
  const t = useT();
  const [rec, setRec] = useState<Recorded | null>(null);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [key, setKey] = useState(0);

  async function send() {
    if (!rec) return;
    setSending(true);
    try {
      const up = await uploadRecording(rec.blob);
      const r = await submitRecording({ assignmentId, fileKey: up.key, mimeType: up.mime, durationSeconds: rec.seconds, note: note || undefined });
      if (!r.ok) throw new Error(r.error);
      toast.success(r.message);
      setRec(null);
      setNote("");
      setKey((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("Could not send the recording."));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid gap-4 rounded-2xl border bg-card p-4 shadow-xs sm:p-5">
      <AudioRecorder key={key} maxSeconds={MAX_RECORDING_SECONDS} onChange={setRec} disabled={sending} />
      {rec && (
        <>
          <Field label={t("Note for your teacher (optional)")} htmlFor="note">
            <Textarea id="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder={t("e.g. Bar 5 is still hard for me.")} />
          </Field>
          <Button size="lg" onClick={send} disabled={sending}>
            {sending ? <LoaderCircle className="animate-spin" /> : <Send />} {t("Send to teacher")}
          </Button>
        </>
      )}
    </div>
  );
}
