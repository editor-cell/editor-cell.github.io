import assert from "node:assert/strict";
import { test } from "node:test";
import { frontOrder } from "./front-order.ts";
import { formatDateRange } from "./text.ts";

const ids = (list: { id: string }[]) => list.map((s) => s.id);

test("issue date ranges have stable text for server and browser rendering", () => {
  assert.equal(formatDateRange("2026-09-30", "2026-10-09", "en"), "30 Sep – 9 Oct 2026");
  assert.equal(formatDateRange("2026-09-30", "2026-10-09", "tr"), "30 Eyl – 9 Eki 2026");
  assert.equal(formatDateRange("2026-10-01", "2026-10-09", "en"), "1 – 9 Oct 2026");
  assert.equal(formatDateRange("2025-12-30", "2026-01-02", "en"), "30 Dec 2025 – 2 Jan 2026");
  assert.equal(formatDateRange("2026-10-09", "2026-10-09", "tr"), "9 Eki 2026");
});

test("without issues the front page is newest first", () => {
  const list = [
    { id: "a", date: "2026-10-01" },
    { id: "b", date: "2026-10-03" },
    { id: "c", date: "2026-10-02" },
  ];
  assert.deepEqual(ids(frontOrder(list)), ["b", "c", "a"]);
});

test("the newest issue comes first by rank, older issues follow, then the rest", () => {
  const list = [
    { id: "old-2", date: "2026-10-01", issue: 1, rank: 2 },
    { id: "new-2", date: "2026-10-08", issue: 2, rank: 2 },
    { id: "loose", date: "2026-10-09" },
    { id: "new-1", date: "2026-10-07", issue: 2, rank: 1 },
    { id: "old-1", date: "2026-09-30", issue: 1, rank: 1 },
    { id: "new-x", date: "2026-10-06", issue: 2 },
  ];
  assert.deepEqual(ids(frontOrder(list)), ["new-1", "new-2", "new-x", "old-1", "old-2", "loose"]);
});
