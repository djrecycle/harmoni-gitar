"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { zodError } from "@/lib/action-result-server";
import { succeed, type ActionResult } from "@/lib/action-result";
import { routineSchema } from "@/lib/routine";
import { requireTeacher } from "@/lib/session";
import { saveSettings } from "@/lib/settings";
import { getT } from "@/i18n/server";

const settingsSchema = z.object({
  studioName: z.string().trim().min(2, "Studio name must be at least 2 characters").max(60, "Studio name is too long"),
  routine: routineSchema,
  payments: z.boolean(),
});

export async function updateSettings(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const t = await getT();
  const teacher = await requireTeacher();
  const p = settingsSchema.safeParse({
    studioName: fd.get("studioName"),
    routine: { warmup: fd.get("warmup"), etude: fd.get("etude"), piece: fd.get("piece") },
    payments: fd.get("payments") === "on",
  });
  if (!p.success) return zodError(p.error, fd);
  await saveSettings({ studioName: p.data.studioName, routine: p.data.routine, features: { payments: p.data.payments } }, teacher.id);
  revalidatePath("/", "layout");
  return succeed(t("Settings saved."));
}
