/** "Latihan Arpeggio É 1" -> "latihan-arpeggio-e-1" (lowercase letters, numbers and dashes, like content slugs). */
export function slugify(s: string) {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
