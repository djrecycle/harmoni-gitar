// Copy alphaTab's browser files to public/alphatab/ (run automatically before `dev` and `build`).
// The app loads alphaTab from there at runtime instead of bundling it, so its web worker, audio worklet,
// music font and sound font are all found next to the script (Turbopack does not bundle audio worklets).
import fs from "node:fs";
import path from "node:path";

const from = path.join(process.cwd(), "node_modules", "@coderline", "alphatab", "dist");
const to = path.join(process.cwd(), "public", "alphatab");
const files = [
  "alphaTab.mjs",
  "alphaTab.core.mjs",
  "alphaTab.worker.mjs",
  "alphaTab.worklet.mjs",
  "font/Bravura.woff2",
  "font/Bravura.woff",
  "font/Bravura.otf",
  "font/Bravura-OFL.txt",
  "soundfont/sonivox.sf2",
  "soundfont/LICENSE",
];
for (const f of files) {
  fs.mkdirSync(path.dirname(path.join(to, f)), { recursive: true });
  fs.copyFileSync(path.join(from, f), path.join(to, f));
}
console.log(`alphaTab: ${files.length} file disalin ke public/alphatab/`);
