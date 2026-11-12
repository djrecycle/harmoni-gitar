import type { Metadata } from "next";
import { NotificationsPage } from "@/components/notifications/notifications-page";
import { requireStudent } from "@/lib/session";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Notifications") };
}

export default async function Page() {
  return <NotificationsPage user={await requireStudent()} />;
}
