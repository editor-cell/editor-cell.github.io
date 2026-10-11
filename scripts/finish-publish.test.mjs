import assert from "node:assert/strict";
import test from "node:test";
import { finishPublish } from "./finish-publish.mjs";
for (const timing of ["before publish", "during push", "no change"]) {
  test(`a newer main ${timing} never receives an old build`, () => {
    let pushed = false,
      committed = false,
      fetched = 0;
    const status = finishPublish("unused", (...args) => {
      const command = args.join(" ");
      if (command === "rev-parse HEAD") return "old";
      if (command === "fetch origin main") {
        fetched++;
        return "";
      }
      if (command === "rev-parse origin/main")
        return timing === "before publish" || fetched > 1 ? "new" : "old";
      if (args[0] === "diff") return "index.html";
      if (args[0] === "commit") {
        committed = true;
        return "";
      }
      if (args[0] === "push") {
        pushed = true;
        if (timing === "during push") throw new Error("non-fast-forward");
        return "";
      }
      throw new Error(command);
    });
    assert.equal(status, timing === "no change" ? "published" : "superseded");
    assert.equal(committed, timing !== "before publish");
    assert.equal(pushed, timing !== "before publish");
  });
}
