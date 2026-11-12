"use client";

import { useActionState, useEffect, useState } from "react";
import { createAssignments } from "@/app/actions/assignments";
import { FormMessage } from "@/components/form-message";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit";
import type { ActionResult } from "@/lib/action-result";
import { useT } from "@/i18n/client";

export type AssignmentFormOptions = {
  students: { id: string; name: string }[];
  pieces: { id: string; title: string; own: boolean; visible: boolean; stageBpm: Record<"1" | "2" | "3", number> | null }[];
  lessons: { id: string; label: string }[];
};

/** Give an assignment to one or more students at once. */
export function CreateAssignmentForm({ options, preselect }: { options: AssignmentFormOptions; preselect?: string }) {
  const t = useT();
  const [state, action] = useActionState<ActionResult<{ count: number }>, FormData>(createAssignments, { ok: false });
  const [pieceId, setPieceId] = useState("");
  const [stage, setStage] = useState("");
  const [formKey, setFormKey] = useState(0);
  const piece = options.pieces.find((p) => p.id === pieceId);

  // A fresh form after a success.
  useEffect(() => {
    if (state.ok) {
      setPieceId("");
      setStage("");
      setFormKey((k) => k + 1);
    }
  }, [state]);

  return (
    <form key={formKey} action={action} className="grid gap-4">
      <fieldset className="grid gap-2">
        <legend className="mb-1.5 text-sm font-semibold">{t("Students")}</legend>
        {!options.students.length ? (
          <p className="text-sm text-muted-foreground">{t("No active students yet.")}</p>
        ) : (
          <div className="grid gap-1.5 sm:grid-cols-2">
            {options.students.map((s) => (
              <label key={s.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted">
                <input type="checkbox" name="studentIds" value={s.id} defaultChecked={preselect === s.id || state.values?.studentIds === s.id} className="size-4 accent-[var(--primary)]" />
                {s.name}
              </label>
            ))}
          </div>
        )}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("Score (optional)")} htmlFor="pieceId">
          <Select id="pieceId" name="pieceId" value={pieceId} onChange={(e) => setPieceId(e.target.value)}>
            <option value="">-</option>
            {[
              { label: t("My scores"), list: options.pieces.filter((p) => p.own) },
              { label: t("From the module"), list: options.pieces.filter((p) => !p.own) },
            ].map((g) =>
              g.list.length ? (
                <optgroup key={g.label} label={g.label}>
                  {g.list.map((p) => (
                    <option key={p.id} value={p.id} disabled={!p.visible}>
                      {p.title}
                      {p.visible ? "" : ` (${t("hidden from students")})`}
                    </option>
                  ))}
                </optgroup>
              ) : null,
            )}
          </Select>
        </Field>
        <Field label={t("Lesson (optional)")} htmlFor="lessonId">
          <Select id="lessonId" name="lessonId" defaultValue={state.values?.lessonId ?? ""}>
            <option value="">-</option>
            {options.lessons.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </Select>
        </Field>
        {piece && (
          <Field label={t("Target stage")} htmlFor="targetStage" hint={t("When you mark it done, this stage can be recorded as reached and checked.")}>
            <Select id="targetStage" name="targetStage" value={stage} onChange={(e) => setStage(e.target.value)}>
              <option value="">-</option>
              {(["1", "2", "3"] as const).map((s) => (
                <option key={s} value={s}>
                  {t("Stage {0}", s)}
                  {piece.stageBpm ? ` · ${piece.stageBpm[s]} bpm` : ""}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label={t("Target tempo (bpm, optional)")} htmlFor="targetBpm">
          <Input
            id="targetBpm"
            name="targetBpm"
            type="number"
            min={20}
            max={300}
            key={`${pieceId}-${stage}`}
            defaultValue={piece?.stageBpm && stage ? piece.stageBpm[stage as "1" | "2" | "3"] : (state.values?.targetBpm ?? "")}
          />
        </Field>
        <Field label={t("Due date (optional)")} htmlFor="dueDate">
          <Input id="dueDate" name="dueDate" type="date" defaultValue={state.values?.dueDate} />
        </Field>
      </div>
      <Field label={t("Instructions")} htmlFor="instructions" hint={t("What to practise and record, e.g. which bars, apoyando or tirando, how many times.")}>
        <Textarea id="instructions" name="instructions" rows={3} maxLength={2000} defaultValue={state.values?.instructions} />
      </Field>
      <FormMessage state={state} />
      <SubmitButton pendingText={t("Saving…")}>{t("Give assignment")}</SubmitButton>
    </form>
  );
}
