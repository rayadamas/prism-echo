import {createServer} from 'node:http';
import {readFile, realpath, stat} from 'node:fs/promises';
import {resolve, sep, extname} from 'node:path';

export function resolvePublicPath(root, pathname) {
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { return null; }
  if (decoded.includes('\0') || decoded.includes('\\') || decoded.split('/').some(segment => segment.startsWith('.'))) return null;
  const path = resolve(root, '.' + (decoded === '/' ? '/index.html' : decoded));
  return path.startsWith(resolve(root) + sep) ? path : null;
}

const types = {'.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif'};

export function createStaticServer(root) {
  return createServer(async (req, res) => {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, {Allow: 'GET, HEAD'}); res.end(); return; }
    const path = resolvePublicPath(root, (req.url || '/').split('?')[0]);
    try {
      if (!path) throw new Error('Invalid path');
      const actual = await realpath(path);
      if (!actual.startsWith(await realpath(root) + sep) || !(await stat(actual)).isFile()) throw new Error('Invalid file');
      const body = await readFile(actual);
      res.writeHead(200, {'Content-Type': types[extname(actual)] || 'application/octet-stream',
        'Content-Length': body.length, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'});
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch { res.writeHead(404, {'Content-Type': 'text/plain'}); res.end('Not found'); }
  });
}
