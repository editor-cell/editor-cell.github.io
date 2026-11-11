// Byte ranges for the recordings and films (owner, 11 Nov 2026).
// Cloudflare's static files answer every request with the whole file and never with a
// part of it. A browser that is asked to jump into the middle of a recording then cannot,
// and the listening ball springs back to the start. Only requests under /audio/ and
// /videos/ come here (`run_worker_first` in wrangler.jsonc); every other page and picture
// is served by Cloudflare directly, as before. The file itself still comes from the
// static files; this only cuts out the part the browser asked for.

const RANGE = /^bytes=(\d*)-(\d*)$/;

/** @param {Response} response */
function withRanges(response) {
  const out = new Response(response.body, response);
  out.headers.set("accept-ranges", "bytes");
  return out;
}

export default {
  /**
   * @param {Request} request
   * @param {{ ASSETS: { fetch: (request: Request) => Promise<Response> } }} env
   */
  async fetch(request, env) {
    if (request.method !== "GET" && request.method !== "HEAD") return env.ASSETS.fetch(request);
    const asked = RANGE.exec((request.headers.get("range") ?? "").trim());
    if (!asked || (!asked[1] && !asked[2])) return withRanges(await env.ASSETS.fetch(request));

    // Fetch the whole file, without the range or the "only if changed" questions.
    const headers = new Headers(request.headers);
    for (const name of ["range", "if-range", "if-none-match", "if-modified-since"])
      headers.delete(name);
    const whole = await env.ASSETS.fetch(new Request(request.url, { method: "GET", headers }));
    if (whole.status !== 200) return whole;

    const body = await whole.arrayBuffer();
    const size = body.byteLength;
    let start;
    let end;
    if (asked[1]) {
      start = Number(asked[1]);
      end = asked[2] ? Math.min(Number(asked[2]), size - 1) : size - 1;
    } else {
      start = Math.max(0, size - Number(asked[2]));
      end = size - 1;
    }

    const out = new Headers(whole.headers);
    out.set("accept-ranges", "bytes");
    if (start >= size || start > end) {
      out.set("content-range", `bytes */${size}`);
      out.delete("content-length");
      return new Response(null, { status: 416, headers: out });
    }
    out.set("content-range", `bytes ${start}-${end}/${size}`);
    out.set("content-length", String(end - start + 1));
    return new Response(request.method === "HEAD" ? null : body.slice(start, end + 1), {
      status: 206,
      headers: out,
    });
  },
};
