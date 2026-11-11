"use client";

import { useActionState } from "react";
import { createMeeting, createSlot, updateMeeting } from "@/app/actions/schedule";
import { FormMessage } from "@/components/form-message";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit";
import { initialState } from "@/lib/action-result";
import { DAY_NAMES } from "@/lib/dates";
import { LOCATION_LABEL, LOCATIONS, MEETING_STATUS_LABEL, MEETING_STATUSES } from "@/lib/labels";
import { withToast } from "@/lib/with-toast";
import { useT } from "@/i18n/client";

type Student = { id: string; name: string };

function StudentSelect({ students, preselect, error, value }: { students: Student[]; preselect?: string; error?: string; value?: string }) {
  const t = useT();
  return (
    <Field label={t("Student")} htmlFor="studentId" error={error}>
      <Select id="studentId" name="studentId" defaultValue={value ?? preselect ?? ""} required>
        <option value="" disabled>
          {t("Pick a student")}
        </option>
        {students.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </Select>
    </Field>
  );
}

export function SlotForm({ students, preselect, defaultFrom }: { students: Student[]; preselect?: string; defaultFrom: string }) {
  const t = useT();
  const [state, action] = useActionState(createSlot, initialState);
  const e = state.fieldErrors ?? {};
  const v = state.ok ? undefined : state.values;
  return (
    <form action={action} className="grid gap-3 border-t pt-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <StudentSelect students={students} preselect={preselect} error={e.studentId} value={v?.studentId} />
      </div>
      <Field label={t("Day")} htmlFor="dayOfWeek" error={e.dayOfWeek}>
        <Select id="dayOfWeek" name="dayOfWeek" defaultValue={v?.dayOfWeek ?? ""} required>
          <option value="" disabled>
            {t("Pick a day")}
          </option>
          {DAY_NAMES.map((d, i) => (
            <option key={d} value={i + 1}>
              {t(d)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t("Time")} htmlFor="startTime" error={e.startTime}>
        <Input id="startTime" name="startTime" type="time" defaultValue={v?.startTime ?? "16:00"} required />
      </Field>
      <Field label={t("Duration (minutes)")} htmlFor="durationMinutes" error={e.durationMinutes}>
        <Input id="durationMinutes" name="durationMinutes" type="number" inputMode="numeric" min={15} max={240} step={5} defaultValue={v?.durationMinutes ?? 60} required />
      </Field>
      <Field label={t("Place")} htmlFor="location" error={e.location}>
        <Select id="location" name="location" defaultValue={v?.location ?? "studio"}>
          {LOCATIONS.map((l) => (
            <option key={l} value={l}>
              {t(LOCATION_LABEL[l])}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t("Starting from")} htmlFor="activeFrom" error={e.activeFrom} className="sm:col-span-2">
        <Input id="activeFrom" name="activeFrom" type="date" defaultValue={v?.activeFrom ?? defaultFrom} required />
      </Field>
      <div className="grid gap-2 sm:col-span-2">
        <FormMessage state={state} />
        <div>
          <SubmitButton pendingText={t("Saving…")} disabled={!students.length}>
            {t("Add weekly lesson time")}
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}

export function MeetingForm({ students, preselect, defaultDate }: { students: Student[]; preselect?: string; defaultDate: string }) {
  const t = useT();
  const [state, action] = useActionState(createMeeting, initialState);
  const e = state.fieldErrors ?? {};
  const v = state.ok ? undefined : state.values;
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <StudentSelect students={students} preselect={preselect} error={e.studentId} value={v?.studentId} />
      </div>
      <Field label={t("Date")} htmlFor="m-date" error={e.date}>
        <Input id="m-date" name="date" type="date" defaultValue={v?.date ?? defaultDate} required />
      </Field>
      <Field label={t("Time")} htmlFor="m-time" error={e.startTime}>
        <Input id="m-time" name="startTime" type="time" defaultValue={v?.startTime ?? "16:00"} required />
      </Field>
      <div className="grid gap-2 sm:col-span-2">
        <FormMessage state={state} />
        <div>
          <SubmitButton variant="secondary" pendingText={t("Saving…")} disabled={!students.length}>
            {t("Add meeting")}
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}

export type MeetingValues = { date: string; startTime: string; status: string; material: string; teacherNote: string; privateNote: string };

export function EditMeetingForm({ id, values }: { id: string; values: MeetingValues }) {
  const t = useT();
  const [state, action] = useActionState(withToast(updateMeeting.bind(null, id)), initialState);
  const e = state.fieldErrors ?? {};
  const v = (k: keyof MeetingValues) => state.values?.[k] ?? values[k];
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label={t("Attendance")} htmlFor="status" error={e.status} className="sm:col-span-2">
        <Select id="status" name="status" defaultValue={v("status")}>
          {MEETING_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(MEETING_STATUS_LABEL[s])}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t("Date")} htmlFor="date" hint={t("Change it to move this meeting.")} error={e.date}>
        <Input id="date" name="date" type="date" defaultValue={v("date")} required />
      </Field>
      <Field label={t("Time")} htmlFor="startTime" error={e.startTime}>
        <Input id="startTime" name="startTime" type="time" defaultValue={v("startTime")} />
      </Field>
      <Field label={t("What was studied")} htmlFor="material" error={e.material} className="sm:col-span-2">
        <Textarea id="material" name="material" defaultValue={v("material")} maxLength={1000} className="min-h-20" />
      </Field>
      <Field label={t("Note for the student")} htmlFor="teacherNote" hint={t("The student sees this on their schedule and home page.")} error={e.teacherNote} className="sm:col-span-2">
        <Textarea id="teacherNote" name="teacherNote" defaultValue={v("teacherNote")} maxLength={2000} />
      </Field>
      <Field label={t("Private note")} htmlFor="privateNote" hint={t("Only you can see this.")} error={e.privateNote} className="sm:col-span-2">
        <Textarea id="privateNote" name="privateNote" defaultValue={v("privateNote")} maxLength={2000} className="min-h-20" />
      </Field>
      <div className="grid gap-2 sm:col-span-2">
        <FormMessage state={state} />
        <div>
          <SubmitButton pendingText={t("Saving…")}>{t("Save meeting")}</SubmitButton>
        </div>
      </div>
    </form>
  );
}
