#!/usr/bin/env node
/*
 * iOS-0 Contract Fixture Export V1 — parity-goldens generator.
 *
 * Single entrypoint for refreshing / checking the parity goldens under
 * tests/fixtures/parity/golden/. See
 * docs/ios-native-migration/IOS_0_CONTRACT_FIXTURE_EXPORT_V1.md for the
 * full contract.
 *
 * Modes:
 *   node scripts/generate-parity-goldens.mjs            # write/refresh goldens
 *   node scripts/generate-parity-goldens.mjs --check    # drift detector (exit 1 on diff)
 *   node scripts/generate-parity-goldens.mjs --list     # enumerate fixture ids
 *
 * How it works (no new npm dependency):
 *
 *   1. The TypeScript implementation lives in scripts/parityGoldensEntry.ts.
 *      It imports from src/ (engines, dataHealth, models) and must run
 *      under Node.
 *   2. This .mjs wrapper bundles parityGoldensEntry.ts via
 *      `vite build --ssr` into .ironpath/parity-goldens-runner/ (the
 *      same precedent as `package.json:scripts.api:dev:build` for the
 *      dev API runner).
 *   3. It then spawns node on the bundled artefact and forwards all
 *      CLI flags + process exit code.
 *
 * Hard rules — match the design doc verbatim:
 *   - No new npm package dependency. No package.json script change.
 *   - No localStorage / browser API / network access.
 *   - No Date.now() / Math.random() inside the engine path (the bundled
 *     entry uses parityMeta.deterministicClockIso as the only clock).
 *   - The script's own stdout is a deterministic compact summary; the
 *     bundle artefact and node_modules/.vite cache live under
 *     .ironpath/ (gitignored).
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const ENTRY_TS = resolve(REPO_ROOT, 'scripts/parityGoldensEntry.ts');
const BUNDLE_DIR = resolve(REPO_ROOT, '.ironpath/parity-goldens-runner');
const BUNDLE_OUT = resolve(BUNDLE_DIR, 'parityGoldensEntry.js');
const VITE_BIN = resolve(REPO_ROOT, 'node_modules/vite/bin/vite.js');

if (!existsSync(ENTRY_TS)) {
  process.stderr.write(
    `generate-parity-goldens: missing entry script ${ENTRY_TS}\n`,
  );
  process.exit(1);
}
if (!existsSync(VITE_BIN)) {
  process.stderr.write(
    `generate-parity-goldens: missing vite binary ${VITE_BIN}. ` +
      `Run \`npm install\` first.\n`,
  );
  process.exit(1);
}

const argv = process.argv.slice(2);
const mode = argv.includes('--list')
  ? 'list'
  : argv.includes('--check')
    ? 'check'
    : 'write';

// Always rebuild the bundle. The vite SSR build is cheap (~50–100 ms
// once node_modules is warm) and rebuilding guarantees we never run a
// stale bundle against fresh src/ edits. This is the same safety the
// devApi runner enforces (see package.json:scripts.api:dev).
mkdirSync(BUNDLE_DIR, { recursive: true });

const buildResult = spawnSync(
  process.execPath,
  [
    VITE_BIN,
    'build',
    '--ssr',
    'scripts/parityGoldensEntry.ts',
    '--outDir',
    '.ironpath/parity-goldens-runner',
    '--emptyOutDir',
    '--logLevel',
    'error',
  ],
  {
    cwd: REPO_ROOT,
    stdio: ['inherit', 'inherit', 'inherit'],
  },
);

if (buildResult.status !== 0) {
  process.stderr.write(
    `generate-parity-goldens: vite SSR build failed (exit ${buildResult.status})\n`,
  );
  process.exit(buildResult.status ?? 1);
}

if (!existsSync(BUNDLE_OUT)) {
  process.stderr.write(
    `generate-parity-goldens: bundle missing at ${BUNDLE_OUT} after vite build\n`,
  );
  process.exit(1);
}

const runResult = spawnSync(process.execPath, [BUNDLE_OUT, ...argv], {
  cwd: REPO_ROOT,
  stdio: ['inherit', 'inherit', 'inherit'],
});

process.exit(runResult.status ?? 1);
