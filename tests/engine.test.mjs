import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults, palettes, random, extractMask, blurField, focusFromMask, prepareEcho, makeLayers, render} from '../src/engine.mjs';
import {portrait} from './fixtures.mjs';

const f = portrait(), echo = prepareEcho(f.data, f.mask, f.w, f.h, 82);
const run = (config = {}, fields = echo, fixture = f) => render(fixture.data, fixture.w, fixture.h, fixture.mask, fields, {...defaults, ...config});

test('same source and recipe reproduce every output pixel; new seeds change the effect', () => {
  const a = run(); assert.deepEqual(a, run());
  assert.notDeepEqual(a.overlay, run({seed: defaults.seed + 1}).overlay);
});
test('whole-subject echoes grow progressively, and zero growth keeps equal scale', () => {
  const layers = makeLayers({...defaults, copies: 6}); assert.equal(layers.length, 6);
  for (let i = 1; i < layers.length; i++) assert(layers[i].scale > layers[i - 1].scale);
  const flat = makeLayers({...defaults, growth: 0}); assert(flat.every(l => l.scale === defaults.subjectScale / 100));
  const a = random(17), b = random(17); for (let i = 0; i < 100; i++) assert.equal(a(), b());
});
test('mask modes respect alpha and automatic isolation removes only connected background', () => {
  const {data, w, h, mask} = portrait(72, 80);
  const auto = extractMask(data, w, h, 'auto', 30); assert.deepEqual(auto, mask);
  const center = Math.floor(h * .43) * w + Math.floor(w * .5);
  data.set([245, 245, 245, 255], center * 4);
  assert.equal(extractMask(data, w, h, 'auto')[center], 1, 'enclosed pale patch belongs to subject');
  data[center * 4 + 3] = 100;
  for (const mode of ['full', 'alpha', 'auto']) assert(Math.abs(extractMask(data, w, h, mode)[center] - 100 / 255) < 1e-6);
  const oval = extractMask(data, w, h, 'oval'); assert.equal(oval[0], 0); assert(oval[center] > 0);
});
test('smoothing reduces high-frequency texture without changing foreground pixels', () => {
  const raw = prepareEcho(f.data, f.mask, f.w, f.h, 0);
  let before = 0, after = 0;
  for (let y = 45; y < 75; y++) for (let x = 50; x < 75; x++) {
    const p = y * f.w + x;
    before += Math.abs(raw.luminance[p] - raw.luminance[p + 1]);
    after += Math.abs(echo.luminance[p] - echo.luminance[p + 1]);
  }
  assert(after < before * .3);
  assert.deepEqual(run().subject, run({smoothness: 0, definition: 0}, raw).subject);
  assert.notDeepEqual(run().overlay, run({smoothness: 0, definition: 0}, raw).overlay);
});
test('foreground uses the original source pixels and its original subject mask', () => {
  const result = run(), scale = defaults.subjectScale / 100;
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
    const sx = Math.round((x - f.w * .5) / scale + f.w * .5), sy = Math.round((y - f.h) / scale + f.h);
    if (sx < 0 || sy < 0 || sx >= f.w || sy >= f.h) continue;
    const j = (y * f.w + x) * 4, p = sy * f.w + sx;
    assert.deepEqual(result.subject.slice(j, j + 3), f.data.slice(p * 4, p * 4 + 3));
    assert.equal(result.subject[j + 3], Math.round(f.mask[p] * 255));
  }
});
test('zero intensity disables all after-images; transparent exports retain empty space', () => {
  assert(run({energy: 0}).overlay.every((v, i) => i % 4 !== 3 || v === 0));
  const r = run({background: 'transparent'});
  assert(r.output.some((v, i) => i % 4 === 3 && v === 0));
  assert(r.overlay.some((v, i) => i % 4 === 3 && v > 0));
});
test('aligned subject plus after-images reconstruct the finished composition', () => {
  for (const background of ['paper', 'ink', 'transparent']) {
    const r = run({background}), bg = background === 'ink' ? [12, 15, 22] : [246, 245, 242];
    for (let p = 0; p < f.w * f.h; p++) {
      const j = p * 4, sa = r.subject[j + 3] / 255, oa = r.overlay[j + 3] / 255;
      const ba = background === 'transparent' ? sa : 1, alpha = oa + ba * (1 - oa);
      assert(Math.abs(r.output[j + 3] - alpha * 255) < 2);
      for (let k = 0; k < 3; k++) {
        const base = background === 'transparent' ? r.subject[j + k] : r.subject[j + k] * sa + bg[k] * (1 - sa);
        const value = alpha ? (r.overlay[j + k] * oa + base * ba * (1 - oa)) / alpha : 0;
        assert(Math.abs(r.output[j + k] - value) < 2.5, `composition mismatch at ${p}`);
      }
    }
  }
});
test('graphic definition narrows silhouette transitions while preserving the foreground', () => {
  const w = 384, h = 384, data = new Uint8ClampedArray(w * h * 4), mask = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = y * w + x; data.set([90, 90, 90, 255], p * 4);
    mask[p] = x > w * .3 && x < w * .7 && y > h * .1 ? 1 : 0;
  }
  const fields = prepareEcho(data, mask, w, h, 82), fixture = {data, mask, w, h};
  const config = {spread: 0, fracture: 0, copies: 1, growth: 35, subjectScale: 50, lines: 0, energy: 100, protection: 0, background: 'transparent'};
  const soft = run({...config, definition: 0}, fields, fixture), crisp = run({...config, definition: 82}, fields, fixture);
  const width = result => {
    // Sample above the foreground so face protection doesn't add a second alpha plateau.
    const values = Array.from({length: w}, (_, x) => result.overlay[(Math.round(h * .45) * w + x) * 4 + 3]);
    const peak = Math.max(...values); return values.filter(v => v > peak * .1 && v < peak * .9).length;
  };
  assert(width(crisp) < width(soft) * .6);
  assert.deepEqual(crisp.subject, soft.subject);
});
test('empty masks and narrow images render safely across every composition and palette', () => {
  for (const [w, h] of [[1, 1], [1, 40], [40, 1], [17, 31]]) {
    const p = portrait(w, h); p.mask.fill(0);
    const fields = prepareEcho(p.data, p.mask, w, h, 100);
    for (const style of ['prism', 'echo', 'fracture']) for (const palette of Object.keys(palettes)) {
      const r = run({style, palette, background: 'transparent'}, fields, p);
      assert.equal(r.output.length, w * h * 4); assert(r.output.every(v => v === 0));
    }
    assert.deepEqual(focusFromMask(p.mask, w, h), {focusX: .5, focusY: .35});
  }
  const field = new Float32Array(25).fill(.5); assert(blurField(field, 5, 5, 2).every(v => Math.abs(v - .5) < 1e-6));
  assert.deepEqual(blurField(field, 5, 5, 0), field);
});
