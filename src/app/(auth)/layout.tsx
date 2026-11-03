import { Brand } from "@/components/brand";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";

/** Centered card for sign-in, invitation, and change-password pages. Each page decides its own redirects. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute -top-40 -left-32 size-[28rem] rounded-full bg-primary/15 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -right-24 -bottom-40 size-[26rem] rounded-full bg-accent/20 blur-3xl" />
      <div className="absolute top-3 right-3 flex items-center gap-2">
        <LocaleSwitcher />
        <ThemeToggle />
      </div>
      <div className="relative w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Brand />
        </div>
        <div className="rounded-2xl border bg-card p-6 shadow-lg sm:p-8">{children}</div>
      </div>
    </div>
  );
}
