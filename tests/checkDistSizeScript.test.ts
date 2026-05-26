import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const scriptPath = join(process.cwd(), 'scripts', 'check-dist-size.mjs');

const setupDist = async (files: Array<{ name: string; bytes: number }>, htmlScripts: string[]) => {
  const baseDir = await mkdtemp(join(tmpdir(), 'ironpath-dist-size-'));
  const distDir = join(baseDir, 'dist');
  const assetsDir = join(distDir, 'assets');
  await mkdir(assetsDir, { recursive: true });

  const scriptTags = htmlScripts.map((name) => `<script type="module" crossorigin src="/assets/${name}"></script>`).join('\n');
  await writeFile(
    join(distDir, 'index.html'),
    `<!doctype html><html><head>${scriptTags}</head><body></body></html>`,
  );

  for (const file of files) {
    await writeFile(join(assetsDir, file.name), Buffer.alloc(file.bytes, 'a'));
  }

  return baseDir;
};

const runScript = (cwd: string, env: NodeJS.ProcessEnv = {}) =>
  spawnSync(process.execPath, [scriptPath], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });

describe('check-dist-size.mjs', () => {
  it('passes when entry chunk is under entry threshold and lazy chunks are under lazy threshold', async () => {
    const cwd = await setupDist(
      [
        { name: 'entry.js', bytes: 400 * 1024 },
        { name: 'lazy.js', bytes: 700 * 1024 },
      ],
      ['entry.js'],
    );

    const result = runScript(cwd);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('JS chunk size check passed');
  });

  it('fails when entry chunk exceeds entry threshold', async () => {
    const cwd = await setupDist(
      [
        { name: 'entry.js', bytes: 600 * 1024 },
      ],
      ['entry.js'],
    );

    const result = runScript(cwd);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('entry over');
    expect(result.stderr).toContain('entry.js');
  });

  it('fails when lazy chunk exceeds lazy threshold', async () => {
    const cwd = await setupDist(
      [
        { name: 'entry.js', bytes: 100 * 1024 },
        { name: 'huge-lazy.js', bytes: 900 * 1024 },
      ],
      ['entry.js'],
    );

    const result = runScript(cwd);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('lazy over');
    expect(result.stderr).toContain('huge-lazy.js');
  });

  it('treats chunks only referenced via modulepreload as lazy, not entry', async () => {
    const cwd = await setupDist(
      [
        { name: 'entry.js', bytes: 100 * 1024 },
        { name: 'preloaded.js', bytes: 600 * 1024 },
      ],
      ['entry.js'],
    );
    // Hand-write extra modulepreload to confirm it does NOT trip entry check
    await writeFile(
      join(cwd, 'dist', 'index.html'),
      '<!doctype html><html><head><script type="module" src="/assets/entry.js"></script><link rel="modulepreload" href="/assets/preloaded.js"></head></html>',
    );

    const result = runScript(cwd);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('JS chunk size check passed');
  });

  it('honors MAX_ENTRY_JS_KB and MAX_LAZY_JS_KB environment overrides', async () => {
    const cwd = await setupDist(
      [
        { name: 'entry.js', bytes: 200 * 1024 },
        { name: 'lazy.js', bytes: 300 * 1024 },
      ],
      ['entry.js'],
    );

    const result = runScript(cwd, { MAX_ENTRY_JS_KB: '100', MAX_LAZY_JS_KB: '100' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('entry over');
    expect(result.stderr).toContain('lazy over');
  });
});
