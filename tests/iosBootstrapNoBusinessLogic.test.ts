import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// iOS-1 Xcode Project Bootstrap V1 — no business logic yet.
//
// Locks the principle that iOS-1 ships an inert skeleton. The Swift port
// of every contract surface lives in iOS-2..iOS-10. If a future PR claims
// to be iOS-1 and tries to land an AppData struct, a TrainingDecision
// engine, or a cloud client, this test fails.
// ---------------------------------------------------------------------------

const repoRoot = resolve(process.cwd());

const collectSwiftFiles = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '.build' || entry.name === 'DerivedData') continue;
      collectSwiftFiles(full, out);
    } else if (entry.name.endsWith('.swift')) {
      out.push(full);
    }
  }
  return out;
};

interface ForbiddenSymbol {
  readonly name: string;
  readonly owner: string;
  readonly pattern: RegExp;
}

const BUSINESS_LOGIC: readonly ForbiddenSymbol[] = [
  // AppData model — owned by iOS-2.
  { name: 'AppData_struct_or_class', owner: 'iOS-2', pattern: /\b(struct|final\s+class|class)\s+AppData\b/ },
  // TrainingDecision engine — owned by iOS-4.
  { name: 'TrainingDecision_type', owner: 'iOS-4', pattern: /\b(struct|class|enum)\s+TrainingDecision\b(?!Version)/ },
  { name: 'buildTrainingDecision_func', owner: 'iOS-4', pattern: /\bfunc\s+buildTrainingDecision\b/ },
  // CleanAppDataView — owned by iOS-3.
  { name: 'CleanAppDataView_type', owner: 'iOS-3', pattern: /\b(struct|class|enum)\s+CleanAppDataView\b/ },
  // Data Health repair — owned by iOS-3.
  { name: 'AutoRepairOrchestrator_type', owner: 'iOS-3', pattern: /\b(struct|class|actor)\s+AutoRepairOrchestrator\b/ },
  { name: 'AppDataRepairLedger_type', owner: 'iOS-3', pattern: /\b(struct|class)\s+AppDataRepairLedger\b/ },
  // Cloud sync — owned by iOS-7.
  { name: 'CloudSnapshot_type', owner: 'iOS-7', pattern: /\b(struct|class)\s+CloudSnapshot\b/ },
  { name: 'writeSnapshot_func', owner: 'iOS-7', pattern: /\bfunc\s+writeSnapshot\b/ },
  // Focus Mode — owned by iOS-5.
  { name: 'FocusStepQueue_func', owner: 'iOS-5', pattern: /\bfunc\s+buildFocusStepQueue\b/ },
];

describe('iosBootstrapNoBusinessLogic', () => {
  const swiftFiles = collectSwiftFiles(resolve(repoRoot, 'ios'));

  for (const { name, owner, pattern } of BUSINESS_LOGIC) {
    it(`iosBootstrap no ${name} declared yet (owned by ${owner})`, () => {
      const hits: string[] = [];
      for (const file of swiftFiles) {
        const text = readFileSync(file, 'utf8');
        if (pattern.test(text)) {
          hits.push(file.replace(`${repoRoot}/`, ''));
        }
      }
      expect(hits, `${name} found in: ${hits.join(', ')}`).toEqual([]);
    });
  }

  it('iosBootstrap every package source file declares only a version constant', () => {
    const packagesDir = resolve(repoRoot, 'ios/packages');
    for (const pkg of readdirSync(packagesDir, { withFileTypes: true })) {
      if (!pkg.isDirectory()) continue;
      const sourcePath = resolve(packagesDir, pkg.name, 'Sources', pkg.name, `${pkg.name}.swift`);
      const text = readFileSync(sourcePath, 'utf8');
      // The only public exported symbol must be the version enum.
      const publicDecls = (text.match(/^\s*public\s+(struct|class|enum|protocol|actor|func|var|let)\b/gm) ?? []);
      // The exact pattern is `public enum <Pkg>Version`.
      expect(publicDecls.length).toBeLessThanOrEqual(1);
      expect(text).toMatch(new RegExp(`public\\s+enum\\s+${pkg.name}Version\\b`));
      expect(text).toMatch(/public\s+static\s+let\s+value\s*=\s*"0\.0\.1-bootstrap"/);
    }
  });
});
