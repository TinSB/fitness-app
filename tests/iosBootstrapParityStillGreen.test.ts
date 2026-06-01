import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// iOS-1 Xcode Project Bootstrap V1 — iOS-0 parity is still green.
//
// iOS-1 adds an iOS scaffold; it must not touch the TypeScript parity
// surface. This test spawns the iOS-0 generator in --check mode and asserts
// "0 changed". Any drift means iOS-1 accidentally modified src/ or a fixture
// and is on the wrong PR.
// ---------------------------------------------------------------------------

const repoRoot = resolve(process.cwd());

describe('iosBootstrapParityStillGreen', () => {
  it('iosBootstrap parity goldens are unchanged by iOS-1 (--check returns 0)', () => {
    const result = spawnSync(
      process.execPath,
      [resolve(repoRoot, 'scripts/generate-parity-goldens.mjs'), '--check'],
      {
        cwd: repoRoot,
        stdio: ['ignore', 'pipe', 'pipe'],
        encoding: 'utf8',
      },
    );
    expect(result.status, `stderr: ${result.stderr}\nstdout: ${result.stdout}`).toBe(0);
    // 5 iOS-0 fixtures + 9 iOS-4B0 TrainingDecision + 4 SR-0 smart-replacement parity fixtures = 18.
    expect(result.stdout).toMatch(/checked\s+18\s+fixture/);
    expect(result.stdout).toMatch(/0\s+changed/);
  }, 180_000);
});
