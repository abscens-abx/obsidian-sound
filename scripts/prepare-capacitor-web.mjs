// Copies the SPA client build into dist/capacitor with index.html for Capacitor.
import { cpSync, existsSync, rmSync, renameSync } from "node:fs";
const src = "dist/client";
const out = "dist/capacitor";
if (!existsSync(`${src}/_shell.html`)) {
  console.error("Missing dist/client/_shell.html — run with CAPACITOR_BUILD=1.");
  process.exit(1);
}
rmSync(out, { recursive: true, force: true });
cpSync(src, out, { recursive: true });
renameSync(`${out}/_shell.html`, `${out}/index.html`);
console.log("Prepared", out);
