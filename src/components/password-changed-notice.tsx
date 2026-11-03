import { Alert } from "@/components/ui/misc";
import { getT } from "@/i18n/server";

/** Shown on the dashboard after /ganti-sandi redirects there with ?sandi=diganti. */
export async function PasswordChangedNotice({ show }: { show: boolean }) {
  if (!show) return null;
  const t = await getT();
  return (
    <Alert kind="success" className="mb-6">
      {t("Your password was changed.")}
    </Alert>
  );
}
