import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Test Suite Tiering + Redundancy Reduction V1 — tier-runner lock.
//
// The tier orchestration lives in scripts/test-tiers.mjs (NOT package.json):
// ~48 cloud/data-health/dev-api boundary locks freeze package.json byte-for-
// byte, so the tiers are routed through a standalone runner to avoid tripping
// them. This test verifies the runner exists, defines every tier with the
// right command surface, keeps `test:full` a full vitest run, keeps
// `validate:full` covering every merge-gate step, leaves npm test untouched,
// and smuggles in no pnpm / deploy / merge / test-bypass command.
//
// Reads source only — it does not execute the runner.
// ---------------------------------------------------------------------------

const repoRoot = resolve(process.cwd());
const RUNNER = 'scripts/test-tiers.mjs';

const runnerSrc = (): string => readFileSync(resolve(repoRoot, RUNNER), 'utf8');
const pkg = (): { scripts?: Record<string, string> } =>
  JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf8'));

describe('testSuiteTieringScripts — the tier runner exists', () => {
  it('scripts/test-tiers.mjs exists', () => {
    expect(existsSync(resolve(repoRoot, RUNNER))).toBe(true);
  });
});

describe('testSuiteTieringScripts — every tier is defined in the runner', () => {
  // The runner declares a TIERS map keyed by the tier name. Assert each key
  // is present as a quoted map key.
  for (const tier of ['test:parity', 'test:ios', 'test:fast', 'test:full', 'validate:ios', 'validate:full']) {
    it(`runner defines tier ${tier}`, () => {
      expect(runnerSrc()).toMatch(new RegExp(`['"]${tier.replace(':', ':')}['"]\\s*:`));
    });
  }
});

describe('testSuiteTieringScripts — test:parity uses the generator --check', () => {
  it('runner parity step invokes generate-parity-goldens.mjs --check', () => {
    const s = runnerSrc();
    expect(s).toMatch(/generate-parity-goldens\.mjs/);
    expect(s).toMatch(/--check\b/);
  });
});

describe('testSuiteTieringScripts — test:ios targets the iOS tests', () => {
  it('runner ios step scopes vitest to tests/ios* files', () => {
    const s = runnerSrc();
    expect(s).toMatch(/vitest(\.mjs)?\b/);
    // The runner expands tests/ios*.test.ts via fs and passes explicit paths.
    expect(s).toMatch(/startsWith\(\s*['"]ios['"]\s*\)/);
    expect(s).toMatch(/tests\//);
  });
});

describe('testSuiteTieringScripts — test:full is a full vitest run', () => {
  it('runner test:full maps to a bare vitest run (no path filter)', () => {
    const s = runnerSrc();
    // VITEST_RUN must be the unfiltered `vitest run`.
    expect(s).toMatch(/vitest\.mjs['"]\s*,\s*['"]run['"]/);
    // The `full` step must not append a path filter.
    expect(s).toMatch(/full:\s*\(\)\s*=>\s*step\([^)]*\.\.\.VITEST_RUN\s*\]?\s*\)/);
  });
});

describe('testSuiteTieringScripts — npm test remains the full run, unchanged', () => {
  it('package.json test is still a bare full vitest run', () => {
    const t = pkg().scripts?.test ?? '';
    expect(t).toMatch(/vitest(\.mjs)?\b/);
    expect(t).toMatch(/\brun\b/);
    expect(t).not.toMatch(/run\s+\S+\.test\.ts/);
    expect(t).not.toMatch(/run\s+tests\//);
  });
  it('package.json was NOT given tiering scripts (tiers live in the runner)', () => {
    // This is the whole point of routing through the runner: package.json's
    // script surface stays frozen for the boundary locks.
    const scripts = pkg().scripts ?? {};
    for (const tier of ['test:parity', 'test:ios', 'test:fast', 'test:full', 'validate:ios', 'validate:full']) {
      expect(scripts[tier], `package.json must NOT define ${tier} (boundary locks freeze it)`).toBeUndefined();
    }
  });
});

describe('testSuiteTieringScripts — validate:full keeps every merge-gate check', () => {
  // validate:full composes these step keys.
  const validateFull = (): string => {
    const m = runnerSrc().match(/['"]validate:full['"]\s*:\s*\[([^\]]*)\]/);
    return m ? m[1] : '';
  };

  it('validate:full includes api:dev:build', () => {
    expect(validateFull()).toMatch(/api:dev:build/);
  });
  it('validate:full includes typecheck', () => {
    expect(validateFull()).toMatch(/typecheck/);
  });
  it('validate:full includes the full vitest run (full step)', () => {
    expect(validateFull()).toMatch(/\bfull\b/);
  });
  it('validate:full includes build', () => {
    expect(validateFull()).toMatch(/\bbuild\b/);
  });
  it('validate:full includes the dist-safety scan', () => {
    const s = runnerSrc();
    expect(validateFull()).toMatch(/\bscan\b/);
    expect(s).toMatch(/scan-production-dist-safety\.mjs/);
  });
});

describe('testSuiteTieringScripts — validate:ios is the lighter iOS gate', () => {
  const validateIos = (): string => {
    const m = runnerSrc().match(/['"]validate:ios['"]\s*:\s*\[([^\]]*)\]/);
    return m ? m[1] : '';
  };
  it('validate:ios composes typecheck + parity + ios', () => {
    expect(validateIos()).toMatch(/typecheck/);
    expect(validateIos()).toMatch(/parity/);
    expect(validateIos()).toMatch(/ios/);
  });
  it('validate:ios does NOT run the full suite (that is validate:full)', () => {
    expect(validateIos()).not.toMatch(/\bfull\b/);
  });
});

describe('testSuiteTieringScripts — no forbidden commands in the runner', () => {
  it('runner does not reference pnpm', () => {
    expect(runnerSrc()).not.toMatch(/\bpnpm\b/);
  });
  it('runner runs no deploy command', () => {
    expect(runnerSrc()).not.toMatch(/\b(vercel|netlify|gh-pages|predeploy)\b/);
    // "deploy" appears only in prose/comments would be fine, but assert no
    // shelled deploy invocation form.
    expect(runnerSrc()).not.toMatch(/run['"]\s*,\s*['"][^'"]*deploy/);
  });
  it('runner runs no gh pr merge', () => {
    expect(runnerSrc()).not.toMatch(/gh\s+pr\s+merge/);
    expect(runnerSrc()).not.toMatch(/--admin\b/);
  });
  it('runner bypasses no tests (no passWithNoTests / bail=0)', () => {
    const s = runnerSrc();
    expect(s).not.toMatch(/--passWithNoTests/);
    expect(s).not.toMatch(/--bail\s*=?\s*0/);
  });
  it('runner fails fast on any non-zero step (no swallowing)', () => {
    // The loop must exit non-zero when a step fails.
    expect(runnerSrc()).toMatch(/status\s*!==\s*0/);
    expect(runnerSrc()).toMatch(/process\.exit\(/);
  });
});
