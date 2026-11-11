"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileMusic } from "lucide-react";
import { uploadScore } from "@/app/actions/scores";
import { FormMessage } from "@/components/form-message";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit";
import type { ActionResult } from "@/lib/action-result";
import { useT } from "@/i18n/client";
import { loadAlphaTab } from "./alphatab";

type Existing = {
  id: string;
  slug: string;
  title: string;
  composer: string;
  defaultBpm: number;
  timeSignature: string;
  stage1: number;
  stage2: number;
  stage3: number;
  copyrightStatus: string;
  sourceNote: string;
};

const STATUSES = [
  { value: "public_domain", label: "Public domain" },
  { value: "own_work", label: "Own work" },
  { value: "licensed", label: "Licensed" },
  { value: "unknown", label: "Unknown" },
];

/**
 * Upload a score from MuseScore (MusicXML), or change an uploaded one. When a file is chosen, alphaTab reads it
 * in the browser to check it and to fill in the title, tempo and time signature.
 */
export function UploadScoreForm({ piece }: { piece: Existing | null }) {
  const t = useT();
  const router = useRouter();
  const [state, action] = useActionState<ActionResult<{ slug: string }>, FormData>(uploadScore.bind(null, piece?.id ?? null), { ok: false });
  const [f, setF] = useState({
    title: piece?.title ?? "",
    composer: piece?.composer ?? "",
    defaultBpm: piece?.defaultBpm ?? 80,
    timeSignature: piece?.timeSignature ?? "4/4",
    stage1: piece?.stage1 ?? 50,
    stage2: piece?.stage2 ?? 65,
    stage3: piece?.stage3 ?? 80,
    copyrightStatus: piece?.copyrightStatus ?? "public_domain",
    sourceNote: piece?.sourceNote ?? "",
  });
  const [check, setCheck] = useState<{ kind: "idle" | "reading" | "ok" | "error"; text?: string }>({ kind: "idle" });

  useEffect(() => {
    if (state.ok && state.data) router.push(`/guru/materi/partitur/${state.data.slug}`);
  }, [state, router]);

  const read = async (file: File | undefined) => {
    if (!file) return setCheck({ kind: "idle" });
    setCheck({ kind: "reading" });
    try {
      const at = await loadAlphaTab();
      const score = at.importer.ScoreLoader.loadScoreFromBytes(new Uint8Array(await file.arrayBuffer()), new at.Settings());
      const mb = score.masterBars[0];
      const tempo = Math.round(score.tempo) || f.defaultBpm;
      setF((x) => ({
        ...x,
        title: x.title || score.title || file.name.replace(/\.(musicxml|mxl|xml)$/i, ""),
        composer: x.composer || score.artist || score.music || "",
        defaultBpm: tempo,
        timeSignature: mb ? `${mb.timeSignatureNumerator}/${mb.timeSignatureDenominator}` : x.timeSignature,
        ...(piece ? {} : { stage1: Math.round(tempo * 0.6), stage2: Math.round(tempo * 0.8), stage3: tempo }),
      }));
      setCheck({ kind: "ok", text: t("Read: {0} bars, {1} part(s).", score.masterBars.length, score.tracks.length) });
    } catch {
      setCheck({ kind: "error", text: t("This file could not be read. In MuseScore use File → Export → MusicXML.") });
    }
  };

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <div className="mx-auto grid max-w-2xl gap-3">
      <Link href={piece ? `/guru/materi/partitur/${piece.slug}` : "/guru/materi#partitur"} className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {piece ? piece.title : t("Materials")}
      </Link>
      <PageHeader
        title={piece ? t("Change uploaded score") : t("Upload a score")}
        description={t("Write the score in MuseScore, then use File → Export → MusicXML (.musicxml or .mxl). Never upload a scan or photo of a printed book.")}
      />
      <Card>
        <CardContent className="pt-5">
          <form action={action} className="grid gap-4">
            <Field label={piece ? t("Replace the file (optional)") : t("MusicXML file")} htmlFor="file">
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed p-4 hover:bg-muted">
                <FileMusic className="size-6 text-primary" />
                <input id="file" name="file" type="file" accept=".musicxml,.mxl,.xml" required={!piece} onChange={(e) => read(e.target.files?.[0])} className="min-w-0 flex-1 text-sm" />
              </label>
              {check.kind !== "idle" && (
                <p className={`mt-1 text-xs ${check.kind === "error" ? "text-danger" : "text-muted-foreground"}`}>{check.kind === "reading" ? t("Reading the file…") : check.text}</p>
              )}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("Title")} htmlFor="title">
                <Input id="title" name="title" value={f.title} onChange={set("title")} required maxLength={120} />
              </Field>
              <Field label={t("Composer / source")} htmlFor="composer">
                <Input id="composer" name="composer" value={f.composer} onChange={set("composer")} maxLength={120} />
              </Field>
              <Field label={t("Tempo in the file (bpm)")} htmlFor="defaultBpm" hint={t("Must match the tempo at the start of the score (100% speed).")}>
                <Input id="defaultBpm" name="defaultBpm" type="number" min={20} max={300} value={f.defaultBpm} onChange={set("defaultBpm")} required />
              </Field>
              <Field label={t("Time signature")} htmlFor="timeSignature">
                <Input id="timeSignature" name="timeSignature" value={f.timeSignature} onChange={set("timeSignature")} pattern="\d{1,2}/\d{1,2}" placeholder="4/4" />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(["stage1", "stage2", "stage3"] as const).map((k, i) => (
                <Field key={k} label={t("Stage {0} (bpm)", i + 1)} htmlFor={k}>
                  <Input id={k} name={k} type="number" min={20} max={300} value={f[k]} onChange={set(k)} required />
                </Field>
              ))}
            </div>
            <Field label={t("Copyright status")} htmlFor="copyrightStatus" hint={t("“Unknown” is never shown to students.")}>
              <Select id="copyrightStatus" name="copyrightStatus" value={f.copyrightStatus} onChange={set("copyrightStatus")}>
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {t(s.label)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("Source note (optional)")} htmlFor="sourceNote">
              <Textarea id="sourceNote" name="sourceNote" rows={2} value={f.sourceNote} onChange={set("sourceNote")} maxLength={500} />
            </Field>
            <FormMessage state={state} />
            <SubmitButton pendingText={t("Saving…")}>{t("Save")}</SubmitButton>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
