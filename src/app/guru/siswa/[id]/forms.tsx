"use client";

import { useActionState, useState } from "react";
import { KeyRound } from "lucide-react";
import { saveTeacherLevels } from "@/app/actions/learning";
import { resetPassword, updateStudentProfile, type PasswordReset } from "@/app/actions/students";
import { ActionButton } from "@/components/action-button";
import { CopyButton } from "@/components/copy-button";
import { FormMessage } from "@/components/form-message";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Alert, Badge } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit";
import { initialState } from "@/lib/action-result";
import { CHECK_LEVEL_LABEL, CHECK_LEVELS, SEGMENT_LABEL, type CheckLevel } from "@/lib/labels";
import { ROUTINE_KEYS, type RoutineSegments } from "@/lib/routine";
import { withToast } from "@/lib/with-toast";
import { useT } from "@/i18n/client";

export function ResetPasswordButton({ studentId, name }: { studentId: string; name: string }) {
  const t = useT();
  const [made, setMade] = useState<PasswordReset | null>(null);
  return (
    <>
      <ActionButton<PasswordReset>
        action={resetPassword.bind(null, studentId)}
        confirm={t("Make a new initial password for {0}? Their current password stops working and they are signed out.", name)}
        onDone={(d) => d && setMade(d)}
        variant="outline"
      >
        <KeyRound /> {t("Reset password")}
      </ActionButton>
      {made && (
        <Alert kind="success" title={t("New initial password")} className="w-full">
          <p>
            {t("Username")}: <b className="font-mono">{made.username}</b> · {t("Password")}: <b className="font-mono">{made.password}</b>
          </p>
          <p className="mt-1 text-xs">{t("Shown only once. The student must change it at the next sign-in.")}</p>
          <CopyButton text={`${t("Username")}: ${made.username}\n${t("Initial password")}: ${made.password}`} size="sm" className="mt-2" />
        </Alert>
      )}
    </>
  );
}

type CheckItem = { id: string; text: string; selfLevel: CheckLevel | null; teacherLevel: CheckLevel | null };

const tone = (lv: CheckLevel | null) => (lv === "sudah" ? "success" : lv === "hampir" ? "warning" : lv === "belum" ? "danger" : "neutral");

export function TeacherCheckForm({ studentId, unitId, items }: { studentId: string; unitId: string; items: CheckItem[] }) {
  const t = useT();
  const [state, action] = useActionState(withToast(saveTeacherLevels.bind(null, studentId, unitId)), initialState);
  return (
    <form action={action} className="grid gap-3">
      <ol className="grid gap-1.5">
        {items.map((i, n) => (
          <li key={i.id} className="grid gap-2 rounded-lg bg-muted p-2.5 sm:grid-cols-[1fr_auto_10rem] sm:items-center">
            <span className="text-sm">
              <span className="mr-1 text-muted-foreground">{n + 1}.</span>
              {i.text}
            </span>
            <Badge tone={tone(i.selfLevel)} className="w-fit">
              {t("Student: {0}", i.selfLevel ? t(CHECK_LEVEL_LABEL[i.selfLevel]) : "-")}
            </Badge>
            <Select name={`level-${i.id}`} defaultValue={i.teacherLevel ?? ""} aria-label={t("Teacher's level for: {0}", i.text)} className="h-9">
              <option value="">{t("Teacher: -")}</option>
              {CHECK_LEVELS.map((lv) => (
                <option key={lv} value={lv}>
                  {t("Teacher: {0}", t(CHECK_LEVEL_LABEL[lv]))}
                </option>
              ))}
            </Select>
          </li>
        ))}
      </ol>
      <FormMessage state={state} />
      <div>
        <SubmitButton variant="secondary" pendingText={t("Saving…")}>
          {t("Save teacher assessment")}
        </SubmitButton>
      </div>
    </form>
  );
}

type ProfileValues = { name: string; birthYear: string; startedAt: string; guitarNotes: string; teacherNotes: string };

export function ProfileForm({ studentId, values, routine, customRoutine }: { studentId: string; values: ProfileValues; routine: RoutineSegments; customRoutine: boolean }) {
  const t = useT();
  const [state, action] = useActionState(withToast(updateStudentProfile.bind(null, studentId)), initialState);
  const [custom, setCustom] = useState(customRoutine);
  const e = state.fieldErrors ?? {};
  const v = (k: keyof ProfileValues) => state.values?.[k] ?? values[k];
  return (
    <form action={action} className="grid max-w-2xl gap-4">
      <Card>
        <CardContent className="grid gap-4 pt-5 sm:grid-cols-2">
          <Field label={t("Name")} htmlFor="name" error={e.name} className="sm:col-span-2">
            <Input id="name" name="name" defaultValue={v("name")} maxLength={80} required />
          </Field>
          <Field label={t("Birth year (optional)")} htmlFor="birthYear" error={e.birthYear}>
            <Input id="birthYear" name="birthYear" type="number" inputMode="numeric" min={1930} max={new Date().getFullYear()} defaultValue={v("birthYear")} />
          </Field>
          <Field label={t("Started lessons")} htmlFor="startedAt" error={e.startedAt}>
            <Input id="startedAt" name="startedAt" type="date" defaultValue={v("startedAt")} />
          </Field>
          <Field label={t("Guitar notes")} htmlFor="guitarNotes" hint={t("E.g. guitar size 3/4, has a footstool.")} error={e.guitarNotes} className="sm:col-span-2">
            <Input id="guitarNotes" name="guitarNotes" defaultValue={v("guitarNotes")} maxLength={300} />
          </Field>
          <Field label={t("Private teacher notes")} htmlFor="teacherNotes" hint={t("Never shown to the student.")} error={e.teacherNotes} className="sm:col-span-2">
            <Textarea id="teacherNotes" name="teacherNotes" defaultValue={v("teacherNotes")} maxLength={2000} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("Practice timer")}</CardTitle>
          <CardDescription>{t("Leave it off to use the studio default from Settings.")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold">
            <input type="checkbox" name="customRoutine" checked={custom} onChange={(ev) => setCustom(ev.target.checked)} className="size-5 accent-[var(--primary)]" />
            {t("Use durations just for this student")}
          </label>
          {custom && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {ROUTINE_KEYS.map((k) => (
                <Field key={k} label={t(SEGMENT_LABEL[k])} htmlFor={k} error={e[`routine.${k}`]}>
                  <Input id={k} name={k} type="number" inputMode="numeric" min={0} max={120} defaultValue={state.values?.[k] ?? routine[k]} required />
                </Field>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <FormMessage state={state} />
      <div>
        <SubmitButton pendingText={t("Saving…")}>{t("Save profile")}</SubmitButton>
      </div>
    </form>
  );
}
