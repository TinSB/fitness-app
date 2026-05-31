import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// HK-2 HealthKit Workout-History Import V1 — static guards.
//
// Locks the HK-2 surface: WITHIN the already-ungated read-only HealthKit boundary
// (master §6.2/§8/§10/§17/§18, ungated by HK-1 and refined — not expanded — in the
// HK-2 PR), the user can read recent Apple Health WORKOUTS and store them as
// DERIVED, source-tagged records. Hard boundaries:
//   • Pure `WorkoutReading`/`WorkoutSampleSource` seam + `HealthKitWorkoutMapper`
//     (→ `ImportedWorkoutSample`, source "healthkit_import") + `HealthKitWorkoutImporter`
//     in `IronPathHealthKit` — all HealthKit-free (host `swift test` exercises them).
//   • The real `HKWorkout` reader lives in the SAME single `#if os(iOS)` adapter
//     file as HK-1 (locked centrally by tests/iosBootstrapForbiddenImports.test.ts).
//   • Imported workouts land in `AppData.importedWorkoutSamples` — a bag SEPARATE
//     from canonical `history` — through the SAME DataHealth-gated write path
//     (`CanonicalSessionWriter`, §8). DERIVED / display-only.
//   • RED LINE: an imported workout is NEVER a canonical native `TrainingSession`
//     and NEVER feeds the `IronPathTrainingDecision` engine. This file pins that:
//     the engine sources reference `importedWorkoutSamples` NOWHERE.
//   • Thin app card + view-model co-located in `ProfileRootView` (honest status,
//     never imports HealthKit, routes through the gated writer). No new app file.
//   • This IMPORT path is read-only; the workout WRITE-BACK (export) is the separate
//     HK-3 slice, confined to the SAME single adapter and locked by
//     tests/iosHealthKitWorkoutExportStaticGuards.test.ts. No network/cloud/remote.
// ---------------------------------------------------------------------------

const repoRoot = resolve(process.cwd());
const repoFile = (p: string): string => resolve(repoRoot, p);

const HK_SRC = 'ios/packages/IronPathHealthKit/Sources/IronPathHealthKit';
const SEAM = `${HK_SRC}/WorkoutReading.swift`;
const MAPPER = `${HK_SRC}/HealthKitWorkoutMapper.swift`;
const IMPORTER = `${HK_SRC}/HealthKitWorkoutImporter.swift`;
const ADAPTER = `${HK_SRC}/HealthKitBodyMassSource.swift`;

const DOMAIN_SRC = 'ios/packages/IronPathDomain/Sources/IronPathDomain';
const WORKOUT_TYPE = `${DOMAIN_SRC}/ImportedWorkoutSample.swift`;
const APPEND = `${DOMAIN_SRC}/ImportedWorkoutSampleImport.swift`;

const WRITER =
  'ios/packages/IronPathPersistence/Sources/IronPathPersistence/CanonicalSessionWriter.swift';
const ENGINE_SRC_DIR = 'ios/packages/IronPathTrainingDecision/Sources';
const APP = 'ios/IronPath/ProfileRootView.swift';
const DOC = 'docs/ios-native-migration/IOS_HK2_HEALTHKIT_WORKOUT_IMPORT_V1.md';
const DOC_HK2B = 'docs/ios-native-migration/IOS_HK2b_WORKOUT_DISTANCE_HEARTRATE_V1.md';

const exists = (p: string): boolean => existsSync(repoFile(p));
const stripSwiftComments = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
const raw = (p: string): string => readFileSync(repoFile(p), 'utf8');
const code = (p: string): string => stripSwiftComments(raw(p));

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

// ---- 1. Pure HealthKit layer: HealthKit-free, source-tagged, read-only ----

describe('HK-2 pure workout import layer', () => {
  it('1. seam + mapper + importer files exist', () => {
    expect(exists(SEAM)).toBe(true);
    expect(exists(MAPPER)).toBe(true);
    expect(exists(IMPORTER)).toBe(true);
  });

  it('2. the seam exposes a read-only WorkoutSampleSource + plain WorkoutReading', () => {
    const m = code(SEAM);
    expect(m).toMatch(/struct\s+WorkoutReading\b/);
    expect(m).toMatch(/protocol\s+WorkoutSampleSource\b/);
    expect(m).toMatch(/func\s+requestReadAuthorization\b/);
    expect(m).toMatch(/func\s+recentWorkouts\b/);
    // the seam itself imports no HealthKit (host-testable)
    expect(m).not.toMatch(/^\s*import\s+HealthKit\s*$/m);
  });

  it('3. the mapper is pure, source-tagged "healthkit_import", SI/derived', () => {
    const m = code(MAPPER);
    expect(m).toMatch(/enum\s+HealthKitWorkoutMapper\b/);
    expect(m).toMatch(/func\s+sample\b/);
    // unambiguous derived-import source tag
    expect(m).toMatch(/source\s*=\s*"healthkit_import"/);
    // produces the Domain ImportedWorkoutSample (the derived bag type)
    expect(m).toMatch(/ImportedWorkoutSample\b/);
    // content-addressed id for idempotent re-import (workout-<hash>)
    expect(m).toMatch(/"workout-"/);
    // pure: no HealthKit, no IO, no inline wall-clock (timestamps injected)
    expect(m).not.toMatch(/^\s*import\s+HealthKit\s*$/m);
    expect(m).not.toMatch(/\bHKWorkout\b/);
    expect(m).not.toMatch(/Date\s*\(\s*\)/);
  });

  it('4. the importer authorizes → reads → maps, HealthKit-free + read-only', () => {
    const m = code(IMPORTER);
    expect(m).toMatch(/struct\s+HealthKitWorkoutImporter\b/);
    expect(m).toMatch(/func\s+importRecentWorkouts\b/);
    expect(m).not.toMatch(/^\s*import\s+HealthKit\s*$/m);
    expect(m).not.toMatch(/\bHKWorkout\b/);
    // read-only: no write-back to Apple Health
    expect(m).not.toMatch(/\.save\s*\(/);
  });

  it('5. the real HKWorkout reader lives in the single #if os(iOS) adapter (read + HK-3 export)', () => {
    const a = code(ADAPTER);
    expect(a).toMatch(/struct\s+HealthKitWorkoutSource\b/);
    expect(a).toMatch(/\bHKWorkout\b/);
    // HK-2 READ authorization still shares nothing.
    expect(a).toMatch(/toShare:\s*\[\s*\]/);
    expect(raw(ADAPTER)).toMatch(/#if\s+os\(iOS\)/);
    // HK-3 (write-back) adds a BOUNDED workout export to this SAME single file: it
    // shares ONLY the workout type and writes ONLY HKWorkouts. The legacy read-only
    // negative assertions (no .save / no HKWorkout(...) construction) are intentionally
    // relaxed here; the export surface (idempotency / native-only / user-triggered) is
    // positively locked by tests/iosHealthKitWorkoutExportStaticGuards.test.ts, and the
    // "no OTHER Apple-Health write" boundary by tests/iosBootstrapForbiddenImports.test.ts.
  });
});

// ---- 6-7. Derived landing point: importedWorkoutSamples, NEVER history ----

describe('HK-2 derived (non-canonical) landing point', () => {
  it('6. the Domain ImportedWorkoutSample type + open-bag append exist', () => {
    expect(exists(WORKOUT_TYPE)).toBe(true);
    expect(exists(APPEND)).toBe(true);
    expect(code(WORKOUT_TYPE)).toMatch(/struct\s+ImportedWorkoutSample\b/);
  });

  it('7. the append rewrites importedWorkoutSamples and NEVER touches canonical history', () => {
    const m = code(APPEND);
    expect(m).toMatch(/func\s+appendingImportedWorkoutSample\b/);
    expect(m).toMatch(/"importedWorkoutSamples"/);
    // a read-only typed accessor for display
    expect(m).toMatch(/var\s+importedWorkoutSamples\b/);
    // it is NOT a history append (derived bag, not canonical sessions)
    expect(m).not.toMatch(/appendingHistorySession\b/);
    expect(m).not.toMatch(/"history"/);
  });
});

// ---- 8. Persistence: the SAME single gated write path (no second path) ----

describe('HK-2 reuses the single DataHealth-gated write path', () => {
  it('8. CanonicalSessionWriter adds workout entry points on performGatedAppend only', () => {
    const m = code(WRITER);
    expect(m).toMatch(/func\s+appendImportedWorkoutSample\b/);
    expect(m).toMatch(/func\s+appendImportedWorkoutSamples\b/);
    // every entry point delegates to the ONE private orchestration
    expect(m).toMatch(/performGatedAppend\b/);
    // there is exactly ONE store.save() site (the single gated path — no second
    // / parallel write path was introduced for workouts).
    const saves = m.match(/store\.save\s*\(/g) || [];
    expect(saves.length, `expected exactly one store.save(, found ${saves.length}`).toBe(1);
  });
});

// ---- 9. RED LINE: the engine never reads importedWorkoutSamples ----

describe('HK-2 imported workouts are display-only (never feed the engine)', () => {
  it('9. no IronPathTrainingDecision source references importedWorkoutSamples', () => {
    const engineFiles = collectSwiftFiles(resolve(repoRoot, ENGINE_SRC_DIR));
    const holders = engineFiles
      .filter((f) => /\bimportedWorkoutSamples\b/.test(stripSwiftComments(readFileSync(f, 'utf8'))))
      .map((f) => f.replace(`${repoRoot}/`, ''));
    expect(
      holders,
      `the engine must never read importedWorkoutSamples (display-only red line); found in: ${holders.join(', ')}`,
    ).toEqual([]);
  });
});

// ---- 10. App layer: thin, honest, gated, HealthKit-free, marked source ----

describe('HK-2 app layer', () => {
  it('10. ProfileRootView hosts the section + thin model, gated + honest + read-only', () => {
    const m = code(APP);
    expect(m).toMatch(/struct\s+HealthKitWorkoutImportSection\b/);
    expect(m).toMatch(/class\s+HealthKitWorkoutImportModel\b/);
    // routes through the package importer + the SAME gated writer + the gate
    expect(m).toMatch(/HealthKitWorkoutImporter\b/);
    expect(m).toMatch(/appendImportedWorkoutSamples\s*\(/);
    expect(m).toMatch(/processIncomingAppData\s*\(/);
    // honest status — denial/failure surfaced, never a fake success
    expect(m).toMatch(/enum\s+WorkoutImportStatus\b/);
    expect(m).toMatch(/case\s+noData\b/);
    expect(m).toMatch(/case\s+failed\s*\(/);
    expect(m).toMatch(/case\s+unavailable\b/);
    // rows are clearly marked as Apple-Health-origin
    expect(m).toMatch(/来自 Apple 健康/);
    // the app never imports HealthKit (uses the WorkoutSampleSource seam)
    expect(m).not.toMatch(/^\s*import\s+HealthKit\s*$/m);
  });
});

// ---- 11. Doc ships in sync ----

describe('HK-2 documentation', () => {
  it('11. the HK-2 doc exists and declares read-only / derived / never-canonical', () => {
    expect(exists(DOC)).toBe(true);
    const d = raw(DOC);
    expect(d).toMatch(/read-only/i);
    expect(d).toMatch(/importedWorkoutSamples/);
    expect(d).toMatch(/healthkit_import/);
  });
});

// ---------------------------------------------------------------------------
// HK-2b — distance + avg/max heart rate, a READ-ONLY refinement of the HK-2
// workout-history import (still derived/display-only, never canonical, never
// engine input). These pin the new sub-fields WITHOUT widening the boundary:
//   • the pure seam carries the new primitives (HealthKit-free);
//   • the pure mapper carries them into the derived ImportedWorkoutSample;
//   • the SAME single adapter reads them read-only — distance from the workout's
//     own statistics, heart rate over the workout window (heartRate added to the
//     read set, still toShare: []). No new banned HealthKit symbol token: heart
//     rate uses the already-exempted HKQuantityType (locked by
//     tests/iosBootstrapForbiddenImports.test.ts, sole-holder list unchanged).
// The display-only red line is still pinned by test 9 above (the engine references
// importedWorkoutSamples NOWHERE — that covers every sub-field, distance/HR included).
// ---------------------------------------------------------------------------

describe('HK-2b workout distance + avg/max heart rate (read-only, derived)', () => {
  it('12. the seam carries distance + avg/max heart-rate primitives, HealthKit-free', () => {
    const m = code(SEAM);
    expect(m).toMatch(/distanceMeters\b/);
    expect(m).toMatch(/avgHeartRateBpm\b/);
    expect(m).toMatch(/maxHeartRateBpm\b/);
    expect(m).not.toMatch(/^\s*import\s+HealthKit\s*$/m);
  });

  it('13. the pure mapper carries distance + avg/max heart rate (honest nil when absent)', () => {
    const m = code(MAPPER);
    expect(m).toMatch(/distanceMeters:\s*reading\.distanceMeters/);
    expect(m).toMatch(/avgHeartRate:\s*reading\.avgHeartRateBpm/);
    expect(m).toMatch(/maxHeartRate:\s*reading\.maxHeartRateBpm/);
    // still pure: no HealthKit, no IO
    expect(m).not.toMatch(/^\s*import\s+HealthKit\s*$/m);
    expect(m).not.toMatch(/\bHKWorkout\b/);
  });

  it('14. the single adapter reads distance + heart rate READ-ONLY (heartRate auth + statistics)', () => {
    const a = code(ADAPTER);
    // heart rate is added to the READ authorization set (a distinct quantity type),
    // still sharing nothing back.
    expect(a).toMatch(/heartRateType\s*=\s*HKQuantityType\(\s*\.heartRate\s*\)/);
    expect(a).toMatch(/read:\s*\[[^\]]*heartRateType[^\]]*\]/);
    expect(a).toMatch(/toShare:\s*\[\s*\]/);
    // distance from the workout's own bundled statistics (activity-mapped type);
    // heart rate from a discrete-statistics query over the workout window.
    expect(a).toMatch(/distanceType\b/);
    expect(a).toMatch(/HKStatisticsQuery\b/);
    expect(a).toMatch(/discreteAverage/);
    expect(a).toMatch(/discreteMax/);
    // HK-3 adds workout export to this same file (HKWorkout(...) + .save). The OTHER
    // Apple-Health types stay read-only: NO HKQuantitySample construction (body mass /
    // heart rate are never written back). The export surface is locked by
    // tests/iosHealthKitWorkoutExportStaticGuards.test.ts.
    expect(a).not.toMatch(/HKQuantitySample\s*\(/);
  });
});
