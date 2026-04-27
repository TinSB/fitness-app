import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const assetsDir = join(process.cwd(), 'dist', 'assets');
const maxChunkBytes = Number(process.env.MAX_JS_CHUNK_KB ?? 500) * 1024;

const formatKb = (bytes) => `${(bytes / 1024).toFixed(1)} kB`;

const entries = await readdir(assetsDir).catch(() => []);
const rows = [];

for (const name of entries) {
  const path = join(assetsDir, name);
  const info = await stat(path);
  rows.push({ name, bytes: info.size });
}

const largeJs = rows
  .filter((row) => row.name.endsWith('.js') && row.bytes > maxChunkBytes)
  .sort((left, right) => right.bytes - left.bytes);

if (!largeJs.length) {
  console.log(`JS chunk size check passed. Threshold: ${formatKb(maxChunkBytes)}.`);
  process.exit(0);
}

console.error(`JS chunk size check failed. Threshold: ${formatKb(maxChunkBytes)}.`);
for (const row of largeJs) {
  console.error(`${formatKb(row.bytes).padStart(10)}  ${row.name}`);
}

process.exit(1);
