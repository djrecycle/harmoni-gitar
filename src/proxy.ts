import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * First layer only (fast, no DB): no session cookie -> redirect to /masuk.
 *  The real role check lives in the layouts and in every server action (requireTeacher / requireStudent).
 */
export function proxy(req: NextRequest) {
  if (!getSessionCookie(req)) {
    const url = req.nextUrl.clone();
    url.pathname = "/masuk";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/guru/:path*", "/siswa/:path*", "/ganti-sandi"] };
