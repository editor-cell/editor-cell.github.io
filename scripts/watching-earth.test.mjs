import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Exercise the actual component lifecycle with a deterministic animation clock.
function mountEarth() {
  const effects = [], renderers = [], frames = new Map(), screenEvents = new Map();
  const documentEvents = new Map(), windowEvents = new Map();
  const screen = {
    width: 600, height: 600, dataset: { renderer: "webgl" },
    addEventListener: (name, callback) => screenEvents.set(name, callback),
    removeEventListener: name => screenEvents.delete(name),
  };
  const element = { clientWidth: 400 };
  let ref = 0, frameId = 0, observer, ready = false;
  const document = {
    hidden: false,
    addEventListener: (name, callback) => documentEvents.set(name, callback),
    removeEventListener: name => documentEvents.delete(name),
  };
  const reduced = { matches: false, addEventListener() {}, removeEventListener() {} };
  const window = {
    devicePixelRatio: 1, matchMedia: () => reduced,
    addEventListener: (name, callback) => windowEvents.set(name, callback),
    removeEventListener: name => windowEvents.delete(name),
  };
  const react = {
    useRef: initial => ({ current: ref++ === 0 ? element : ref === 2 ? screen : initial }),
    useState: () => [false, value => { ready = value; }],
    useEffect: effect => effects.push(effect),
  };
  const jsx = (type, props) => ({ type, props });
  const exports = {};
  const source = ts.transpileModule(readFileSync(new URL("../src/components/watching-earth.tsx", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  runInNewContext(source, {
    exports, window, document,
    require: name => name === "react" ? react : name === "react/jsx-runtime" ? { jsx, jsxs: jsx } : {
      createEarthRenderer: (_screen, onReady, initialTurn) => {
        const renderer = { initialTurn, onReady, turns: [], disposed: false,
          draw(turn) { this.turns.push(turn); }, dispose() { this.disposed = true; } };
        renderers.push(renderer);
        return renderer;
      },
    },
    requestAnimationFrame: callback => { frames.set(++frameId, callback); return frameId; },
    cancelAnimationFrame: id => frames.delete(id),
    IntersectionObserver: class {
      constructor(callback) { observer = callback; }
      observe() {} disconnect() {}
    },
    ResizeObserver: class { observe() {} disconnect() {} },
  });
  exports.WatchingEarth({});
  const cleanup = effects[0]();
  effects[1]();
  observer([{ isIntersecting: true }]);
  renderers[0].onReady();
  function advance(now) {
    const pending = [...frames.values()]; frames.clear();
    for (const callback of pending) callback(now);
  }
  return { renderers, screenEvents, documentEvents, windowEvents, document, advance, cleanup,
    get ready() { return ready; }, get pendingFrames() { return frames.size; } };
}

test("Earth continues from its current angle after graphics context restoration", () => {
  const earth = mountEarth();
  earth.advance(100); earth.advance(150); earth.advance(200);
  const first = earth.renderers[0], angle = first.turns.at(-1);
  assert.ok(angle > 0);
  let prevented = false;
  earth.screenEvents.get("webglcontextlost")({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(earth.ready, false);
  assert.equal(earth.pendingFrames, 0);
  earth.screenEvents.get("webglcontextrestored")();
  const second = earth.renderers[1];
  assert.equal(first.disposed, true);
  assert.equal(second.initialTurn, angle);
  second.onReady();
  assert.equal(earth.ready, true);
  earth.advance(1000); earth.advance(1050);
  assert.ok(second.turns.at(-1) > angle);
  earth.cleanup();
  assert.equal(earth.pendingFrames, 0);
  assert.equal(earth.screenEvents.size, 0);
  assert.equal(earth.windowEvents.size, 0);
});

test("Earth resumes when a hidden page becomes visible without counting hidden time", () => {
  const earth = mountEarth();
  earth.advance(100); earth.advance(150);
  const renderer = earth.renderers[0], angle = renderer.turns.at(-1);
  earth.document.hidden = true;
  earth.documentEvents.get("visibilitychange")();
  assert.equal(earth.pendingFrames, 0);
  earth.advance(60000);
  assert.equal(renderer.turns.at(-1), angle);
  earth.document.hidden = false;
  earth.documentEvents.get("visibilitychange")();
  earth.advance(60100);
  assert.equal(renderer.turns.at(-1), angle);
  earth.advance(60150);
  assert.ok(renderer.turns.at(-1) > angle);
  assert.ok(renderer.turns.at(-1) - angle < 0.001);
  earth.cleanup();
});
