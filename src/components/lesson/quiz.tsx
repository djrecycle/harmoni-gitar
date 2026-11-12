"use client";

import { useState } from "react";
import { CircleCheck, CircleHelp, CircleX } from "lucide-react";
import { InlineMarkdown } from "@/components/markdown";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/client";

/** A small multiple-choice question with instant feedback (answers are not graded or stored). */
export function Quiz({ question, options, answer, explain }: { question: string; options: string[]; answer: number; explain?: string }) {
  const t = useT();
  const [picked, setPicked] = useState<number | null>(null);
  const right = picked === answer;
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="mb-3 flex items-start gap-2 font-bold">
        <CircleHelp className="mt-0.5 size-5 shrink-0 text-primary" />
        {/* The question is bold already: emphasis inside it shows in colour. */}
        <span className="[&_strong]:text-primary">
          <InlineMarkdown>{question}</InlineMarkdown>
        </span>
      </p>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {options.map((o, i) => {
          const show = picked !== null && (i === picked || (right && i === answer));
          return (
            <button
              key={i}
              type="button"
              onClick={() => setPicked(i)}
              aria-pressed={picked === i}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-colors",
                show && i === answer && "border-success bg-success-soft",
                show && i !== answer && "border-danger bg-danger-soft",
                !show && "hover:bg-muted",
              )}
            >
              {show && (i === answer ? <CircleCheck className="size-4 shrink-0 text-success" /> : <CircleX className="size-4 shrink-0 text-danger" />)}
              <span>
                <InlineMarkdown>{o}</InlineMarkdown>
              </span>
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <p role="status" className={cn("mt-3 text-sm font-semibold", right ? "text-success" : "text-danger")}>
          {right ? t("Correct!") : t("Not quite. Try another answer.")}
          {right && explain && <span className="mt-1 block font-normal text-muted-foreground">
              <InlineMarkdown>{explain}</InlineMarkdown>
            </span>}
        </p>
      )}
    </div>
  );
}
