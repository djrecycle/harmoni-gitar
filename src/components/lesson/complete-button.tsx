"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { completeLesson } from "@/app/actions/learning";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/client";

/** "Mark as done": saves it, then goes to the next lesson (or back to the unit map). */
export function CompleteLessonButton({ lessonId, done }: { lessonId: string; done: boolean }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  if (done) return null;
  return (
    <Button
      size="lg"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await completeLesson(lessonId);
          if (!r.ok) return void toast.error(r.error);
          toast.success(r.message);
          router.push(r.data?.next ?? "/siswa/belajar");
        })
      }
    >
      {pending ? <LoaderCircle className="animate-spin" /> : <CircleCheck />} {t("Mark as done")}
    </Button>
  );
}
