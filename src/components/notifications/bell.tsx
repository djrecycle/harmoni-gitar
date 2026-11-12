import Link from "next/link";
import { Bell } from "lucide-react";
import { unreadCount } from "@/lib/notifications";
import { dashboardPathFor, type CurrentUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { getT } from "@/i18n/server";

/** Bell with the number of unread notifications; opens the notifications page. */
export async function NotificationBell({ user, className }: { user: CurrentUser; className?: string }) {
  const t = await getT();
  const n = await unreadCount(user.id);
  return (
    <Link
      href={`${dashboardPathFor(user.role)}/notifikasi`}
      aria-label={n ? t("Notifications ({0} unread)", n) : t("Notifications")}
      title={t("Notifications")}
      className={cn("relative grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground", className)}
    >
      <Bell className="size-5" />
      {n > 0 && (
        <span className="absolute -top-0.5 -right-0.5 grid min-w-4.5 place-items-center rounded-full bg-danger px-1 text-[0.65rem] font-bold leading-4.5 text-white">
          {n > 9 ? "9+" : n}
        </span>
      )}
    </Link>
  );
}
