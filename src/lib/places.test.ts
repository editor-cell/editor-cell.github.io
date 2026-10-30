import assert from "node:assert/strict";
import { test } from "node:test";
import { isWorld, namedPlaces, placeIndex, placeLine, splitPlaces } from "./places.ts";

test("the places of a reading read as a sentence", () => {
  assert.deepEqual(splitPlaces("Denmark · Austria · Greece"), ["Denmark", "Austria", "Greece"]);
  assert.equal(placeLine("Denmark · Austria · Greece", "en"), "Denmark, Austria and Greece");
  assert.equal(placeLine("Kobe · Port-au-Prince", "en"), "Kobe and Port-au-Prince");
  assert.equal(placeLine("Danimarka · Avusturya · Yunanistan", "tr"), "Danimarka, Avusturya ve Yunanistan");
  assert.equal(placeLine("Lagos", "en"), "Lagos");
  assert.equal(placeLine("", "en"), "");
  assert.equal(placeLine(undefined, "tr"), "");
});

test("the whole world is one word in each language, not a place in the index", () => {
  for (const word of ["Global", "Dünya", "Küresel", "worldwide"]) assert.ok(isWorld(word), word);
  assert.equal(placeLine("Global", "en"), "Worldwide");
  assert.equal(placeLine("Küresel", "tr"), "Dünya geneli");
  assert.equal(placeLine("Dünya", "tr"), "Dünya geneli");
  assert.equal(placeLine("Global · United States", "en"), "Worldwide, United States");
  assert.deepEqual(namedPlaces("Global · United States"), ["United States"]);
});

test("the index lists every named place once, in the language's alphabetical order", () => {
  const readings = [
    { id: "rivers", region: "Colorado · Sarı Irmak · Aral havzası" },
    { id: "grain", region: "Karadeniz · Mekong · Paraná" },
    { id: "clock", region: "Küresel" },
    { id: "again", region: "Çin · Colorado" },
  ];
  const index = placeIndex(readings, (r) => r.region, "tr");
  assert.deepEqual(
    index.map((entry) => entry.place),
    ["Aral havzası", "Colorado", "Çin", "Karadeniz", "Mekong", "Paraná", "Sarı Irmak"],
  );
  assert.deepEqual(
    index.find((entry) => entry.place === "Colorado")?.items.map((r) => r.id),
    ["rivers", "again"],
  );
});
