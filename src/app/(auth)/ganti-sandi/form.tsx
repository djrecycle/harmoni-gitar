"use client";

import { useActionState } from "react";
import { changePassword } from "@/app/actions/auth";
import { FormMessage } from "@/components/form-message";
import { Field, Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit";
import { initialState } from "@/lib/action-result";
import { useT } from "@/i18n/client";

export function ChangePasswordForm() {
  const t = useT();
  const [state, action] = useActionState(changePassword, initialState);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-4">
      <Field label={t("Current password")} htmlFor="current" error={e.current}>
        <Input id="current" name="current" type="password" autoComplete="current-password" required />
      </Field>
      <Field label={t("New password")} htmlFor="fresh" hint={t("At least 8 characters")} error={e.fresh}>
        <Input id="fresh" name="fresh" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <Field label={t("Repeat new password")} htmlFor="confirmText" error={e.confirmText}>
        <Input id="confirmText" name="confirmText" type="password" autoComplete="new-password" required />
      </Field>
      <FormMessage state={state} />
      <SubmitButton size="lg" pendingText={t("Saving…")}>
        {t("Save new password")}
      </SubmitButton>
    </form>
  );
}
