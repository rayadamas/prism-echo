import {readdir, readFile, mkdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {deflateRawSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {build, projectRoot} from './build.mjs';

// A portable ZIP writer avoids installing an archiver or shipping environment metadata.
const crcTable = Uint32Array.from({length: 256}, (_, n) => {
  for (let k = 0; k < 8; k++) n = (n & 1) ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
const version = JSON.parse(await readFile(join(projectRoot, 'package.json'), 'utf8')).version;
await build();
const files = [];
async function collect(relative) {
  const entries = await readdir(join(projectRoot, relative), {withFileTypes: true});
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const path = relative + '/' + entry.name;
    if (entry.isDirectory()) await collect(path);
    else if (entry.isFile()) files.push(path);
    else throw new Error(`Release cannot include symlinks: ${path}`);
  }
}
for (const folder of ['src', 'public', 'scripts', 'tests', 'docs', '.github', 'dist']) await collect(folder);
files.push('README.md', 'LICENSE', 'CONTRIBUTING.md', 'CHANGELOG.md', 'package.json', '.gitignore', '.gitattributes', '.nvmrc');
const local = [], central = []; let offset = 0;
for (const path of files.sort()) {
  const data = await readFile(join(projectRoot, path)), packed = deflateRawSync(data), crc = crc32(data);
  const name = Buffer.from(`prism-echo/${path}`), header = Buffer.alloc(30), directory = Buffer.alloc(46);
  header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4); header.writeUInt16LE(0x800, 6); header.writeUInt16LE(8, 8);
  header.writeUInt16LE(0x5c21, 12); header.writeUInt32LE(crc, 14); header.writeUInt32LE(packed.length, 18); header.writeUInt32LE(data.length, 22); header.writeUInt16LE(name.length, 26);
  directory.writeUInt32LE(0x02014b50); directory.writeUInt16LE(20, 4); directory.writeUInt16LE(20, 6); directory.writeUInt16LE(0x800, 8); directory.writeUInt16LE(8, 10);
  directory.writeUInt16LE(0x5c21, 14); directory.writeUInt32LE(crc, 16); directory.writeUInt32LE(packed.length, 20); directory.writeUInt32LE(data.length, 24); directory.writeUInt16LE(name.length, 28); directory.writeUInt32LE(offset, 42);
  local.push(header, name, packed); central.push(directory, name); offset += header.length + name.length + packed.length;
}
const directory = Buffer.concat(central), end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
const zip = Buffer.concat([...local, directory, end]);
const output = join(projectRoot, 'releases'), filename = `prism-echo-v${version}.zip`;
await mkdir(output, {recursive: true}); await writeFile(join(output, filename), zip);
const digest = createHash('sha256').update(zip).digest('hex');
await writeFile(join(output, `${filename}.sha256`), `${digest}  ${filename}\n`);
console.log(`Release → releases/${filename} (${files.length} files, ${(zip.length / 1024 / 1024).toFixed(2)} MB)`);
