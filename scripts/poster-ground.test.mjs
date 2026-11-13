import assert from "node:assert/strict";
import { test } from "node:test";
import { posterGroundColor } from "../src/lib/poster-ground.ts";

function picture(background, foreground = [220, 30, 50], transparentBorder = false) {
  const pixels = new Uint8ClampedArray(20 * 12 * 4);
  for (let y = 0; y < 12; y++) {
    for (let x = 0; x < 20; x++) {
      const border = x === 0 || x === 19 || y === 0 || y === 11;
      pixels.set([...(border ? background : foreground), border && transparentBorder ? 0 : 255], (y * 20 + x) * 4);
    }
  }
  return pixels;
}

test("poster ground follows the edge instead of the large central illustration", () => {
  assert.equal(posterGroundColor(picture([15, 15, 15]), 20, 12), "rgb(15, 15, 15)");
});

test("different videos receive their own light or colored ground", () => {
  for (const color of [[238, 231, 217], [25, 40, 70], [43, 72, 51]]) {
    assert.equal(posterGroundColor(picture(color), 20, 12), `rgb(${color.join(", ")})`);
  }
});

test("small compression changes stay in the background color family", () => {
  const pixels = picture([16, 16, 16]);
  for (let x = 0; x < 20; x++) pixels.set([15 + x % 3, 15 + x % 3, 15 + x % 3, 255], x * 4);
  assert.equal(posterGroundColor(pixels, 20, 12), "rgb(16, 16, 16)");
});

test("transparent or missing pixels leave the neutral fallback in place", () => {
  assert.equal(posterGroundColor(picture([0, 0, 0], [220, 30, 50], true), 20, 12), null);
  assert.equal(posterGroundColor([], 20, 12), null);
});
