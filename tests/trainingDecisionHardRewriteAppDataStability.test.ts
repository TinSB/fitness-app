// trainingDecisionEngine purity + AppData stability.
// See docs/IRONPATH_iOS_SYSTEM_LOGIC.md.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');

const FORBIDDEN_PURITY_IMPORTS = [
  /from\s+['"][^'"]*\/cloudSync\//,
  /from\s+['"][^'"]*\/cloudProduction\//,
  /from\s+['"][^'"]*\/productionApi\//,
  /from\s+['"][^'"]*\/storage\//,
  /\blocalStorage\b/,
  /\bIndexedDB\b/,
  /\bnavigator\.sendBeacon\b/,
];

describe('trainingDecisionHardRewriteAppDataStability', () => {
  it('trainingDecisionEngine is pure: no storage / cloud / runtime side-effects', () => {
    const engineSrc = readFileSync(
      path.join(ROOT, 'src/engines/trainingDecisionEngine.ts'),
      'utf-8',
    );
    for (const pattern of FORBIDDEN_PURITY_IMPORTS) {
      expect(engineSrc, `engine should not match ${pattern}`).not.toMatch(pattern);
    }
  });

  it('trainingDecisionTypes is pure: no storage / cloud imports', () => {
    const typesSrc = readFileSync(
      path.join(ROOT, 'src/engines/trainingDecisionTypes.ts'),
      'utf-8',
    );
    for (const pattern of FORBIDDEN_PURITY_IMPORTS) {
      expect(typesSrc, `types should not match ${pattern}`).not.toMatch(pattern);
    }
  });

  it('AppData interface still imports from training-model only', () => {
    const modelSrc = readFileSync(path.join(ROOT, 'src/models/training-model.ts'), 'utf-8');
    expect(modelSrc).toMatch(/export\s+interface\s+AppData/);
    // Snapshot-level invariant: AppData still includes the well-known top-level fields.
    // If any of these get renamed or removed the test fails — it's an early-warning
    // tripwire for an accidental schema break, not a structural snapshot.
    expect(modelSrc).toMatch(/schemaVersion/);
    expect(modelSrc).toMatch(/trainingMode/);
    expect(modelSrc).toMatch(/programTemplate/);
    expect(modelSrc).toMatch(/mesocyclePlan/);
    expect(modelSrc).toMatch(/history/);
  });
});
