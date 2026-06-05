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
    // 5 iOS-0 fixtures + 9 iOS-4B0 TrainingDecision + 3 iOS-17e-0 progression + 4 SR-0 smart-replacement + 1 SR-1 exercise-library + 5 SR-2 replacement-engine + 5 iOS-17e-1 e1rm-engine + 4 iOS-17e-2 adaptive-feedback + 6 iOS-17e-3 progression-suggestion + 4 iOS-17e-4 set-weight-fine-tune + 3 iOS-17e-4 load-feedback + 2 iOS-17e-6a fine-tune-live progression-suggestion + 3 AN-1 leaf-analytics + 3 AN-1b boundary + 2 AN-2 plateau-detection parity fixtures = 59.
    // + AN-3/4/5/5b/6 + PA-S0/S2/S3/S4 fixtures (to 78) + 3 PA-S5 coach-action-identity = 81
    // + 4 PA-S6 plan-adjustment-identity parity fixtures = 85.
    expect(result.stdout).toMatch(/checked\s+114\s+fixture/);
    expect(result.stdout).toMatch(/0\s+changed/);
  }, 180_000);
});
