import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { I18nProvider } from "@/i18n/client";
import { dictFor, getLocale, getT } from "@/i18n/server";
import { getSettings } from "@/lib/settings";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  const { studioName } = await getSettings();
  return {
    title: { default: studioName, template: `%s · ${studioName}` },
    description: t("Classical guitar lessons: practise at home, step by step, following your teacher's curriculum."),
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f7fc" },
    { media: "(prefers-color-scheme: dark)", color: "#16141f" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} data-scroll-behavior="smooth" suppressHydrationWarning className={jakarta.variable}>
      <body className="min-h-dvh">
        <I18nProvider locale={locale} dict={dictFor(locale)}>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            {children}
            <Toaster richColors position="top-center" />
          </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
