import {cp, mkdir, rm, writeFile} from 'node:fs/promises';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {resolve, join} from 'node:path';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));
export async function build(output = join(projectRoot, 'dist')) {
  await mkdir(output, {recursive: true});
  // Only generated output is replaced. The source and assets stay editable.
  for (const name of ['index.html', 'style.css', 'app.mjs', 'engine.mjs', 'recipe.mjs', 'renderer.mjs', 'render-worker.mjs', 'assets', 'demo.json', 'favicon.svg']) {
    await rm(join(output, name), {recursive: true, force: true});
  }
  await cp(join(projectRoot, 'public'), output, {recursive: true});
  await cp(join(projectRoot, 'src'), output, {recursive: true});
  await writeFile(join(output, '.nojekyll'), '');
  return output;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await build(); console.log('Built Prism Echo → dist/');
}
