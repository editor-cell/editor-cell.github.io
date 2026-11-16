import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function mountOpening({ reduced = false, muted = false } = {}) {
  const frames = new Map(), events = new Map(), refs = [], animations = [], dives = [];
  let cursor = 0, id = 0, effect, opening = false, decoded, cleanup;
  const animate = () => {
    const animation = { currentTime: 0, cancelled: false, pause() {}, cancel() { this.cancelled = true; } };
    animations.push(animation); return animation;
  };
  const video = { muted, paused: false, isConnected: true, readyState: 2, plays: 0,
    getBoundingClientRect: () => ({ width: 600, height: 337.5 }), animate,
    requestVideoFrameCallback: callback => { decoded = callback; return 1; },
    cancelVideoFrameCallback() { decoded = null; },
    addEventListener: (event, callback) => events.set(event, callback),
    removeEventListener: event => events.delete(event),
    pause() { this.paused = true; },
    play() { this.paused = false; this.plays++; return Promise.resolve(); },
  };
  const canvas = { dispatchEvent(event) { event.detail.handled = true; dives.push(event.detail.progress); } };
  const cover = { style: {}, animate, querySelector: selector => selector === 'canvas' ? canvas : null,
    getBoundingClientRect: () => ({ width: 496, height: 496 }) };
  const box = { current: { querySelector: () => cover, querySelectorAll: () => [] } }, film = { current: video };
  const exports = {};
  const source = ts.transpileModule(readFileSync(new URL('../src/lib/use-portal-opening.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  runInNewContext(source, {
    exports, document: { hidden: false }, require: () => ({
      useRef: initial => refs[cursor++] ?? (refs[cursor - 1] = { current: initial }),
      useState: () => [opening, value => { opening = value; }],
      useLayoutEffect: callback => { effect = callback; },
    }),
    window: { matchMedia: () => ({ matches: reduced }), addEventListener() {}, removeEventListener() {} },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    requestAnimationFrame: callback => { frames.set(++id, callback); return id; },
    cancelAnimationFrame: key => frames.delete(key),
  });
  function render(started) {
    cursor = 0;
    return exports.usePortalOpening({ box, film, enabled: true, started, full: false });
  }
  render(false).prepare();
  render(true); cleanup = effect();
  function advance(from, to) {
    for (let now = from; now <= to; now += 16) {
      const pending = [...frames.values()]; frames.clear();
      pending.forEach(callback => callback(now));
    }
  }
  return { video, animations, dives, frames, events, advance,
    cover, decode: () => decoded?.(), cleanup: () => cleanup?.(), get opening() { return opening; } };
}

test('a slow video waits inside the approach without exposing a blank frame or starting narration', () => {
  const view = mountOpening();
  view.advance(16, 6000);
  assert.equal(view.opening, true);
  assert.equal(view.video.muted, true);
  assert.equal(view.video.plays, 0);
  assert.ok(view.animations[1].currentTime < 1900 * .62);
  view.cleanup();
  assert.equal(view.video.muted, false);
  assert.equal(view.frames.size, 0);
  assert.equal(view.events.size, 0);
});

test('the first decoded frame waits for the atmospheric crossing before picture and narration resume', async () => {
  const view = mountOpening();
  view.decode();
  assert.equal(view.video.paused, true);
  view.advance(16, 1000);
  assert.equal(view.video.plays, 0);
  view.advance(1016, 1300);
  await Promise.resolve();
  assert.equal(view.video.plays, 1);
  assert.equal(view.video.muted, false);
  view.advance(1316, 2400);
  assert.equal(view.opening, false);
  assert.equal(view.frames.size, 0);
  assert.ok(view.animations.every(animation => animation.cancelled));
  assert.equal(view.dives.at(-1), 1);
  // Hidden before its animations are cancelled: no flash of the held cloud frame.
  assert.equal(view.cover.style.visibility, 'hidden');
  view.cleanup();
});

test('muted playback stays muted and reduced-motion skips the approach', async () => {
  const view = mountOpening({ muted: true });
  view.decode(); view.advance(16, 2400); await Promise.resolve();
  assert.equal(view.video.muted, true);
  view.cleanup();
  const still = mountOpening({ reduced: true });
  assert.equal(still.opening, false);
  assert.equal(still.animations.length, 0);
  assert.equal(still.video.muted, false);
});
