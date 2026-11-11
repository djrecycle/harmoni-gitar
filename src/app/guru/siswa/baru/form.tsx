"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { createStudent, suggestUsernameFor, type AccountCreated } from "@/app/actions/students";
import { CopyButton, WhatsAppButton } from "@/components/copy-button";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit";
import type { ActionResult } from "@/lib/action-result";
import { useT } from "@/i18n/client";

const initial: ActionResult<AccountCreated> = { ok: false };

export function CreateStudentForm({ initialPassword, studioName, signInUrl }: { initialPassword: string; studioName: string; signInUrl: string }) {
  const t = useT();
  const [state, action] = useActionState(createStudent, initial);
  const [name, setName] = useState(state.values?.name ?? "");
  const [username, setUsername] = useState(state.values?.username ?? "");
  const [pending, start] = useTransition();
  const e = state.fieldErrors ?? {};
  const made = state.ok ? state.data : undefined;

  if (made) {
    const message = t("Hello {0}! Your {1} account:\nSign in at: {2}\nUsername: {3}\nInitial password: {4}\nYou will be asked to pick your own password.", made.name.split(" ")[0], studioName, signInUrl, made.username, made.password);
    return (
      <Card className="max-w-xl border-primary/40">
        <CardContent className="grid gap-3 pt-5">
          <Alert kind="success" title={t("Account for {0} is ready", made.name)}>
            {t("Write down or send the initial password now: it is shown only once.")}
          </Alert>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-lg bg-muted p-3 text-sm">
            <dt className="text-muted-foreground">{t("Username")}</dt>
            <dd className="font-mono font-bold">{made.username}</dd>
            <dt className="text-muted-foreground">{t("Initial password")}</dt>
            <dd className="font-mono font-bold">{made.password}</dd>
          </dl>
          <div className="flex flex-wrap gap-2">
            <WhatsAppButton text={message} />
            <CopyButton text={message} label={t("Copy message")} />
            <Button asChild variant="ghost">
              <Link href={`/guru/siswa/${made.studentId}`}>{t("Open profile")}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-xl">
      <CardContent className="pt-5">
        <form action={action} className="grid gap-4">
          <Field label={t("Student's name")} htmlFor="name" error={e.name}>
            <Input id="name" name="name" maxLength={80} required autoComplete="off" value={name} onChange={(ev) => setName(ev.target.value)} />
          </Field>
          <Field label={t("Username")} htmlFor="username" hint={t("3-24 characters: lowercase letters, numbers, underscore.")} error={e.username}>
            <div className="flex gap-2">
              <Input id="username" name="username" required autoCapitalize="none" autoComplete="off" maxLength={24} value={username} onChange={(ev) => setUsername(ev.target.value.toLowerCase())} />
              <Button
                variant="outline"
                disabled={pending || name.trim().length < 2}
                onClick={() => start(async () => setUsername(await suggestUsernameFor(name)))}
                aria-label={t("Suggest a username")}
                title={t("Suggest a username")}
              >
                <Sparkles />
              </Button>
            </div>
          </Field>
          <Field label={t("Initial password")} htmlFor="password" hint={t("At least 8 characters. The student replaces it at the first sign-in.")} error={e.password}>
            <Input id="password" name="password" required minLength={8} maxLength={128} defaultValue={initialPassword} autoComplete="off" className="font-mono" />
          </Field>
          <FormMessage state={state} />
          <div>
            <SubmitButton pendingText={t("Creating…")}>{t("Create account")}</SubmitButton>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
