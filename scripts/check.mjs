import {readdir, readFile, access} from 'node:fs/promises';
import {join, dirname} from 'node:path';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {projectRoot} from './build.mjs';

for (const folder of ['src', 'scripts', 'tests']) for (const name of await readdir(join(projectRoot, folder))) {
  if (!name.endsWith('.mjs')) continue;
  const path = join(projectRoot, folder, name), result = spawnSync(process.execPath, ['--check', path], {encoding: 'utf8'});
  if (result.status !== 0) throw new Error(result.stderr);
  const text = await readFile(path, 'utf8');
  for (const match of text.matchAll(/(?:from\s+|import\s*)['"](\.\.?\/[^'"]+)['"]/g)) {
    await access(join(dirname(path), match[1].split('?')[0]));
  }
}
const html = await readFile(join(projectRoot, 'public/index.html'), 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
assert.equal(ids.length, new Set(ids).size, 'Duplicate HTML id');
const app = await readFile(join(projectRoot, 'src/app.mjs'), 'utf8');
for (const match of app.matchAll(/\$\('([^']+)'\)/g)) assert(ids.includes(match[1]), `Missing UI element: ${match[1]}`);
for (const key of ['copies', 'growth', 'subjectScale', 'spread', 'energy', 'lines', 'smoothness', 'definition', 'fracture', 'protection', 'focusSize', 'tolerance']) {
  assert(ids.includes(key) && ids.includes(key + 'Value'), `Missing control for ${key}`);
}
const demo = JSON.parse(await readFile(join(projectRoot, 'public/demo.json'), 'utf8'));
assert(/^\.\/assets\/[a-zA-Z0-9._-]+$/.test(demo.image), 'Use a bundled asset for the demo');
await access(join(projectRoot, 'public', demo.image));
assert(!/https?:\/\//.test(html), 'Runtime HTML must use bundled assets');
console.log('Syntax, module imports, UI controls, and bundled demo checked.');
