import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// iOS-0 Contract Fixture Export V1 — generator consistency test.
//
// Runs scripts/generate-parity-goldens.mjs --check in a child process and
// asserts exit code 0. If any golden under tests/fixtures/parity/golden/
// would change relative to the on-disk version, the generator exits 1 with
// the offending fixture id printed. That's the drift detector.
//
// Two consecutive --check runs (idempotency) are implicit: --check itself
// never writes, and on a clean checkout the on-disk goldens are the
// reference. If the generator were non-deterministic, the first --check
// after a regenerate would already fail.
// ---------------------------------------------------------------------------

const repoRoot = resolve(process.cwd());

const runGenerator = (args: string[]) => {
  return spawnSync(
    process.execPath,
    [resolve(repoRoot, 'scripts/generate-parity-goldens.mjs'), ...args],
    {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
    },
  );
};

describe('parityFixturesGenerationConsistency', () => {
  it('parityFixturesGenerationConsistency --list emits the 5 V1 fixture ids', () => {
    const result = runGenerator(['--list']);
    expect(result.status, result.stderr).toBe(0);
    const lines = result.stdout
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    // The .mjs wrapper invokes vite + node; we accept any leading build
    // output and check that every required id appears.
    for (const required of [
      'app-data/snapshot-hash-stable-v1',
      'training-decision/normal-session-v1',
      'data-repair/session-lifecycle-residue-v1',
      'real-export/redacted-2026-05-27',
      'focus-mode/golden-path-session-v1',
    ]) {
      expect(lines).toContain(required);
    }
  }, 120_000);

  it('parityFixturesGenerationConsistency --check passes without drift', () => {
    const result = runGenerator(['--check']);
    expect(result.status, `stderr: ${result.stderr}\nstdout: ${result.stdout}`).toBe(0);
    // Summary line: "checked 32 fixture(s); 0 changed" (5 iOS-0 + 9 iOS-4B0
    // TrainingDecision + 3 iOS-17e-0 progression + 4 SR-0 smart-replacement +
    // 1 SR-1 exercise-library + 5 SR-2 replacement-engine +
    // 5 iOS-17e-1 e1rm-engine parity fixtures).
    expect(result.stdout).toMatch(/checked\s+32\s+fixture/);
    expect(result.stdout).toMatch(/0\s+changed/);
  }, 120_000);
});
