import {
  cpSync,
  existsSync,
  readdirSync,
  readFileSync,
  mkdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
const MANIFEST = ".site-output.json";
const RESERVED =
  /^(?:src|scripts|tests|content|public|supabase|server|node_modules|\.git[^/]*)(?:\/|$)|^(?:package(?:-lock)?\.json|.*\.config\.[^/]+|CLAUDE\.md|README\.md|wrangler\.jsonc)$/;
export function outputFiles(root, prefix = "") {
  return readdirSync(join(root, prefix))
    .flatMap((name) => {
      const path = prefix + name;
      if (path === "_shell.html") return [];
      if (RESERVED.test(path) || path.includes(".."))
        throw new Error(`Unsafe publish path: ${path}`);
      return statSync(join(root, path)).isDirectory() ? outputFiles(root, path + "/") : [path];
    })
    .sort();
}
function previousFiles(root) {
  if (existsSync(join(root, MANIFEST)))
    return JSON.parse(readFileSync(join(root, MANIFEST), "utf8")).files;
  // Bootstrap only: old workflow's outputs, including an English media folder if present.
  try {
    return execFileSync("git", ["ls-files"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .trim()
      .split("\n")
      .filter(
        (path) =>
          /^(?:assets|__grok|read|media|tr|ar|fr|es)\//.test(path) ||
          /^(?:[^/]+\.html|favicon\.svg|og\.jpg|robots\.txt|sitemap\.xml|feed\.xml|\.nojekyll)$/.test(
            path,
          ),
      );
  } catch {
    return [];
  }
}
export function placeSite(out, root) {
  const files = outputFiles(out);
  const previous = previousFiles(root);
  for (const path of previous) {
    if (RESERVED.test(path) || path.includes("..") || path.startsWith("/"))
      throw new Error(`Unsafe old publish path: ${path}`);
    if (!files.includes(path)) rmSync(join(root, path), { force: true });
  }
  for (const path of files) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    cpSync(join(out, path), join(root, path));
  }
  writeFileSync(join(root, MANIFEST), JSON.stringify({ files }, null, 2) + "\n");
  verifySite(out, root);
  return [...new Set([...files, ...previous, MANIFEST])];
}
export function verifySite(out, root) {
  const files = outputFiles(out);
  const manifest = JSON.parse(readFileSync(join(root, MANIFEST), "utf8"));
  if (JSON.stringify(files) !== JSON.stringify(manifest.files))
    throw new Error("Published file list differs from build");
  for (const path of files) {
    if (
      !existsSync(join(root, path)) ||
      !readFileSync(join(out, path)).equals(readFileSync(join(root, path)))
    )
      throw new Error(`Published file differs or is missing: ${path}`);
  }
  console.log(`[publish] ${files.length} files match the build`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = process.cwd();
  const out = join(root, "dist/client");
  if (process.argv.includes("--check")) verifySite(out, root);
  else {
    const paths = placeSite(out, root);
    if (process.argv.includes("--stage"))
      execFileSync("git", ["add", "-A", "--", ...paths], { cwd: root });
  }
}
