"use client";

import { useActionState } from "react";
import { addManualPractice } from "@/app/actions/practice";
import { FormMessage } from "@/components/form-message";
import { Field, Input, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit";
import { initialState } from "@/lib/action-result";
import { useT } from "@/i18n/client";

export function ManualPracticeForm({ min, max }: { min: string; max: string }) {
  const t = useT();
  const [state, action] = useActionState(addManualPractice, initialState);
  const e = state.fieldErrors ?? {};
  const v = state.ok ? undefined : state.values;
  return (
    <form action={action} className="grid gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("Date")} htmlFor="date" error={e.date}>
          <Input id="date" name="date" type="date" min={min} max={max} defaultValue={v?.date ?? max} required />
        </Field>
        <Field label={t("Minutes")} htmlFor="minutes" error={e.minutes}>
          <Input id="minutes" name="minutes" type="number" inputMode="numeric" min={1} max={360} defaultValue={v?.minutes ?? 30} required />
        </Field>
      </div>
      <Field label={t("What did you practise?")} htmlFor="note" error={e.note}>
        <Textarea id="note" name="note" maxLength={1000} defaultValue={v?.note} className="min-h-20" />
      </Field>
      <FormMessage state={state} />
      <div>
        <SubmitButton variant="secondary" pendingText={t("Saving…")}>
          {t("Add to journal")}
        </SubmitButton>
      </div>
    </form>
  );
}
