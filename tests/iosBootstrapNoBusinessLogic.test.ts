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
  /**
   * Optional list of repo-relative path prefixes that are EXEMPT from
   * this symbol's ban. Used by iOS-2B to sanction the AppData model
   * surface inside `ios/packages/IronPathDomain/` while keeping every
   * other location forbidden.
   */
  readonly exemptPrefixes?: readonly string[];
}

const BUSINESS_LOGIC: readonly ForbiddenSymbol[] = [
  // AppData model — sanctioned by iOS-2B inside IronPathDomain ONLY.
  // A `struct AppData` declared anywhere else still fails the lock.
  {
    name: 'AppData_struct_or_class',
    owner: 'iOS-2 (IronPathDomain)',
    pattern: /\b(struct|final\s+class|class)\s+AppData\b/,
    exemptPrefixes: ['ios/packages/IronPathDomain/'],
  },
  // TrainingDecision golden TYPE skeleton — sanctioned by iOS-4B1 inside
  // IronPathTrainingDecision ONLY. The `struct TrainingDecision` decode type
  // lands there; declarations elsewhere still fail the lock.
  {
    name: 'TrainingDecision_type',
    owner: 'iOS-4B1 (IronPathTrainingDecision)',
    pattern: /\b(struct|class|enum)\s+TrainingDecision\b(?!Version)/,
    exemptPrefixes: ['ios/packages/IronPathTrainingDecision/'],
  },
  // TrainingDecision ENGINE function — iOS-4B2 lands the first engine slice
  // (buildTrainingDecisionFromCleanInput + the effectivePhase/sessionIntent core
  // rules) inside IronPathTrainingDecision. The public entry name carries the
  // `FromCleanInput` suffix and does not match this bare-name pattern; the
  // exemption sanctions any bare engine helper INSIDE the package while keeping
  // `func buildTrainingDecision` globally forbidden everywhere else (so no app /
  // cloud surface can call a raw, un-branded engine entry). The deferred engines
  // (prescription/readiness/deload/userFacing) are kept out by
  // iosTrainingDecisionSwiftEngineStaticGuards.
  {
    name: 'buildTrainingDecision_func',
    owner: 'iOS-4B2 (IronPathTrainingDecision)',
    pattern: /\bfunc\s+buildTrainingDecision\b/,
    exemptPrefixes: ['ios/packages/IronPathTrainingDecision/'],
  },
  // CleanAppDataView — sanctioned by iOS-3A inside IronPathDataHealth ONLY.
  // The struct landed in iOS-3A as the read-only projection foundation;
  // iOS-3B and iOS-4 consume it. Declarations outside the Data Health
  // package still fail the lock.
  {
    name: 'CleanAppDataView_type',
    owner: 'iOS-3A (IronPathDataHealth)',
    pattern: /\b(struct|class|enum)\s+CleanAppDataView\b/,
    exemptPrefixes: ['ios/packages/IronPathDataHealth/'],
  },
  // AutoRepairOrchestrator — sanctioned by iOS-3B inside
  // IronPathDataHealth ONLY. The orchestrator + 5 safe repair recipes
  // land in iOS-3B; iOS-3C will add the remaining 4 recipes + the
  // ingress pipeline that wraps the orchestrator. Declarations
  // outside the Data Health package still fail the lock.
  {
    name: 'AutoRepairOrchestrator_type',
    owner: 'iOS-3B (IronPathDataHealth)',
    pattern: /\b(struct|class|actor)\s+AutoRepairOrchestrator\b/,
    exemptPrefixes: ['ios/packages/IronPathDataHealth/'],
  },
  // AppDataRepairLedger — owned by iOS-3B. iOS-3A ships the typed
  // ledger ENTRY (`DataHealthRepairLedgerEntry`) plus pure
  // append/idempotency helpers, but not the orchestrator/manager
  // surface this guard targets.
  { name: 'AppDataRepairLedger_type', owner: 'iOS-3B', pattern: /\b(struct|class)\s+AppDataRepairLedger\b/ },
  // Cloud sync — owned by iOS-7.
  { name: 'CloudSnapshot_type', owner: 'iOS-7', pattern: /\b(struct|class)\s+CloudSnapshot\b/ },
  { name: 'writeSnapshot_func', owner: 'iOS-7', pattern: /\bfunc\s+writeSnapshot\b/ },
  // Focus Mode — owned by iOS-5.
  { name: 'FocusStepQueue_func', owner: 'iOS-5', pattern: /\bfunc\s+buildFocusStepQueue\b/ },
];

describe('iosBootstrapNoBusinessLogic', () => {
  const swiftFiles = collectSwiftFiles(resolve(repoRoot, 'ios'));

  for (const { name, owner, pattern, exemptPrefixes } of BUSINESS_LOGIC) {
    it(`iosBootstrap no ${name} declared yet (owned by ${owner})`, () => {
      const hits: string[] = [];
      for (const file of swiftFiles) {
        const relative = file.replace(`${repoRoot}/`, '');
        if (exemptPrefixes?.some((prefix) => relative.startsWith(prefix))) continue;
        const text = readFileSync(file, 'utf8');
        if (pattern.test(text)) {
          hits.push(relative);
        }
      }
      expect(hits, `${name} found in: ${hits.join(', ')}`).toEqual([]);
    });
  }

  it('iosBootstrap every package source file declares only a version constant (IronPathDomain exempt after iOS-2B)', () => {
    const packagesDir = resolve(repoRoot, 'ios/packages');
    for (const pkg of readdirSync(packagesDir, { withFileTypes: true })) {
      if (!pkg.isDirectory()) continue;
      // IronPathDomain is the sanctioned home of the iOS-2B AppData
      // model surface. Its `IronPathDomain.swift` file remains
      // version-constant-only (per the iOS-1 contract), but the
      // package as a whole now declares many model types. The
      // per-file scan therefore only checks the `<Pkg>.swift` file
      // itself; sibling files in `Sources/IronPathDomain/` are
      // covered by `iosAppDataSwiftModelStaticGuards.test.ts`.
      const sourcePath = resolve(packagesDir, pkg.name, 'Sources', pkg.name, `${pkg.name}.swift`);
      const text = readFileSync(sourcePath, 'utf8');
      // The version-constant file's only public exported symbol must
      // be the version enum, regardless of which package it belongs
      // to. iOS-2B did NOT modify `IronPathDomain.swift` (the
      // placeholder is preserved per the iOS-2A plan §5).
      const publicDecls = (text.match(/^\s*public\s+(struct|class|enum|protocol|actor|func|var|let)\b/gm) ?? []);
      expect(publicDecls.length).toBeLessThanOrEqual(1);
      expect(text).toMatch(new RegExp(`public\\s+enum\\s+${pkg.name}Version\\b`));
      expect(text).toMatch(/public\s+static\s+let\s+value\s*=\s*"0\.0\.1-bootstrap"/);
    }
  });
});
