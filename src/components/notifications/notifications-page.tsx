import { Bell } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { NOTIFICATION_TITLE, listNotifications } from "@/lib/notifications";
import type { CurrentUser } from "@/lib/session";
import { formatDateTime } from "@/lib/utils";
import { getT } from "@/i18n/server";
import { NotificationList } from "./notification-list";

/** Shared by /guru/notifikasi and /siswa/notifikasi: only the signed-in user's own notifications. */
export async function NotificationsPage({ user }: { user: CurrentUser }) {
  const t = await getT();
  const rows = await listNotifications(user.id);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t("Notifications")} />
      {!rows.length ? (
        <EmptyState icon={<Bell />} title={t("No notifications yet")}>
          {t("New assignments and reviews show up here.")}
        </EmptyState>
      ) : (
        <NotificationList
          items={rows.map((n) => ({
            id: n.id,
            title: t(NOTIFICATION_TITLE[n.type] ?? n.title),
            body: n.body,
            link: n.link,
            read: Boolean(n.readAt),
            when: formatDateTime(n.createdAt),
          }))}
        />
      )}
    </div>
  );
}
