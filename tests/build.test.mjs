import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm, readFile, readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {build} from '../scripts/build.mjs';
import {resolvePublicPath} from '../scripts/server.mjs';

test('build bundles relative assets and worker modules for subdirectory hosting', async () => {
  const out = await mkdtemp(join(tmpdir(), 'prism-echo-test-'));
  try {
    await build(out); const names = await readdir(out);
    for (const name of ['index.html', 'app.mjs', 'engine.mjs', 'recipe.mjs', 'renderer.mjs', 'render-worker.mjs', 'style.css', 'demo.json', '.nojekyll']) assert(names.includes(name));
    assert(!names.includes('.git') && !names.includes('.openai') && !names.includes('tests'));
    const html = await readFile(join(out, 'index.html'), 'utf8');
    assert(!/\b(?:src|href)="\//.test(html), 'root paths break GitHub project Pages');
    const {image} = JSON.parse(await readFile(join(out, 'demo.json'), 'utf8'));
    assert((await readFile(join(out, image))).length > 0);
  } finally { await rm(out, {recursive: true, force: true}); }
});
test('local server confines requests to public output, including encoded traversal', () => {
  const root = join(tmpdir(), 'prism-echo-public');
  assert.equal(resolvePublicPath(root, '/'), join(root, 'index.html'));
  assert.equal(resolvePublicPath(root, '/assets/portrait.jpg'), join(root, 'assets/portrait.jpg'));
  for (const url of ['/../package.json', '/%2e%2e/package.json', '/.git/config', '/%00', '/%zz', '/assets%5c..%5csecret']) {
    assert.equal(resolvePublicPath(root, url), null);
  }
});
