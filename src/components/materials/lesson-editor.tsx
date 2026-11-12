"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckSquare,
  Crosshair,
  Eye,
  FileText,
  ImagePlus,
  Lightbulb,
  ListChecks,
  LoaderCircle,
  Music,
  Plus,
  Save,
  Sparkles,
  Target,
  Trash2,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { deleteLesson, saveLesson, uploadLessonImage, type LessonInput } from "@/app/actions/materials";
import { ActionButton } from "@/components/action-button";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import type { BlockType } from "@/lib/blocks";
import { ILLUSTRATIONS, type IllustrationName } from "@/lib/illustrations";
import { LESSON_KIND_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/client";

type Block = { key: string; type: BlockType; data: Record<string, unknown> };

export type LessonEditorProps = {
  lesson: {
    id: string | null;
    title: string;
    summary: string;
    kind: "theory" | "technique" | "etude" | "piece";
    estimatedMinutes: number | null;
    published: boolean;
    unitId: string | null;
    blocks: { type: BlockType; data: Record<string, unknown> }[];
    studentIds: string[];
  };
  units: { id: string; order: number; title: string }[];
  students: { id: string; name: string; active: boolean }[];
  pieces: { slug: string; title: string; visible: boolean; own: boolean }[];
};

const BLOCKS: { type: BlockType; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { type: "text", label: "Text", Icon: FileText },
  { type: "score", label: "Score", Icon: Music },
  { type: "tip", label: "Tip", Icon: Lightbulb },
  { type: "focus", label: "Pay attention", Icon: Crosshair },
  { type: "target", label: "Target", Icon: Target },
  { type: "checklist", label: "Checklist", Icon: CheckSquare },
  { type: "quiz", label: "Quiz", Icon: ListChecks },
  { type: "video", label: "Video", Icon: Video },
  { type: "image", label: "Image", Icon: ImagePlus },
  { type: "illustration", label: "Animation", Icon: Sparkles },
];

const EMPTY: Record<BlockType, Record<string, unknown>> = {
  text: { markdown: "" },
  tip: { markdown: "" },
  focus: { markdown: "" },
  target: { markdown: "" },
  score: { piece: "" },
  checklist: { items: [] },
  quiz: { question: "", options: ["", ""], answer: 0 },
  video: { url: "" },
  image: { fileKey: "", alt: "" },
  illustration: { name: "" },
};

let seq = 0;
const key = () => `b${++seq}`;
const lines = (s: string) => s.split("\n");
const str = (v: unknown) => (typeof v === "string" ? v : "");

/** Block data as it is saved: empty optional fields removed, list lines trimmed. */
function clean(b: Block): { type: BlockType; data: Record<string, unknown> } {
  const d: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(b.data)) {
    if (Array.isArray(v)) d[k] = v.map((x) => String(x).trim()).filter(Boolean);
    else if (typeof v === "string") {
      if (v.trim()) d[k] = v.trim();
    } else if (v != null) d[k] = v;
  }
  if (b.type === "image" && d.alt == null) d.alt = "";
  return { type: b.type, data: d };
}

export function LessonEditor({ lesson, units, students, pieces }: LessonEditorProps) {
  const t = useT();
  const router = useRouter();
  const [f, setF] = useState({
    title: lesson.title,
    summary: lesson.summary,
    kind: lesson.kind,
    minutes: lesson.estimatedMinutes ? String(lesson.estimatedMinutes) : "",
    published: lesson.published,
    unitId: lesson.unitId ?? "",
    studentIds: lesson.studentIds,
  });
  const [blocks, setBlocks] = useState<Block[]>(() => lesson.blocks.map((b) => ({ key: key(), ...b })));
  const [dirty, setDirty] = useState(false);
  const [saving, start] = useTransition();

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = (patch: Partial<typeof f>) => {
    setF((x) => ({ ...x, ...patch }));
    setDirty(true);
  };
  const setBlock = (k: string, data: Record<string, unknown>) => {
    setBlocks((bs) => bs.map((b) => (b.key === k ? { ...b, data: { ...b.data, ...data } } : b)));
    setDirty(true);
  };
  const moveBlock = (i: number, d: -1 | 1) => {
    setBlocks((bs) => {
      const j = i + d;
      if (j < 0 || j >= bs.length) return bs;
      const next = [...bs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    setDirty(true);
  };
  const addBlock = (type: BlockType) => {
    setBlocks((bs) => [...bs, { key: key(), type, data: structuredClone(EMPTY[type]) }]);
    setDirty(true);
  };

  const save = () =>
    start(async () => {
      const input: LessonInput = {
        title: f.title,
        summary: f.summary || undefined,
        kind: f.kind,
        estimatedMinutes: f.minutes ? Number(f.minutes) : null,
        published: f.published,
        unitId: f.unitId || null,
        blocks: blocks.map(clean),
        studentIds: f.unitId ? [] : f.studentIds,
      };
      const r = await saveLesson(lesson.id, input);
      if (!r.ok) return void toast.error(r.error);
      toast.success(r.message);
      setDirty(false);
      if (!lesson.id && r.data) router.replace(`/guru/materi/pelajaran/${r.data.id}`);
    });

  const extra = !f.unitId;
  const activeStudents = students.filter((s) => s.active || f.studentIds.includes(s.id));

  return (
    <div className="mx-auto grid max-w-3xl gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/guru/materi" className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> {t("Materials")}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {dirty && <span className="text-xs text-muted-foreground">{t("Not saved yet")}</span>}
          {lesson.id && (
            <Button asChild size="sm" variant="outline">
              <Link href={`/guru/materi/pelajaran/${lesson.id}/pratinjau`}>
                <Eye /> {t("Preview")}
              </Link>
            </Button>
          )}
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? <LoaderCircle className="animate-spin" /> : <Save />} {t("Save")}
          </Button>
        </div>
      </div>

      <section className="grid gap-4 rounded-2xl border bg-card p-4 shadow-xs">
        <Field label={t("Title")} htmlFor="title">
          <Input id="title" value={f.title} onChange={(e) => set({ title: e.target.value })} maxLength={120} placeholder={t("e.g. Arpeggio p-i-m-a")} />
        </Field>
        <Field label={t("Short summary (optional)")} htmlFor="summary">
          <Textarea id="summary" rows={2} value={f.summary} onChange={(e) => set({ summary: e.target.value })} maxLength={400} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t("Kind")} htmlFor="kind">
            <Select id="kind" value={f.kind} onChange={(e) => set({ kind: e.target.value as typeof f.kind })}>
              {(["theory", "technique", "etude", "piece"] as const).map((k) => (
                <option key={k} value={k}>
                  {t(LESSON_KIND_LABEL[k])}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("Minutes (estimate)")} htmlFor="minutes">
            <Input id="minutes" type="number" min={1} max={240} value={f.minutes} onChange={(e) => set({ minutes: e.target.value })} />
          </Field>
          <label className="flex items-center gap-2 self-end pb-3 text-sm font-semibold">
            <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={f.published} onChange={(e) => set({ published: e.target.checked })} />
            {t("Published (students can see it)")}
          </label>
        </div>
        <Field
          label={t("Where does it go?")}
          htmlFor="unit"
          hint={extra ? t("Extra material: only the students you tick below see it, any time.") : t("In a unit: every student gets it in order, after the unit's lessons (before the unit check).")}
        >
          <Select id="unit" value={f.unitId} onChange={(e) => set({ unitId: e.target.value })}>
            <option value="">{t("Extra material for chosen students")}</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {t("Unit {0}", u.order)} · {u.title}
              </option>
            ))}
          </Select>
        </Field>
        {extra && (
          <fieldset className="grid gap-2">
            <legend className="mb-1.5 text-sm font-semibold">{t("Students who get it")}</legend>
            {!activeStudents.length ? (
              <p className="text-sm text-muted-foreground">{t("No students yet.")}</p>
            ) : (
              <div className="grid gap-1.5 sm:grid-cols-2">
                {activeStudents.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted">
                    <input
                      type="checkbox"
                      className="size-4 accent-[var(--primary)]"
                      checked={f.studentIds.includes(s.id)}
                      onChange={(e) => set({ studentIds: e.target.checked ? [...f.studentIds, s.id] : f.studentIds.filter((x) => x !== s.id) })}
                    />
                    {s.name}
                    {!s.active && <span className="text-xs text-muted-foreground">({t("inactive")})</span>}
                  </label>
                ))}
              </div>
            )}
          </fieldset>
        )}
      </section>

      <section className="grid gap-3">
        <h2 className="font-bold">{t("Content")}</h2>
        {!blocks.length && <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">{t("Add text, a score, a checklist… with the buttons below.")}</p>}
        {blocks.map((b, i) => {
          const meta = BLOCKS.find((x) => x.type === b.type)!;
          return (
            <div key={b.key} className="grid gap-3 rounded-2xl border bg-card p-3 shadow-xs sm:p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-bold">
                  <meta.Icon className="size-4 text-primary" /> {i + 1}. {t(meta.label)}
                </p>
                <div className="flex gap-0.5">
                  <IconBtn label={t("Move up")} onClick={() => moveBlock(i, -1)} disabled={i === 0}>
                    <ArrowUp />
                  </IconBtn>
                  <IconBtn label={t("Move down")} onClick={() => moveBlock(i, 1)} disabled={i === blocks.length - 1}>
                    <ArrowDown />
                  </IconBtn>
                  <IconBtn
                    label={t("Delete block")}
                    onClick={() => {
                      setBlocks((bs) => bs.filter((x) => x.key !== b.key));
                      setDirty(true);
                    }}
                    danger
                  >
                    <Trash2 />
                  </IconBtn>
                </div>
              </div>
              <BlockFields block={b} pieces={pieces} onChange={(d) => setBlock(b.key, d)} />
            </div>
          );
        })}
        <div className="flex flex-wrap gap-1.5 rounded-2xl border border-dashed p-3">
          {BLOCKS.map((x) => (
            <Button key={x.type} size="sm" variant="outline" onClick={() => addBlock(x.type)}>
              <Plus /> {t(x.label)}
            </Button>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
        {lesson.id ? (
          <ActionButton variant="danger-soft" size="sm" action={deleteLesson.bind(null, lesson.id)} confirm={t("Delete this material? Students' progress on it is deleted too.")} redirectTo="/guru/materi">
            <Trash2 /> {t("Delete material")}
          </ActionButton>
        ) : (
          <span />
        )}
        <Button onClick={save} disabled={saving}>
          {saving ? <LoaderCircle className="animate-spin" /> : <Save />} {t("Save")}
        </Button>
      </div>
    </div>
  );
}

function IconBtn({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn("grid size-8 place-items-center rounded-lg disabled:opacity-30 [&_svg]:size-4", danger ? "text-danger hover:bg-danger-soft" : "hover:bg-muted")}
    >
      {children}
    </button>
  );
}

function BlockFields({ block, pieces, onChange }: { block: Block; pieces: LessonEditorProps["pieces"]; onChange: (d: Record<string, unknown>) => void }) {
  const t = useT();
  const d = block.data;
  switch (block.type) {
    case "text":
      return (
        <Field label={t("Text")} hint={t("Markdown: **bold**, *italic*, - list, ## heading.")}>
          <Textarea rows={6} value={str(d.markdown)} onChange={(e) => onChange({ markdown: e.target.value })} />
        </Field>
      );
    case "tip":
    case "focus":
    case "target":
      return (
        <>
          <Field label={t("Title (optional)")}>
            <Input value={str(d.title)} onChange={(e) => onChange({ title: e.target.value })} maxLength={80} />
          </Field>
          <Field label={t("Text")}>
            <Textarea rows={3} value={str(d.markdown)} onChange={(e) => onChange({ markdown: e.target.value })} />
          </Field>
        </>
      );
    case "score": {
      const chosen = pieces.find((p) => p.slug === d.piece);
      return (
        <>
          <Field label={t("Score")}>
            <Select value={str(d.piece)} onChange={(e) => onChange({ piece: e.target.value })}>
              <option value="">{t("Choose a score…")}</option>
              <optgroup label={t("My scores")}>
                {pieces
                  .filter((p) => p.own)
                  .map((p) => (
                    <option key={p.slug} value={p.slug}>
                      {p.title}
                      {p.visible ? "" : ` (${t("hidden from students")})`}
                    </option>
                  ))}
              </optgroup>
              <optgroup label={t("From the module")}>
                {pieces
                  .filter((p) => !p.own)
                  .map((p) => (
                    <option key={p.slug} value={p.slug}>
                      {p.title}
                      {p.visible ? "" : ` (${t("hidden from students")})`}
                    </option>
                  ))}
              </optgroup>
            </Select>
          </Field>
          {chosen && !chosen.visible && <p className="text-xs text-danger">{t("Students cannot see this score: its copyright status is “Unknown” or it has no notation.")}</p>}
          <Field label={t("Note above the score (optional)")}>
            <Input value={str(d.note)} onChange={(e) => onChange({ note: e.target.value })} maxLength={120} />
          </Field>
          <p className="text-xs text-muted-foreground">
            {t("Need a new score?")}{" "}
            <Link href="/guru/materi/partitur/baru" target="_blank" className="font-semibold text-primary hover:underline">
              {t("Write one")}
            </Link>{" "}
            ·{" "}
            <Link href="/guru/materi/partitur/unggah" target="_blank" className="font-semibold text-primary hover:underline">
              {t("Upload from MuseScore")}
            </Link>{" "}
            {t("(opens a new tab; reload this page afterwards).")}
          </p>
        </>
      );
    }
    case "checklist":
      return (
        <>
          <Field label={t("Title (optional)")}>
            <Input value={str(d.title)} onChange={(e) => onChange({ title: e.target.value })} maxLength={80} />
          </Field>
          <Field label={t("Items (one per line)")}>
            <Textarea rows={4} value={((d.items as string[]) ?? []).join("\n")} onChange={(e) => onChange({ items: lines(e.target.value) })} />
          </Field>
        </>
      );
    case "quiz": {
      const options = (d.options as string[]) ?? [];
      return (
        <>
          <Field label={t("Question")}>
            <Input value={str(d.question)} onChange={(e) => onChange({ question: e.target.value })} />
          </Field>
          <Field label={t("Answers (one per line, 2–6)")}>
            <Textarea rows={4} value={options.join("\n")} onChange={(e) => onChange({ options: lines(e.target.value) })} />
          </Field>
          <Field label={t("Right answer")}>
            <Select value={String(d.answer ?? 0)} onChange={(e) => onChange({ answer: Number(e.target.value) })}>
              {options.map((o, i) =>
                o.trim() ? (
                  <option key={i} value={i}>
                    {o}
                  </option>
                ) : null,
              )}
            </Select>
          </Field>
          <Field label={t("Explanation after answering (optional)")}>
            <Input value={str(d.explain)} onChange={(e) => onChange({ explain: e.target.value })} />
          </Field>
        </>
      );
    }
    case "video":
      return (
        <>
          <Field label={t("Video link (mp4/webm file)")} hint={t("A direct link to a video file you recorded yourself.")}>
            <Input type="url" value={str(d.url)} onChange={(e) => onChange({ url: e.target.value })} placeholder="https://…/video.mp4" />
          </Field>
          <Field label={t("Caption (optional)")}>
            <Input value={str(d.caption)} onChange={(e) => onChange({ caption: e.target.value })} />
          </Field>
        </>
      );
    case "image":
      return <ImageFields d={d} onChange={onChange} />;
    case "illustration":
      return (
        <>
          <Field label={t("Animation")} hint={t("An interactive drawing built into the app: students can tap it, and some of them play sound.")}>
            <Select value={str(d.name)} onChange={(e) => onChange({ name: e.target.value })}>
              <option value="">{t("Choose an animation…")}</option>
              {(Object.entries(ILLUSTRATIONS) as [IllustrationName, string][]).map(([name, label]) => (
                <option key={name} value={name}>
                  {t(label)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("Caption (optional)")}>
            <Input value={str(d.caption)} onChange={(e) => onChange({ caption: e.target.value })} />
          </Field>
        </>
      );
    default:
      return null;
  }
}

function ImageFields({ d, onChange }: { d: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void }) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, start] = useTransition();
  const upload = (file: File | undefined) => {
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    start(async () => {
      const r = await uploadLessonImage(fd);
      if (!r.ok || !r.data) return void toast.error(r.error);
      onChange({ fileKey: r.data.fileKey });
    });
  };
  return (
    <>
      {str(d.fileKey) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/files/${str(d.fileKey)}`} alt={str(d.alt)} className="max-h-64 rounded-lg border object-contain" />
      )}
      <div>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
        <Button size="sm" variant="outline" onClick={() => input.current?.click()} disabled={uploading}>
          {uploading ? <LoaderCircle className="animate-spin" /> : <ImagePlus />} {str(d.fileKey) ? t("Change picture") : t("Choose picture")}
        </Button>
        <p className="mt-1 text-xs text-muted-foreground">{t("Only your own photos or drawings, never pages from the printed book.")}</p>
      </div>
      <Field label={t("Description for screen readers")}>
        <Input value={str(d.alt)} onChange={(e) => onChange({ alt: e.target.value })} />
      </Field>
      <Field label={t("Caption (optional)")}>
        <Input value={str(d.caption)} onChange={(e) => onChange({ caption: e.target.value })} />
      </Field>
    </>
  );
}
