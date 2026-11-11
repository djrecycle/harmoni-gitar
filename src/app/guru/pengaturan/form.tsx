"use client";

import { useActionState } from "react";
import { updateSettings } from "@/app/actions/settings";
import { FormMessage } from "@/components/form-message";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit";
import { initialState } from "@/lib/action-result";
import { SEGMENT_LABEL } from "@/lib/labels";
import { ROUTINE_KEYS } from "@/lib/routine";
import { withToast } from "@/lib/with-toast";
import type { Settings } from "@/lib/settings";
import { useT } from "@/i18n/client";

export function SettingsForm({ settings }: { settings: Settings }) {
  const t = useT();
  const [state, action] = useActionState(withToast(updateSettings), initialState);
  const e = state.fieldErrors ?? {};
  const v = state.values;
  const total = ROUTINE_KEYS.reduce((n, k) => n + settings.routine[k], 0);

  return (
    <form action={action} className="grid max-w-2xl gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("Studio profile")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Field label={t("Studio name")} htmlFor="studioName" hint={t("Shown on the home page and in the browser tab.")} error={e.studioName}>
            <Input id="studioName" name="studioName" defaultValue={v?.studioName ?? settings.studioName} maxLength={60} required />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("Default practice timer")}</CardTitle>
          <CardDescription>{t("Minutes per segment for all students (now {0} minutes in total). You can set different durations for one student on their profile.", total)}</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {ROUTINE_KEYS.map((k) => (
            <Field key={k} label={t(SEGMENT_LABEL[k])} htmlFor={k} error={e[`routine.${k}`]}>
              <Input id={k} name={k} type="number" inputMode="numeric" min={0} max={120} step={1} defaultValue={v?.[k] ?? settings.routine[k]} required />
            </Field>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("Features")}</CardTitle>
        </CardHeader>
        <CardContent>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              name="payments"
              defaultChecked={v ? v.payments === "on" : settings.features.payments}
              className="mt-1 size-5 shrink-0 accent-[var(--primary)]"
            />
            <span>
              <span className="block text-sm font-semibold">{t("Tuition payments")}</span>
              <span className="block text-sm text-muted-foreground">
                {t("Record tuition plans, invoices, and payments by hand. While off, the payment menu and pages are hidden for everyone.")}
              </span>
            </span>
          </label>
        </CardContent>
      </Card>

      <FormMessage state={state} />
      <div>
        <SubmitButton pendingText={t("Saving…")}>{t("Save settings")}</SubmitButton>
      </div>
    </form>
  );
}
