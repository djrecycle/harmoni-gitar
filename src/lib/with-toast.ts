"use client";

import { toast } from "sonner";
import type { ActionResult } from "./action-result";

/**
 * Wrap a form action so its success message shows as a toast. Used by forms that are re-mounted (new `key`)
 * after saving: the inline success message would disappear with the old form, the toast does not.
 */
export function withToast<T>(action: (prev: ActionResult<T>, fd: FormData) => Promise<ActionResult<T>>) {
  return async (prev: ActionResult<T>, fd: FormData) => {
    const r = await action(prev, fd);
    if (r.ok && r.message) toast.success(r.message);
    return r;
  };
}
