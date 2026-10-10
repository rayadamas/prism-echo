import {watch} from 'node:fs';
import {join} from 'node:path';
import {build, projectRoot} from './build.mjs';
import {createStaticServer} from './server.mjs';

const portIndex = process.argv.indexOf('--port');
const port = portIndex >= 0 ? Number(process.argv[portIndex + 1]) : 4173;
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Use --port followed by a port from 1 to 65535.');
const root = await build();
const server = createStaticServer(root);
server.on('error', error => { console.error(error.message); process.exitCode = 1; for (const watcher of watchers) watcher.close(); });
let timer, building = false, pending = false;
async function rebuild() {
  if (building) { pending = true; return; }
  building = true;
  try { await build(); console.log('Rebuilt. Refresh the browser to see changes.'); }
  catch (error) { console.error(error.message); }
  finally { building = false; if (pending) { pending = false; rebuild(); } }
}
const watchers = ['src', 'public'].map(name => watch(join(projectRoot, name), {recursive: true}, () => {
  clearTimeout(timer); timer = setTimeout(rebuild, 100);
}));
server.listen(port, '127.0.0.1', () => console.log(`Prism Echo → http://localhost:${port}\nCtrl+C to stop. No installation needed.`));
function stop() { clearTimeout(timer); for (const watcher of watchers) watcher.close(); server.close(); }
process.on('SIGINT', stop); process.on('SIGTERM', stop);
