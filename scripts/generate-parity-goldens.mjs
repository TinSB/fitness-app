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
 *      `vite build --ssr` into a per-invocation
 *      .ironpath/parity-goldens-runner-<pid>/ dir (the same precedent as
 *      `package.json:scripts.api:dev:build` for the dev API runner). The
 *      per-pid suffix stops concurrent Vitest spawns from wiping each
 *      other's in-flight bundle via `--emptyOutDir`; the dir is removed
 *      on exit.
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
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const ENTRY_TS = resolve(REPO_ROOT, 'scripts/parityGoldensEntry.ts');
// Per-invocation bundle dir. Several Vitest files spawn this generator
// concurrently (vite.config.ts test.maxWorkers: '50%'); with a FIXED outDir,
// one process's `--emptyOutDir` wipes another's in-flight bundle, producing
// intermittent --check/--list failures. The `-<pid>` suffix gives each
// invocation its own dir so they can't collide. It MUST stay exactly two
// levels under the repo root (.ironpath/<dir>/parityGoldensEntry.js): the
// bundled entry derives REPO_ROOT via `import.meta.url` + '..','..' (see
// scripts/parityGoldensEntry.ts), so the depth — not the name — is the
// contract. The dir is an internal build artefact under gitignored .ironpath/
// and is NOT part of the determinism contract: stdout summary and golden
// content are unchanged.
const BUNDLE_SUBDIR = `.ironpath/parity-goldens-runner-${process.pid}`;
const BUNDLE_DIR = resolve(REPO_ROOT, BUNDLE_SUBDIR);
const BUNDLE_OUT = resolve(BUNDLE_DIR, 'parityGoldensEntry.js');
const VITE_BIN = resolve(REPO_ROOT, 'node_modules/vite/bin/vite.js');

// Remove this invocation's private bundle dir on every exit path so repeated
// runs don't accumulate dirs under .ironpath/. Best-effort: a cleanup failure
// must never change the forwarded exit code, and force:true no-ops if the dir
// was never created (e.g. an early exit before the build).
process.on('exit', () => {
  try {
    rmSync(BUNDLE_DIR, { recursive: true, force: true });
  } catch {
    // ignore — .ironpath/ is gitignored; a leftover dir is harmless.
  }
});

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
    BUNDLE_SUBDIR,
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
