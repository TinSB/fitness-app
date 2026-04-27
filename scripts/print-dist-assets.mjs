import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const assetsDir = join(process.cwd(), 'dist', 'assets');

const formatKb = (bytes) => `${(bytes / 1024).toFixed(1)} kB`;

const entries = await readdir(assetsDir).catch(() => []);
const rows = [];

for (const name of entries) {
  const path = join(assetsDir, name);
  const info = await stat(path);
  rows.push({ name, bytes: info.size });
}

rows.sort((left, right) => right.bytes - left.bytes);

for (const row of rows) {
  console.log(`${formatKb(row.bytes).padStart(10)}  ${row.name}`);
}
