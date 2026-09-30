import { resolve } from "node:path";
import { build } from "esbuild";

// DSH validates that every runtime dependency resolves inside the plugin's
// install closure; exceljs' transitive deps (readable-stream, bl) reach for
// Node built-in shims and fail that check. Bundling everything into one file
// leaves the plugin with no runtime dependencies at all.
const root = resolve(import.meta.dirname, "..");
await build({
  entryPoints: [resolve(root, "src/index.ts")],
  outfile: resolve(root, "lib/index.js"),
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node22",
  external: ["@deepseek-ai/*"],
  banner: { js: "import { createRequire as __dpgCreateRequire } from 'node:module'; const require = __dpgCreateRequire(import.meta.url);" },
  logLevel: "warning",
});
