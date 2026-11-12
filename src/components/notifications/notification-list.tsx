"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { markAllNotificationsRead, markNotificationRead } from "@/app/actions/notifications";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/client";

export type NotificationItem = { id: string; title: string; body: string | null; link: string | null; read: boolean; when: string };

/** The notifications, newest first. Tapping one marks it read and opens its page. */
export function NotificationList({ items }: { items: NotificationItem[] }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const unread = items.some((i) => !i.read);

  const open = (n: NotificationItem) =>
    start(async () => {
      if (!n.read) await markNotificationRead(n.id);
      if (n.link) router.push(n.link);
    });

  return (
    <div className="grid gap-3">
      {unread && (
        <div>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => void (await markAllNotificationsRead()))}>
            {t("Mark all as read")}
          </Button>
        </div>
      )}
      <ul className="grid gap-2">
        {items.map((n) => (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => open(n)}
              disabled={pending}
              className={cn(
                "flex w-full items-start gap-3 rounded-xl border p-3 text-left shadow-xs transition-colors hover:border-primary/50",
                n.read ? "bg-card" : "border-primary/30 bg-primary-soft/50",
              )}
            >
              <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-primary")} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className={cn("block", !n.read && "font-bold")}>{n.title}</span>
                {n.body && <span className="block truncate text-sm text-muted-foreground">{n.body}</span>}
                <span className="mt-0.5 block text-xs text-muted-foreground">{n.when}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
