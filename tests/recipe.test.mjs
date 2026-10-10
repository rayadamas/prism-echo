import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults} from '../src/engine.mjs';
import {parseRecipe, safeConfig, scaleMask} from '../src/recipe.mjs';

test('current recipes retain all approved controls and export size', () => {
  const r = parseRecipe(JSON.stringify({format: 'prism-echo', version: 3, config: defaults, exportSize: 3072}));
  assert.deepEqual(r.config, defaults); assert.equal(r.exportSize, 3072);
});
test('legacy recipes load with the soft renderer and sensible missing-control defaults', () => {
  for (const version of [1, 2]) {
    const r = parseRecipe(JSON.stringify({format: 'prism-echo', version, config: {seed: 42}}));
    assert.equal(r.config.definition, 0); assert.equal(r.config.seed, 42); assert.equal(r.config.smoothness, 82);
  }
});
test('imported recipes clamp numeric controls and ignore unknown values and properties', () => {
  const input = JSON.parse('{"copies":5.6,"growth":999,"subjectScale":0,"focusX":-1,"seed":-1,"palette":"unknown","style":"unknown","__proto__":{"polluted":true}}');
  const c = safeConfig(input); assert.equal(c.copies, 6); assert.equal(c.growth, 35); assert.equal(c.subjectScale, 40);
  assert.equal(c.focusX, 0); assert.equal(c.seed, 4294967295); assert.equal(c.palette, defaults.palette);
  assert.equal(c.polluted, undefined); assert.equal({}.polluted, undefined);
  assert.equal(safeConfig({energy: NaN}).energy, defaults.energy);
});
test('recipes reject foreign formats, unsupported versions, malformed masks, and remote mask URLs', () => {
  for (const r of [null, {}, {format: 'other', version: 3, config: {}}, {format: 'prism-echo', version: 4, config: {}},
    {format: 'prism-echo', version: 3, config: []},
    {format: 'prism-echo', version: 3, config: {}, mask: {width: 999999, height: 1, png: 'data:image/png;base64,AAAA'}},
    {format: 'prism-echo', version: 3, config: {}, mask: {width: 1, height: 1, png: 'https://example.com/mask.png'}}]) {
    assert.throws(() => parseRecipe(JSON.stringify(r)));
  }
  assert.throws(() => parseRecipe('not JSON'));
});
test('saved mask samples scale consistently to aligned export layers', () => {
  const scaled = scaleMask(new Float32Array([0, 1, .5, 0]), 2, 2, 4, 4);
  assert.deepEqual(Array.from(scaled), [0, 0, 1, 1, 0, 0, 1, 1, .5, .5, 0, 0, .5, .5, 0, 0]);
});
