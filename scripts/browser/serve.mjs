import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, sep } from "node:path";
import { readRedirects, redirectFor } from "../section-redirects.mjs";

/**
 * Serves a built site the way Cloudflare serves the repository root (wrangler.jsonc:
 * "not_found_handling": "404-page"): a file as it is, an address without an extension from
 * its .html file or its folder's index.html, and anything else from 404.html with status
 * 404. A missing script therefore comes back as an HTML page, as it does on the live site.
 */

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".mp4": "video/mp4",
  ".pdf": "application/pdf",
};

const isFile = (path) => existsSync(path) && statSync(path).isFile();

/** The file Cloudflare would answer an address with, or null (404 page). */
export function resolveAddress(root, address) {
  let path;
  try {
    path = decodeURIComponent(address.split(/[?#]/, 1)[0]);
  } catch {
    return null;
  }
  const clean = normalize(path).replace(/^([/\\])+/, "");
  if (clean.split(sep).includes("..")) return null;
  const base = join(root, clean);
  if (clean && isFile(base)) return base;
  if (clean && !extname(clean) && isFile(`${base}.html`)) return `${base}.html`;
  if (isFile(join(base, "index.html"))) return join(base, "index.html");
  return null;
}

/** Starts the server on a free port; resolves to { url, close }. */
export function serveSite(root) {
  const redirects = readRedirects(root);
  const server = createServer((req, res) => {
    const redirect = redirectFor(redirects, req.url ?? "/");
    if (redirect) {
      res.writeHead(redirect.status, { location: redirect.location }).end();
      return;
    }
    const file = resolveAddress(root, req.url ?? "/");
    const status = file ? 200 : 404;
    const body = file ?? join(root, "404.html");
    if (!isFile(body)) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    const size = statSync(body).size;
    const type = TYPES[extname(body).toLowerCase()] ?? "application/octet-stream";
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? "");
    // Audio and video players ask for byte ranges; answer them as a host would.
    if (file && range && (range[1] || range[2])) {
      const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
      const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
      res.writeHead(206, {
        "content-type": type,
        "content-length": end - start + 1,
        "content-range": `bytes ${start}-${end}/${size}`,
        "accept-ranges": "bytes",
      });
      createReadStream(body, { start, end }).pipe(res);
      return;
    }
    res.writeHead(status, {
      "content-type": type,
      "content-length": size,
      "accept-ranges": "bytes",
    });
    if (req.method === "HEAD") res.end();
    else createReadStream(body).pipe(res);
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}
