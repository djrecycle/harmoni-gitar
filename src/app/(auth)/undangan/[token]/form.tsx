"use client";

import { useActionState } from "react";
import { acceptInvitation } from "@/app/actions/invitation";
import { FormMessage } from "@/components/form-message";
import { Field, Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit";
import { initialState } from "@/lib/action-result";
import { useT } from "@/i18n/client";

export function AcceptInvitationForm({ token, name }: { token: string; name: string }) {
  const t = useT();
  const [state, action] = useActionState(acceptInvitation.bind(null, token), initialState);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-4">
      <Field label={t("Your name")} htmlFor="name" error={e.name}>
        <Input id="name" name="name" defaultValue={state.values?.name ?? name} maxLength={80} required autoComplete="name" />
      </Field>
      <Field label={t("Username")} htmlFor="username" hint={t("You sign in with this. 3-24 characters: lowercase letters, numbers, underscore.")} error={e.username}>
        <Input id="username" name="username" defaultValue={state.values?.username} maxLength={24} required autoCapitalize="none" autoComplete="username" pattern="[a-zA-Z0-9_]{3,24}" />
      </Field>
      <Field label={t("Password")} htmlFor="fresh" hint={t("At least 8 characters")} error={e.fresh}>
        <Input id="fresh" name="fresh" type="password" minLength={8} maxLength={128} required autoComplete="new-password" />
      </Field>
      <Field label={t("Repeat password")} htmlFor="confirmText" error={e.confirmText}>
        <Input id="confirmText" name="confirmText" type="password" required autoComplete="new-password" />
      </Field>
      <FormMessage state={state} />
      <SubmitButton size="lg" pendingText={t("Making your account…")}>
        {t("Make my account")}
      </SubmitButton>
    </form>
  );
}
