import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const distDir = join(process.cwd(), 'dist');
const assetsDir = join(distDir, 'assets');

const maxEntryBytes = Number(process.env.MAX_ENTRY_JS_KB ?? 500) * 1024;
const maxLazyBytes = Number(process.env.MAX_LAZY_JS_KB ?? 750) * 1024;

const formatKb = (bytes) => `${(bytes / 1024).toFixed(1)} kB`;

const htmlFiles = ['index.html', 'prototype.html']
  .map((name) => join(distDir, name));

const readIfExists = async (path) => {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return '';
  }
};

const htmlSources = await Promise.all(htmlFiles.map(readIfExists));
const scriptSrcPattern = /<script\b[^>]*\bsrc=["']\/?assets\/([^"']+)["']/gi;
const entryScripts = new Set();
for (const html of htmlSources) {
  for (const match of html.matchAll(scriptSrcPattern)) {
    entryScripts.add(match[1]);
  }
}

const entries = await readdir(assetsDir).catch(() => []);
const rows = [];

for (const name of entries) {
  if (!name.endsWith('.js')) continue;
  const path = join(assetsDir, name);
  const info = await stat(path);
  const isEntry = entryScripts.has(name);
  rows.push({ name, bytes: info.size, isEntry });
}

const overEntry = rows.filter((row) => row.isEntry && row.bytes > maxEntryBytes);
const overLazy = rows.filter((row) => !row.isEntry && row.bytes > maxLazyBytes);

if (!overEntry.length && !overLazy.length) {
  console.log(`JS chunk size check passed. Entry threshold: ${formatKb(maxEntryBytes)}; lazy threshold: ${formatKb(maxLazyBytes)}.`);
  process.exit(0);
}

console.error(`JS chunk size check failed.`);
console.error(`  entry threshold: ${formatKb(maxEntryBytes)}, lazy threshold: ${formatKb(maxLazyBytes)}`);
for (const row of overEntry) {
  console.error(`  [entry over]  ${formatKb(row.bytes).padStart(10)}  ${row.name}`);
}
for (const row of overLazy) {
  console.error(`  [lazy over]   ${formatKb(row.bytes).padStart(10)}  ${row.name}`);
}

process.exit(1);
