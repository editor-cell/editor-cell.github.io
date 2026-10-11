import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { siteServer } from "./site-server.mjs";

test("static host resolves HTML and preserves a real 404 for missing chunks", async () => {
  const dir = mkdtempSync(join(tmpdir(), "orbis-host-"));
  mkdirSync(join(dir, "tr"));
  writeFileSync(join(dir, "tr/index.html"), "Turkish");
  writeFileSync(join(dir, "reading.html"), "Reading");
  writeFileSync(join(dir, "404.html"), "Not found");
  const server = siteServer(dir);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const [path, status, body] of [
      ["/tr/", 200, "Turkish"],
      ["/reading", 200, "Reading"],
      ["/assets/missing.js", 404, "Not found"],
    ]) {
      const response = await fetch(base + path);
      assert.equal(response.status, status);
      assert.equal(await response.text(), body);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
    rmSync(dir, { recursive: true });
  }
});
