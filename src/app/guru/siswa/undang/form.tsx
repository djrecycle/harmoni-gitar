"use client";

import { useActionState } from "react";
import { createInvitation, type InvitationCreated } from "@/app/actions/students";
import { CopyButton, WhatsAppButton } from "@/components/copy-button";
import { FormMessage } from "@/components/form-message";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit";
import type { ActionResult } from "@/lib/action-result";
import { formatDate } from "@/lib/utils";
import { useT } from "@/i18n/client";

const initial: ActionResult<InvitationCreated> = { ok: false };

export function InviteForm({ studioName, localOnly }: { studioName: string; localOnly: boolean }) {
  const t = useT();
  const [state, action] = useActionState(createInvitation, initial);
  const made = state.ok ? state.data : undefined;
  const message = made
    ? t("Hello {0}! This is your invitation to {1}. Open this link to make your account (valid until {2}):\n{3}", made.name.split(" ")[0], studioName, formatDate(made.expiresAt), made.url)
    : "";

  return (
    <div className="grid max-w-xl gap-4">
      <Card>
        <CardContent className="pt-5">
          <form action={action} className="grid gap-4">
            <Field label={t("Student's name")} htmlFor="name" hint={t("Filled in on the sign-up form; the student can still fix it.")} error={state.fieldErrors?.name}>
              <Input id="name" name="name" maxLength={80} required autoComplete="off" defaultValue={made ? "" : state.values?.name} />
            </Field>
            {!made && <FormMessage state={state} />}
            <div>
              <SubmitButton pendingText={t("Making…")}>{t("Make invitation link")}</SubmitButton>
            </div>
          </form>
        </CardContent>
      </Card>

      {made && (
        <Card className="border-primary/40">
          <CardContent className="grid gap-3 pt-5">
            <Alert kind="success" title={t("Invitation for {0} is ready", made.name)}>
              {t("Send it now: this link is shown only once.")}
            </Alert>
            <p className="rounded-lg bg-muted p-3 font-mono text-xs break-all select-all">{made.url}</p>
            <div className="flex flex-wrap gap-2">
              <WhatsAppButton text={message} />
              <CopyButton text={made.url} label={t("Copy link")} />
              <CopyButton text={message} label={t("Copy message")} />
            </div>
            {localOnly && (
              <Alert kind="warning">
                {t("The app runs on localhost: the link only opens on this computer. For a phone on the same Wi-Fi, set BETTER_AUTH_URL to this computer's local IP address.")}
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
