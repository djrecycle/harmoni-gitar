"use client";

import { useActionState } from "react";
import { login } from "@/app/actions/auth";
import { FormMessage } from "@/components/form-message";
import { Field, Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit";
import { initialState } from "@/lib/action-result";
import { useT } from "@/i18n/client";

export function LoginForm() {
  const t = useT();
  const [state, action] = useActionState(login, initialState);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-4">
      <Field label={t("Email or username")} htmlFor="identifier" error={e.identifier}>
        <Input id="identifier" name="identifier" autoComplete="username" autoCapitalize="none" defaultValue={state.values?.identifier} required />
      </Field>
      <Field label={t("Password")} htmlFor="password" error={e.password}>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <FormMessage state={state} />
      <SubmitButton size="lg" pendingText={t("Checking…")}>
        {t("Sign in")}
      </SubmitButton>
    </form>
  );
}
