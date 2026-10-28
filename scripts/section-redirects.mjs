import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Keep the static host's permanent redirects in step with the client router. */
export function sectionRedirects(repo = process.cwd()) {
  const types = readFileSync(join(repo, "src/lib/types.ts"), "utf8");
  const list = (name) => {
    const match = types.match(new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\]`));
    if (!match) throw new Error(`Cannot read ${name} for section redirects`);
    return [...match[1].matchAll(/"([^"]+)"/g)].map((item) => item[1]);
  };
  const langs = list("LANGS");
  const themes = list("THEMES");
  const legacy = types.match(/export const LEGACY_THEMES[^=]*=\s*\{([\s\S]*?)\}/);
  if (!legacy) throw new Error("Cannot read LEGACY_THEMES for section redirects");
  const aliases = [...legacy[1].matchAll(/^\s*(?:"([a-z-]+)"|([a-z-]+)):\s*"([a-z-]+)"/gm)]
    .map((match) => [match[1] || match[2], match[3]]);
  if (!aliases.length) throw new Error("No legacy section redirects found");
  for (const [from, to] of aliases) {
    if (themes.includes(from) || !themes.includes(to))
      throw new Error(`Invalid section redirect: ${from} → ${to}`);
  }
  return langs.flatMap((lang) => {
    const prefix = lang === "en" ? "" : `/${lang}`;
    return aliases.flatMap(([from, to]) =>
      ["", "/", ".html"].map((suffix) => ({
        from: `${prefix}/${from}${suffix}`,
        to: `${prefix}/${to}`,
        status: 301,
      })),
    );
  });
}

export function writeSectionRedirects(root, repo = process.cwd()) {
  const redirects = sectionRedirects(repo);
  writeFileSync(
    join(root, "_redirects"),
    "# Old section addresses keep their language and lead to the merged section.\n"
      + redirects.map(({ from, to, status }) => `${from} ${to} ${status}`).join("\n") + "\n",
  );
  return redirects;
}

/** Exact static redirect rules, shared by the preview server and browser checks. */
export function readRedirects(root) {
  const file = join(root, "_redirects");
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8").split(/\r?\n/).flatMap((line) => {
    const text = line.trim();
    if (!text || text.startsWith("#")) return [];
    const match = /^(\/\S*)\s+(\/\S*)\s+(301|302|303|307|308)$/.exec(text);
    if (!match || match[1].startsWith("//") || match[2].startsWith("//"))
      throw new Error(`Unsupported static redirect: ${text}`);
    return [{ from: match[1], to: match[2], status: Number(match[3]) }];
  });
}

export function redirectFor(redirects, address) {
  let url;
  try {
    url = new URL(address, "http://localhost");
  } catch {
    return undefined;
  }
  const rule = redirects.find(({ from }) => from === url.pathname);
  return rule ? { location: rule.to + url.search, status: rule.status } : undefined;
}
