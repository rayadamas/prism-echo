import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {once} from 'node:events';
import {defaults, prepareEcho, render} from '../src/engine.mjs';
import {createRenderer} from '../src/renderer.mjs';
import {portrait} from './fixtures.mjs';

test('background worker returns identical preview and export pixels and retains job IDs', async () => {
  const worker = new Worker(new URL('./worker-harness.mjs', import.meta.url));
  try {
    const [ready] = await once(worker, 'message'); assert(ready.ready);
    const f = portrait(72, 80), echo = prepareEcho(f.data, f.mask, f.w, f.h, 82);
    const expected = render(f.data, f.w, f.h, f.mask, echo, defaults);
    for (const [id, kind] of [[1, 'output'], [2, 'overlay'], [3, 'subject']]) {
      const response = once(worker, 'message'); worker.postMessage({...f, echo, id, kind, config: defaults});
      const [message] = await response; assert.equal(message.id, id); assert.deepEqual(message.pixels, expected[kind]);
    }
    const response = once(worker, 'message');
    worker.postMessage({...f, id: 4, kind: 'overlay', config: defaults});
    assert.deepEqual((await response)[0].pixels, expected.overlay, 'exports prepare their own echo fields');
    const error = once(worker, 'message'); worker.postMessage({id: 5});
    const [message] = await error; assert.equal(message.id, 5); assert.equal(typeof message.error, 'string');
  } finally { await worker.terminate(); }
});
test('renderer falls back when module workers are unavailable', async () => {
  const f = portrait(40, 40), echo = prepareEcho(f.data, f.mask, f.w, f.h, 82);
  const expected = render(f.data, f.w, f.h, f.mask, echo, defaults);
  const pixels = await createRenderer()({...f, echo, config: defaults, kind: 'overlay'});
  assert.deepEqual(pixels, expected.overlay);
});
