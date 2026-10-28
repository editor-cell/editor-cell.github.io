import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { readRedirects, redirectFor } from "./section-redirects.mjs";

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".vtt": "text/vtt",
};
const file = (path) => existsSync(path) && statSync(path).isFile();

/** Static assets, extensionless HTML, and a real 404 response with the site shell. */
export function siteServer(directory) {
  const root = resolve(directory);
  const redirects = readRedirects(root);
  return createServer((req, res) => {
    if (!["GET", "HEAD"].includes(req.method)) {
      res.writeHead(405).end();
      return;
    }
    let name;
    try {
      name = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    } catch {
      res.writeHead(400).end();
      return;
    }
    const redirect = redirectFor(redirects, req.url);
    if (redirect) {
      res.writeHead(redirect.status, { location: redirect.location }).end();
      return;
    }
    const base = resolve(root, `.${name}`);
    if (base !== root && !base.startsWith(root + sep)) {
      res.writeHead(403).end();
      return;
    }
    const target = [base, `${base}.html`, resolve(base, "index.html")].find(file);
    const path = target ?? resolve(root, "404.html");
    if (!file(path)) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(target ? 200 : 404, {
      "content-type": `${MIME[extname(path)] ?? "application/octet-stream"}; charset=utf-8`,
      "cache-control": "no-store",
    });
    if (req.method === "HEAD") res.end();
    else createReadStream(path).pipe(res);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  siteServer(process.argv[2] ?? "dist/client").listen(Number(process.argv[3] ?? 4179), "127.0.0.1");
}
