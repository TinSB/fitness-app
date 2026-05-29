#!/usr/bin/env node
// ---------------------------------------------------------------------------
// scripts/test-tiers.mjs — Test Suite Tiering + Redundancy Reduction V1.
//
// Tiered-validation runner. Lives OUTSIDE package.json on purpose: ~48
// cloud/data-health/dev-api boundary locks freeze package.json byte-for-byte
// (they assert a boundary PR changes no schemas/routes/packages/lockfiles), so
// adding npm scripts to package.json would trip every one of them. Routing the
// tier orchestration through this standalone runner adds the tier commands
// without touching that frozen surface and without weakening any boundary lock.
//
// Usage:
//   node scripts/test-tiers.mjs <tier>
// Tiers:
//   test:parity    parity goldens --check
//   test:ios       vitest run, scoped to tests/ios*.test.ts
//   test:fast      Tier 0 — parity + ios (fast local / Xcode iteration)
//   test:full      full vitest run (identical surface to `npm test`)
//   validate:ios   Tier 1 — typecheck + parity + ios (before an iOS PR)
//   validate:full  Tier 2 — api:dev:build + typecheck + full + build + dist scan
//
// This runner only SEQUENCES existing validation commands. It runs nothing a
// developer could not run by hand, changes no runtime behavior, adds no
// dependency, and never deploys or merges. Any step's non-zero exit aborts the
// run with that exit code (fail-fast, no bypass).
// ---------------------------------------------------------------------------

import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const NODE = process.execPath;

// The full vitest run — identical to package.json's `test` script. No path
// filter, so `test:full` covers exactly what `npm test` covers.
const VITEST_RUN = ['./node_modules/vitest/vitest.mjs', 'run'];

// Flat tests/ios*.test.ts set (no tests/ios/ subdir exists in this repo).
const iosTestFiles = () =>
  readdirSync(resolve(repoRoot, 'tests'))
    .filter((f) => f.startsWith('ios') && f.endsWith('.test.ts'))
    .sort()
    .map((f) => `tests/${f}`);

const step = (label, bin, args) => ({ label, bin, args });

// Atomic steps. The npm-script ones (typecheck / api:dev:build / build) reuse
// the existing, unchanged package.json scripts so behavior is byte-identical.
const STEP = {
  parity: () => step('test:parity', NODE, ['scripts/generate-parity-goldens.mjs', '--check']),
  ios: () => step('test:ios', NODE, [...VITEST_RUN, ...iosTestFiles()]),
  full: () => step('test:full', NODE, [...VITEST_RUN]),
  typecheck: () => step('typecheck', 'npm', ['run', 'typecheck']),
  'api:dev:build': () => step('api:dev:build', 'npm', ['run', 'api:dev:build']),
  build: () => step('build', 'npm', ['run', 'build']),
  scan: () => step('dist-safety-scan', NODE, ['scripts/scan-production-dist-safety.mjs']),
};

// Tier → ordered list of atomic step keys.
const TIERS = {
  'test:parity': ['parity'],
  'test:ios': ['ios'],
  'test:fast': ['parity', 'ios'],
  'test:full': ['full'],
  'validate:ios': ['typecheck', 'parity', 'ios'],
  'validate:full': ['api:dev:build', 'typecheck', 'full', 'build', 'scan'],
};

const tier = process.argv[2];

if (!tier || !TIERS[tier]) {
  process.stderr.write(
    `test-tiers: unknown tier ${tier ? `"${tier}"` : '(none)'}\n` +
      `available: ${Object.keys(TIERS).join(', ')}\n`,
  );
  process.exit(2);
}

process.stdout.write(`test-tiers: running ${tier} -> [${TIERS[tier].join(', ')}]\n`);

for (const key of TIERS[tier]) {
  const { label, bin, args } = STEP[key]();
  process.stdout.write(`\n=== ${tier} :: ${label} ===\n`);
  const result = spawnSync(bin, args, { cwd: repoRoot, stdio: 'inherit' });
  if (result.status !== 0) {
    process.stderr.write(`test-tiers: step "${label}" failed (exit ${result.status ?? 'signal'})\n`);
    process.exit(result.status ?? 1);
  }
}

process.stdout.write(`\ntest-tiers: ${tier} passed\n`);
