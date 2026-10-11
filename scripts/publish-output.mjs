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
const MAX_FILES = 20_000; // Workers Free, also below the Paid limit.
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_RETAINED_BYTES = 64 * 1024 * 1024;
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const codeAsset = (path) => /^assets\/[^/]+-[^/]+\.(?:js|css|woff2?|png|svg|json)$/.test(path);
function checkLimits(files, root) {
  if (files.length > MAX_FILES) throw new Error("Cloudflare static asset file limit exceeded");
  for (const path of files)
    if (statSync(join(root, path)).size > MAX_FILE_BYTES)
      throw new Error(`Cloudflare 25 MiB limit exceeded: ${path}`);
}
export function placeSite(out, root, now = Date.now()) {
  const files = outputFiles(out);
  checkLimits(files, out);
  const old = existsSync(join(root, MANIFEST))
    ? JSON.parse(readFileSync(join(root, MANIFEST), "utf8"))
    : {};
  const previous = previousFiles(root);
  // The first upgraded publish also protects assets from the pre-manifest deployment.
  const currentCode = files.filter(codeAsset);
  const sameCode = (group) => JSON.stringify(group.files) === JSON.stringify(currentCode);
  const candidates = old.generations ?? [{ at: now, files: previous.filter(codeAsset) }];
  const generations = candidates
    .map((group, i) => (i === 0 ? { ...group, at: now } : group))
    .filter((group) => !sameCode(group) && now - group.at <= RETENTION_MS)
    .slice(0, 2);
  const retainedFiles = () =>
    [...new Set(generations.flatMap((group) => group.files))].filter(
      (path) => codeAsset(path) && !files.includes(path) && existsSync(join(root, path)),
    );
  let retained = retainedFiles();
  while (
    generations.length &&
    (files.length + retained.length > MAX_FILES ||
      retained.reduce((sum, path) => sum + statSync(join(root, path)).size, 0) > MAX_RETAINED_BYTES)
  ) {
    generations.pop();
    retained = retainedFiles();
  }
  const managed = [...new Set([...previous, ...(old.retained ?? [])])];
  for (const path of managed) {
    if (RESERVED.test(path) || path.includes("..") || path.startsWith("/"))
      throw new Error(`Unsafe old publish path: ${path}`);
    if (!files.includes(path) && !retained.includes(path))
      rmSync(join(root, path), { force: true });
  }
  for (const path of files) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    cpSync(join(out, path), join(root, path));
  }
  writeFileSync(
    join(root, MANIFEST),
    JSON.stringify(
      {
        files,
        retained,
        generations: [
          {
            at: old.generations?.[0] && sameCode(old.generations[0]) ? old.generations[0].at : now,
            files: currentCode,
          },
          ...generations,
        ],
      },
      null,
      2,
    ) + "\n",
  );
  verifySite(out, root);
  return [...new Set([...files, ...managed, MANIFEST])];
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
  const retained = manifest.retained ?? [];
  if (retained.some((path) => !codeAsset(path) || !existsSync(join(root, path))))
    throw new Error("Invalid retained assets");
  checkLimits([...files, ...retained], root);
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
