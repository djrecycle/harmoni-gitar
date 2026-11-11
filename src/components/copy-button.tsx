"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useT } from "@/i18n/client";

export function CopyButton({ text, label, ...props }: { text: string; label?: string } & Omit<ButtonProps, "onClick">) {
  const t = useT();
  const [ok, setOk] = useState(false);
  return (
    <Button
      variant="outline"
      {...props}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setOk(true);
          setTimeout(() => setOk(false), 1800);
        } catch {
          window.prompt(t("Copy this text:"), text);
        }
      }}
    >
      {ok ? <Check /> : <Copy />}
      {ok ? t("Copied") : (label ?? t("Copy"))}
    </Button>
  );
}

/** Opens WhatsApp with the text ready to send (the teacher picks the contact). */
export function WhatsAppButton({ text, label }: { text: string; label?: string }) {
  const t = useT();
  return (
    <Button asChild variant="secondary">
      <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="size-4">
          <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.4.1-.2 0-.3 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.5-.3Z" />
        </svg>
        {label ?? t("Send via WhatsApp")}
      </a>
    </Button>
  );
}
