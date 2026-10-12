import assert from "node:assert/strict";
import test from "node:test";
import { MEMBERS, membersOn } from "./config.ts";
import { errorText, membersCopy } from "./copy.ts";
import { extendPaid, safeBack } from "./rules.ts";
import { isPaid, type Profile } from "./session.ts";

test("membership is on with the project's public key only", () => {
  assert.equal(MEMBERS.enabled, true);
  assert.equal(membersOn, true);
  assert.match(MEMBERS.supabaseUrl, /^https:\/\/[a-z0-9]+\.supabase\.co$/);
  // The public key only: a secret key ("sb_secret_…" or a service_role token) never goes
  // in page code.
  assert.match(MEMBERS.supabaseKey, /^sb_publishable_/);
});

test("every language has every sentence", () => {
  const keys = (value: object): string[] =>
    Object.entries(value).flatMap(([key, item]) =>
      item && typeof item === "object" ? keys(item).map((k) => `${key}.${k}`) : [key],
    );
  const english = keys(membersCopy("en")).sort();
  for (const lang of ["tr", "ar", "fr", "es"] as const) {
    assert.deepEqual(keys(membersCopy(lang)).sort(), english, lang);
    for (const [key, value] of Object.entries(membersCopy(lang))) {
      if (typeof value === "string") assert.ok(value.trim(), `${lang}.${key} is empty`);
    }
  }
});

test("database refusals become the reader's sentence", () => {
  const tr = membersCopy("tr").errors;
  assert.equal(errorText({ message: "links" }, "tr"), tr.links);
  assert.equal(errorText({ message: "words" }, "tr"), tr.words);
  assert.equal(errorText({ message: "too_fast" }, "tr"), tr.tooFast);
  assert.equal(errorText({ message: "too_many" }, "tr"), tr.tooMany);
  assert.equal(errorText({ message: "name_required" }, "tr"), tr.nameRequired);
  assert.equal(errorText({ code: "23505", message: "duplicate key value" }, "tr"), tr.alreadyReported);
  assert.equal(errorText({ message: "Token has expired or is invalid" }, "tr"), tr.badCode);
  assert.equal(errorText(new Error("network down"), "tr"), tr.generic);
});

test("the way back after signing in stays on this site", () => {
  assert.equal(safeBack("/tr/read/rivers"), "/tr/read/rivers");
  assert.equal(safeBack("//evil.example"), null);
  assert.equal(safeBack("https://evil.example"), null);
  assert.equal(safeBack("/\\evil.example"), null);
  assert.equal(safeBack(undefined), null);
});

test("paid time is added on to what is left, or counted from now", () => {
  const now = new Date("2026-10-02T12:00:00Z");
  assert.equal(extendPaid(null, 1, now), "2026-11-02T12:00:00.000Z");
  assert.equal(extendPaid("2026-01-01T00:00:00Z", 12, now), "2027-10-02T12:00:00.000Z");
  assert.equal(extendPaid("2026-12-01T00:00:00.000Z", 1, now), "2027-01-01T00:00:00.000Z");
});

test("paid members and the editor open members-only things; others do not", () => {
  const base: Profile = { id: "a", email: null, display_name: null, role: "reader", paid_until: null };
  const now = Date.parse("2026-10-02T12:00:00Z");
  assert.equal(isPaid(null, now), false);
  assert.equal(isPaid(base, now), false);
  assert.equal(isPaid({ ...base, paid_until: "2026-10-03T00:00:00Z" }, now), true);
  assert.equal(isPaid({ ...base, paid_until: "2026-10-01T00:00:00Z" }, now), false);
  assert.equal(isPaid({ ...base, role: "editor" }, now), true);
});
