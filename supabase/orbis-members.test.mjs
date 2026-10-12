import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

/**
 * Runs orbis-members.sql against a local Postgres with stand-ins for the parts Supabase
 * provides (auth.users, auth.uid(), the anon and authenticated roles, storage tables),
 * then checks the rules as a reader, a paid member, an editor and a visitor would meet them.
 */

const STUBS = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
`;

const GRANTS = `
  grant usage on schema public, auth, storage to anon, authenticated;
  grant select, insert, update, delete on all tables in schema public to anon, authenticated;
  grant select, insert, delete on storage.objects to authenticated;
  grant execute on all functions in schema public, auth to anon, authenticated;
`;

const READER = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";
const THIRD = "33333333-3333-3333-3333-333333333333";
const FOURTH = "44444444-4444-4444-4444-444444444444";
const EDITOR = "99999999-9999-9999-9999-999999999999";

async function setup() {
  const db = new PGlite();
  await db.exec(STUBS);
  await db.exec(readFileSync(new URL("./orbis-members.sql", import.meta.url), "utf8"));
  // Running it a second time must be harmless.
  await db.exec(readFileSync(new URL("./orbis-members.sql", import.meta.url), "utf8"));
  await db.exec(GRANTS);
  for (const [id, email] of [
    [READER, "reader@example.com"],
    [OTHER, "other@example.com"],
    [THIRD, "third@example.com"],
    [FOURTH, "fourth@example.com"],
    [EDITOR, "editor@example.com"],
  ]) {
    await db.query("insert into auth.users (id, email) values ($1, $2)", [id, email]);
  }
  // As in the SQL editor: make the editor, give everyone a name.
  await db.exec(`update public.profiles set role = 'editor' where id = '${EDITOR}'`);
  await db.exec(`update public.profiles set display_name = 'Name ' || left(id::text, 4)`);
  return db;
}

/** Runs `sql` as a signed-in member (id) or a visitor (null), then returns to superuser. */
async function as(db, id, sql, params = []) {
  await db.exec(id ? "set role authenticated" : "set role anon");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id ?? ""]);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  }
}

const comment = (db, id, body, story = "rivers") =>
  as(
    db,
    id,
    "insert into public.comments (story_id, lang, body) values ($1, 'tr', $2) returning *",
    [story, body],
  );

/** Lets the next comment of this member through the one-a-minute limit. */
const age = (db, id) =>
  db.query(
    "update public.comments set created_at = created_at - interval '2 minutes' where user_id = $1",
    [id],
  );

test("a sign-up gets a profile; a reader cannot raise their own role or paid time", async () => {
  const db = await setup();
  const own = await as(db, READER, "select * from public.profiles");
  assert.equal(own.rows.length, 1, "a reader sees only their own profile");
  assert.equal(own.rows[0].email, "reader@example.com");
  await assert.rejects(
    as(db, READER, `update public.profiles set role = 'editor' where id = '${READER}'`),
    /not_allowed/,
  );
  await assert.rejects(
    as(
      db,
      READER,
      `update public.profiles set paid_until = now() + interval '1 year' where id = '${READER}'`,
    ),
    /not_allowed/,
  );
  await as(
    db,
    READER,
    `update public.profiles set display_name = '  Ayşe  ' where id = '${READER}'`,
  );
  const named = await db.query(`select display_name from public.profiles where id = '${READER}'`);
  assert.equal(named.rows[0].display_name, "Ayşe");
  const all = await as(db, EDITOR, "select * from public.profiles");
  assert.equal(all.rows.length, 5, "the editor sees every member");
  await as(
    db,
    EDITOR,
    `update public.profiles set paid_until = now() + interval '1 month' where id = '${READER}'`,
  );
});

test("comments: members write, everyone reads; links, blocked words and haste are refused", async () => {
  const db = await setup();
  const saved = await comment(db, READER, "  Güzel bir okuma.  ");
  assert.equal(saved.rows[0].body, "Güzel bir okuma.");
  assert.equal(saved.rows[0].user_id, READER);
  assert.equal(saved.rows[0].author_name, `Name ${READER.slice(0, 4)}`);

  const visitor = await as(db, null, "select body from public.comments where story_id = 'rivers'");
  assert.equal(visitor.rows.length, 1, "a visitor reads comments");
  await assert.rejects(
    comment(db, null, "Ziyaretçi yorumu"),
    /permission denied|sign_in_required|row-level/,
  );

  await assert.rejects(comment(db, READER, "İkinci yorum hemen"), /too_fast/);
  await age(db, READER);
  await assert.rejects(comment(db, READER, "Bakın https://example.com"), /links/);
  await assert.rejects(comment(db, READER, "Bakın www.example.org"), /links/);
  await assert.rejects(comment(db, READER, "Bakın orbis.com/x"), /links/);
  await assert.rejects(comment(db, READER, "Bu bir PİÇ yorum"), /words/);
  await assert.rejects(comment(db, READER, "what the fuck"), /words/);
  // Whole words only: "aq" inside a word, "shit" inside "shitake" pass.
  await comment(db, READER, "Aquarium ve shiitake, ikisi de olur.");
  await age(db, READER);
  // Numbers and dots that are not addresses pass.
  await comment(db, READER, "Yüzde 3.5 arttı, yani 2020'den beri.");

  await db.exec(`update public.profiles set display_name = null where id = '${OTHER}'`);
  await assert.rejects(comment(db, OTHER, "Adsız yorum"), /name_required/);

  // A member cannot write in someone else's name.
  await age(db, READER);
  const forged = await as(
    db,
    READER,
    `insert into public.comments (story_id, lang, body, user_id, hidden, report_count)
     values ('rivers', 'tr', 'Sahte', '${THIRD}', true, 9) returning user_id, hidden, report_count`,
  ).catch((error) => error);
  if (!(forged instanceof Error)) {
    assert.equal(forged.rows[0].user_id, READER);
    assert.equal(forged.rows[0].hidden, false);
    assert.equal(forged.rows[0].report_count, 0);
  }
});

test("three reports from three members hide a comment; the editor restores it", async () => {
  const db = await setup();
  const { rows } = await comment(db, READER, "Tartışmalı bir yorum");
  const id = rows[0].id;
  const report = (who) =>
    as(db, who, "insert into public.comment_reports (comment_id) values ($1)", [id]);

  await assert.rejects(report(READER), /own_comment/);
  await report(OTHER);
  await assert.rejects(report(OTHER), /duplicate|unique/);
  await report(THIRD);
  let seen = await as(db, null, "select id from public.comments");
  assert.equal(seen.rows.length, 1, "two reports leave it visible");
  await report(FOURTH);
  seen = await as(db, null, "select id from public.comments");
  assert.equal(seen.rows.length, 0, "the third report hides it");

  const forEditor = await as(db, EDITOR, "select hidden, report_count from public.comments");
  assert.deepEqual(forEditor.rows[0], { hidden: true, report_count: 3 });
  await as(db, EDITOR, "update public.comments set hidden = false where id = $1", [id]);
  seen = await as(db, null, "select id from public.comments");
  assert.equal(seen.rows.length, 1, "restored");

  // A reader cannot hide or unhide.
  await as(db, OTHER, "update public.comments set hidden = true where id = $1", [id]);
  seen = await as(db, null, "select id from public.comments");
  assert.equal(seen.rows.length, 1);
  // The author deletes their own; another member cannot.
  await as(db, OTHER, "delete from public.comments where id = $1", [id]);
  assert.equal((await db.query("select id from public.comments")).rows.length, 1);
  await as(db, READER, "delete from public.comments where id = $1", [id]);
  assert.equal((await db.query("select id from public.comments")).rows.length, 0);
});

test("members-only texts open only to paid members and the editor", async () => {
  const db = await setup();
  await as(
    db,
    EDITOR,
    "insert into public.member_texts (story_id, lang, body) values ('rivers', 'tr', 'Tam metin')",
  );
  await assert.rejects(
    as(
      db,
      READER,
      "insert into public.member_texts (story_id, lang, body) values ('x', 'tr', 'y')",
    ),
    /row-level/,
  );
  const read = (who) => as(db, who, "select body from public.member_texts");
  assert.equal((await read(null)).rows.length, 0, "visitor");
  assert.equal((await read(READER)).rows.length, 0, "unpaid member");
  await db.exec(
    `update public.profiles set paid_until = now() + interval '1 month' where id = '${READER}'`,
  );
  assert.equal((await read(READER)).rows[0].body, "Tam metin", "paid member");
  await db.exec(
    `update public.profiles set paid_until = now() - interval '1 day' where id = '${READER}'`,
  );
  assert.equal((await read(READER)).rows.length, 0, "expired membership");
  assert.equal((await read(EDITOR)).rows.length, 1, "editor");
});

test("reading history: each member sees and clears only their own list", async () => {
  const db = await setup();
  await as(db, READER, "select public.note_read('rivers-running-dry')");
  await as(db, READER, "select public.note_read('heat-and-the-plan')");
  await as(db, READER, "select public.note_read('rivers-running-dry')");
  await as(db, OTHER, "select public.note_read('grain-moves')");
  await as(db, null, "select public.note_read('grain-moves')");
  await as(db, READER, "select public.note_read('Not A Story; drop')");

  const own = await as(db, READER, "select story_id from public.history order by read_at desc");
  assert.deepEqual(
    own.rows.map((row) => row.story_id).sort(),
    ["heat-and-the-plan", "rivers-running-dry"],
    "one row per reading, a second visit only moves it up",
  );
  const visitor = await as(db, null, "select * from public.history");
  assert.equal(visitor.rows.length, 0, "a visitor sees no history and writes none");
  const editor = await as(db, EDITOR, "select * from public.history");
  assert.equal(editor.rows.length, 0, "the editor does not see members' history");
  await assert.rejects(
    as(db, READER, `insert into public.history (user_id, story_id) values ('${OTHER}', 'x')`),
    /row-level|permission denied/,
  );

  await as(db, READER, `delete from public.history where user_id = '${OTHER}'`);
  const other = await db.query(`select * from public.history where user_id = '${OTHER}'`);
  assert.equal(other.rows.length, 1, "a member cannot clear another member's list");
  await as(db, READER, "delete from public.history");
  const cleared = await db.query(`select * from public.history where user_id = '${READER}'`);
  assert.equal(cleared.rows.length, 0, "a member clears their own list");
});
