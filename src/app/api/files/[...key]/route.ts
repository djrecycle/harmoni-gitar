import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { isTeacherOfStudent } from "@/lib/access";
import { isFeatureEnabled } from "@/lib/features";
import { getCurrentUser, type CurrentUser } from "@/lib/session";
import { contentDisposition, openLocalFile, usesS3, isValidKey, mimeFromKey, s3ReadUrl } from "@/lib/storage";
import { getT } from "@/i18n/server";

export const runtime = "nodejs";

/**
 * Who may read a file, by key prefix (see KEY_PREFIXES in src/lib/storage.ts). Files are never public:
 *  - media/, score/   any signed-in user (lesson images and notation)
 *  - recording/<id>/  the student themself, or their teacher
 *  - payment/<id>/    their teacher only, and only while the payments feature is on
 */
async function canRead(user: CurrentUser, key: string): Promise<boolean> {
  const [prefix, owner] = key.split("/");
  if (prefix === "media" || prefix === "score") return true;
  if (prefix === "recording") return owner === user.id || (user.role === "teacher" && (await isTeacherOfStudent(user.id, owner)));
  if (prefix === "payment") return user.role === "teacher" && (await isFeatureEnabled("payments")) && (await isTeacherOfStudent(user.id, owner));
  return false;
}

export async function GET(req: Request, ctx: { params: Promise<{ key: string[] }> }) {
  const t = await getT();
  const user = await getCurrentUser();
  if (!user) return new NextResponse(t("Please sign in first."), { status: 401 });

  const key = (await ctx.params).key.map(decodeURIComponent).join("/");
  if (!isValidKey(key)) return new NextResponse(t("Not found"), { status: 404 });
  /** `?dl=<filename>` makes the browser save the file under that name instead of viewing it inline. */
  const downloadName = new URL(req.url).searchParams.get("dl") || undefined;

  if (!(await canRead(user, key))) return new NextResponse(t("Not allowed"), { status: 403 });

  const type = mimeFromKey(key);
  const playhead: Record<string, string> = {
    "Content-Type": type,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, max-age=3600",
    "Accept-Ranges": "bytes",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    ...(downloadName ? { "Content-Disposition": contentDisposition(downloadName) } : {}),
  };

  if (usesS3()) {
    try {
      return NextResponse.redirect(await s3ReadUrl(key, downloadName), 302);
    } catch {
      return new NextResponse(t("Storage unavailable"), { status: 502 });
    }
  }

  try {
    const rangeHeader = req.headers.get("range");
    const { size } = await openLocalFile(key);
    let range: { start: number; end: number } | undefined;
    if (rangeHeader) {
      const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
      if (m) {
        let start = m[1] ? Number(m[1]) : NaN;
        let end = m[2] ? Number(m[2]) : NaN;
        if (Number.isNaN(start)) {
          // "bytes=-500" = the last 500 bytes
          start = Math.max(0, size - end);
          end = size - 1;
        } else if (Number.isNaN(end) || end >= size) end = size - 1;
        if (start > end || start >= size) {
          return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
        }
        range = { start, end };
      }
    }
    const { stream } = await openLocalFile(key, range);
    const web = Readable.toWeb(stream) as ReadableStream;
    if (range) {
      return new NextResponse(web, {
        status: 206,
        headers: {
          ...playhead,
          "Content-Range": `bytes ${range.start}-${range.end}/${size}`,
          "Content-Length": String(range.end - range.start + 1),
        },
      });
    }
    return new NextResponse(web, { headers: { ...playhead, "Content-Length": String(size) } });
  } catch {
    return new NextResponse(t("Not found"), { status: 404 });
  }
}
