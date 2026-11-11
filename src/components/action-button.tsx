"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-result";

/**
 * A button that runs a server action (already bound to its arguments), shows the result as a toast, and can
 * ask for confirmation first. `onDone` gets the result data on success.
 */
export function ActionButton<T>({
  action,
  confirm,
  onDone,
  children,
  redirectTo,
  ...props
}: Omit<ButtonProps, "onClick" | "action"> & {
  action: () => Promise<ActionResult<T>>;
  confirm?: string;
  onDone?: (data: T | undefined) => void;
  redirectTo?: string;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button
      {...props}
      disabled={pending || props.disabled}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        start(async () => {
          const r = await action();
          if (!r.ok) return void toast.error(r.error);
          if (r.message) toast.success(r.message);
          onDone?.(r.data);
          if (redirectTo) router.push(redirectTo);
        });
      }}
    >
      {pending && <LoaderCircle className="animate-spin" />}
      {children}
    </Button>
  );
}
