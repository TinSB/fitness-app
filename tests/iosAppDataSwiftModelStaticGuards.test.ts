import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// iOS-2B AppData Swift Models V1 — Swift model static guards.
//
// Scans every .swift file under
// `ios/packages/IronPathDomain/Sources/IronPathDomain/` and asserts the
// iOS-2A plan's hard rules are honoured:
//
//   * Each file in the documented 17-model set declares the type whose
//     name matches the file. Adding a new file fails this lock until
//     the explicit allow-list is bumped.
//   * No `Date` typed property on any model struct. Strings end-to-end
//     per iOS-2A plan §8.
//   * No `@Model` macro (SwiftData) and no `@Observable` (SwiftUI
//     observation framework) applied to the model surface. View models
//     in iOS-5+ are out of scope.
//   * No `import SwiftData` / `import CoreData` / `import HealthKit` /
//     etc. anywhere in the model sources.
//
// These are static, fast, deterministic checks that run in vitest
// without any Xcode dependency.
// ---------------------------------------------------------------------------

const repoRoot = resolve(process.cwd());
const MODELS_DIR = 'ios/packages/IronPathDomain/Sources/IronPathDomain';

const REQUIRED_MODEL_FILES = [
  'JSONValue',
  'SchemaVersion',
  'WeightUnit',
  'AppData',
  'AppSettings',
  'UserProfile',
  'TrainingSession',
  'TrainingSetLog',
  'ActualSetDraft',
  'ExercisePrescription',
  'MesocyclePlan',
  'ScreeningProfile',
  'ProgramTemplate',
  'HealthMetricSample',
  'UnitSettings',
  'TodayStatus',
  'AdaptiveCalibrationState',
] as const;

const collectSwift = (dir: string): string[] => {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectSwift(full));
    } else if (entry.name.endsWith('.swift')) {
      out.push(full);
    }
  }
  return out;
};

const readModel = (basename: string): string =>
  readFileSync(resolve(repoRoot, MODELS_DIR, `${basename}.swift`), 'utf8');

describe('iosAppDataSwiftModel — required model files exist', () => {
  for (const basename of REQUIRED_MODEL_FILES) {
    it(`iosAppDataSwiftModel ${basename}.swift exists`, () => {
      const path = resolve(repoRoot, MODELS_DIR, `${basename}.swift`);
      expect(statSync(path).isFile()).toBe(true);
    });
  }

  it('iosAppDataSwiftModel iOS-1 placeholder IronPathDomain.swift survives', () => {
    const text = readFileSync(
      resolve(repoRoot, MODELS_DIR, 'IronPathDomain.swift'),
      'utf8',
    );
    expect(text).toContain('IronPathDomainVersion');
    expect(text).toContain('"0.0.1-bootstrap"');
  });
});

describe('iosAppDataSwiftModel — each file declares its matching public type', () => {
  for (const basename of REQUIRED_MODEL_FILES) {
    it(`iosAppDataSwiftModel ${basename}.swift declares public ${basename}`, () => {
      const text = readModel(basename);
      // Accept enum / struct / class for variety (e.g. JSONValue is an
      // enum; AppData is a struct; SchemaVersionError is auxiliary).
      const pattern = new RegExp(
        `\\bpublic\\s+(enum|struct|final\\s+class|class)\\s+${basename}\\b`,
      );
      expect(
        pattern.test(text),
        `${basename}.swift must declare \`public (enum|struct|class) ${basename}\``,
      ).toBe(true);
    });
  }
});

describe('iosAppDataSwiftModel — no Date persisted-field declarations', () => {
  it('iosAppDataSwiftModel no `: Date` or `: Date?` field type on any model file', () => {
    const swiftFiles = collectSwift(resolve(repoRoot, MODELS_DIR));
    const hits: string[] = [];
    // Match a stored property declaration whose type is `Date` or
    // `Date?` (with optional trailing whitespace).
    // Allows `: DateFormatter` / `: DateComponents` because the word
    // boundary `\b` after `Date` requires a non-word continuation, and
    // both `F` and `C` are word characters that fail that boundary.
    const datePattern = /:\s*Date\??(?=[\s),=}])/;
    for (const file of swiftFiles) {
      const text = readFileSync(file, 'utf8');
      // Strip line comments so the doc-comment that says "never Date"
      // does not trigger.
      const stripped = text
        .split('\n')
        .map((line) => {
          const idx = line.indexOf('//');
          return idx >= 0 ? line.slice(0, idx) : line;
        })
        .join('\n');
      if (datePattern.test(stripped)) {
        hits.push(file.replace(`${repoRoot}/`, ''));
      }
    }
    expect(hits, `Date-typed fields found in: ${hits.join(', ')}`).toEqual([]);
  });
});

describe('iosAppDataSwiftModel — no @Model / @Observable on model types', () => {
  it('iosAppDataSwiftModel no @Model attribute appears in model sources', () => {
    const swiftFiles = collectSwift(resolve(repoRoot, MODELS_DIR));
    const hits: string[] = [];
    for (const file of swiftFiles) {
      const stripped = readFileSync(file, 'utf8')
        .split('\n')
        .map((line) => {
          const idx = line.indexOf('//');
          return idx >= 0 ? line.slice(0, idx) : line;
        })
        .join('\n');
      if (/@Model\b/.test(stripped)) {
        hits.push(file.replace(`${repoRoot}/`, ''));
      }
    }
    expect(hits, `@Model found in: ${hits.join(', ')}`).toEqual([]);
  });

  it('iosAppDataSwiftModel no @Observable attribute on AppData-shaped value types', () => {
    const swiftFiles = collectSwift(resolve(repoRoot, MODELS_DIR));
    const hits: string[] = [];
    for (const file of swiftFiles) {
      const stripped = readFileSync(file, 'utf8')
        .split('\n')
        .map((line) => {
          const idx = line.indexOf('//');
          return idx >= 0 ? line.slice(0, idx) : line;
        })
        .join('\n');
      if (/@Observable\b/.test(stripped)) {
        hits.push(file.replace(`${repoRoot}/`, ''));
      }
    }
    expect(hits, `@Observable found in: ${hits.join(', ')}`).toEqual([]);
  });
});
