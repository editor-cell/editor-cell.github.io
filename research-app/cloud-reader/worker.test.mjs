import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { MODEL, VERSION, parseAnswer } from './worker.mjs';

function environment(answer = { verdict: 'SUPPORTS', query_kind: 'claim', reason: 'Aynı sonucu bildiriyor.' }) {
  let calls = 0;
  return {
    get calls() { return calls; },
    REQUEST_LIMIT: { limit: async () => ({ success: true }) },
    AI: { run: async (model, input) => { calls++; assert.equal(model, MODEL); assert.equal(input.temperature, 0); return { response: `<think>short reasoning</think>\n${JSON.stringify(answer)}` }; } },
  };
}
const request = (body) => new Request('https://test/judge', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('health identifies the exact hosted model without inference', async () => {
  const env = environment();
  const response = await worker.fetch(new Request('https://test/health'), env);
  assert.deepEqual(await response.json(), { ok: true, model: MODEL, version: VERSION });
  assert.equal(env.calls, 0);
});
test('completed reasoning is removed and verdict returned with model identity', async () => {
  const response = await worker.fetch(request({ query: 'X causes Y', paragraph: 'The trial found that X caused Y.' }), environment());
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.verdict, 'SUPPORTS');
  assert.equal(result.model, MODEL);
});
test('an incomplete or invented model answer is an error, never unrelated evidence', async () => {
  assert.throws(() => parseAnswer('<think>unfinished {"verdict":"SUPPORTS"}'));
  const response = await worker.fetch(request({ query: 'X', paragraph: 'Y' }), environment({ verdict: 'MAYBE' }));
  assert.equal(response.status, 502);
  assert.equal((await response.json()).verdict, undefined);
});
test('topic contradiction is rejected instead of becoming a false opposing result', async () => {
  assert.throws(() => parseAnswer(JSON.stringify({ verdict: 'CONTRADICTS', query_kind: 'topic', reason: 'Başlık' })));
});
test('invalid and oversized bodies never reach the model', async () => {
  const env = environment();
  for (const body of [{}, { query: 'x', paragraph: '' }, { query: 'x', paragraph: 'a'.repeat(24001) }]) {
    assert.equal((await worker.fetch(request(body), env)).status, 400);
  }
  assert.equal((await worker.fetch(request({ query: 'x', paragraph: 'a'.repeat(120000) }), env)).status, 413);
  assert.equal(env.calls, 0);
});
test('rate limiting prevents inference', async () => {
  const env = environment();
  env.REQUEST_LIMIT.limit = async () => ({ success: false });
  assert.equal((await worker.fetch(request({ query: 'x', paragraph: 'y' }), env)).status, 429);
  assert.equal(env.calls, 0);
});
test('provider errors remain recoverable server errors', async () => {
  const env = environment();
  env.AI.run = async () => { throw new Error('quota'); };
  assert.equal((await worker.fetch(request({ query: 'x', paragraph: 'y' }), env)).status, 502);
});
