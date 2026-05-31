import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// HK-3 HealthKit Workout WRITE-BACK (Export) V1 — static guards.
//
// HK-3 is the FIRST and ONLY Apple-Health WRITE in the whole iOS tree: after an
// explicit user tap, IronPath's own native completed sessions (`AppData.history`)
// are exported to Apple Health as `HKWorkout`s. This file POSITIVELY locks that new
// surface so the boundary relaxations made in the read-only guards
// (tests/iosBootstrapForbiddenImports.test.ts now allows the bounded export; the
// HK-2 guard's legacy "no .save / no HKWorkout(" negatives were relaxed) do NOT widen
// into anything more. Net protection does not decrease — it shifts from "no write at
// all" to "exactly one bounded, native-only, idempotent, user-triggered workout
// export, in the single adapter file" (master §22 — every boundary ships a guard).
//
// Hard boundaries pinned here:
//   • PURE layer is HealthKit-free and NATIVE-ONLY. `HealthKitWorkoutExporter` maps
//     ONLY `[TrainingSession]` (canonical native `history`) → `WorkoutExportRequest`;
//     it NEVER references `ImportedWorkoutSample` (the derived Apple-Health import bag)
//     — structural no-loop-back: an imported workout can never be re-exported.
//   • IDEMPOTENT via a session-id metadata tag (`com.ironpath.sessionID`), queried
//     back from Apple Health — no app-side dedup storage, no AppData schema bump.
//   • The ONLY write is an `HKWorkout` via `HKHealthStore.save`, sharing ONLY the
//     workout type (`toShare: [workoutType]`); NO other Apple-Health type is written
//     (no `HKQuantitySample`, no body-mass share). Confined to the single `#if os(iOS)`
//     adapter file (the sole-HealthKit-holder invariant stays — see the bootstrap guard).
//   • USER-TRIGGERED + HONEST app layer: a thin export section/model co-located in
//     `ProfileRootView` (no new app file / no project.pbxproj edit, the N-2/HK-2
//     precedent), driven by an explicit button — NEVER auto-exported — with honest
//     status (no fake success), and it never imports HealthKit.
// ---------------------------------------------------------------------------

const repoRoot = resolve(process.cwd());
const repoFile = (p: string): string => resolve(repoRoot, p);

const HK_SRC = 'ios/packages/IronPathHealthKit/Sources/IronPathHealthKit';
const SEAM = `${HK_SRC}/WorkoutExport.swift`;
const EXPORTER = `${HK_SRC}/HealthKitWorkoutExporter.swift`;
const ADAPTER = `${HK_SRC}/HealthKitBodyMassSource.swift`;
const APP = 'ios/IronPath/ProfileRootView.swift';
const DOC = 'docs/ios-native-migration/IOS_HK3_HEALTHKIT_WORKOUT_EXPORT_V1.md';

const exists = (p: string): boolean => existsSync(repoFile(p));
const stripSwiftComments = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
const raw = (p: string): string => readFileSync(repoFile(p), 'utf8');
const code = (p: string): string => stripSwiftComments(raw(p));

// ---- 1. Pure export layer: HealthKit-free, native-only, idempotent-anchored ----

describe('HK-3 pure export layer', () => {
  it('1. the export seam + pure exporter files exist', () => {
    expect(exists(SEAM)).toBe(true);
    expect(exists(EXPORTER)).toBe(true);
  });

  it('2. the seam exposes WorkoutExportRequest/Summary + a WorkoutExportSink, HealthKit-free', () => {
    const m = code(SEAM);
    expect(m).toMatch(/struct\s+WorkoutExportRequest\b/);
    expect(m).toMatch(/struct\s+WorkoutExportSummary\b/);
    expect(m).toMatch(/protocol\s+WorkoutExportSink\b/);
    expect(m).toMatch(/func\s+requestExportAuthorization\b/);
    expect(m).toMatch(/func\s+export\b/);
    // the seam itself imports no HealthKit (host-testable)
    expect(m).not.toMatch(/^\s*import\s+HealthKit\s*$/m);
    expect(m).not.toMatch(/\bHKWorkout\b/);
  });

  it('3. the exporter is pure, NATIVE-ONLY (no-loop-back), and idempotency-anchored', () => {
    const m = code(EXPORTER);
    expect(m).toMatch(/enum\s+HealthKitWorkoutExporter\b/);
    // maps ONLY canonical native TrainingSessions (AppData.history) — the signature
    // structurally excludes the derived Apple-Health import bag.
    expect(m).toMatch(/func\s+exportRequests\s*\(\s*forNativeHistory\s+sessions:\s*\[TrainingSession\]/);
    expect(m).toMatch(/\bTrainingSession\b/);
    // defensive no-loop-back: a healthkit-imported-tagged session is never exported.
    expect(m).toMatch(/"healthkit_import"/);
    // idempotency anchor: the app-namespaced session-id metadata key.
    expect(m).toMatch(/"com\.ironpath\.sessionID"/);
    // STRUCTURAL no-loop-back: the exporter NEVER touches the derived import bag.
    expect(m).not.toMatch(/\bImportedWorkoutSample\b/);
    // pure: no HealthKit, no HKWorkout, no inline wall-clock (instants come from the
    // sessions' own ISO strings).
    expect(m).not.toMatch(/^\s*import\s+HealthKit\s*$/m);
    expect(m).not.toMatch(/\bHKWorkout\b/);
    expect(m).not.toMatch(/Date\s*\(\s*\)/);
  });
});

// ---- 2. Adapter export: single file, workout-type-only share, no other write ----

describe('HK-3 adapter export boundary', () => {
  it('4. the single #if os(iOS) adapter conforms to WorkoutExportSink and writes ONLY HKWorkouts', () => {
    const a = code(ADAPTER);
    // export capability is co-located in the SAME single adapter (HealthKitWorkoutSource).
    expect(a).toMatch(/HealthKitWorkoutSource\s*:\s*WorkoutExportSink/);
    // shares ONLY the workout type for export (the first & only write capability).
    expect(a).toMatch(/toShare:\s*\[workoutType\]/);
    // the write is an HKWorkout saved via HKHealthStore.save.
    expect(a).toMatch(/HKWorkout\s*\(/);
    expect(a).toMatch(/store\.save\s*\(/);
    // idempotency: tag with + query by the session-id metadata key.
    expect(a).toMatch(/HealthKitWorkoutExporter\.metadataSessionIDKey/);
    expect(a).toMatch(/withMetadataKey/);
    // NO other Apple-Health type is written: no quantity-sample construction, and the
    // export share never includes body mass.
    expect(a).not.toMatch(/HKQuantitySample\s*\(/);
    expect(a).not.toMatch(/toShare:[^\]]*bodyMass/);
    // compiled iOS-only so host swift test excludes the real HealthKit calls.
    expect(raw(ADAPTER)).toMatch(/#if\s+os\(iOS\)/);
  });
});

// ---- 3. App layer: user-triggered, honest, native-only, HealthKit-free ----

describe('HK-3 app layer', () => {
  it('5. ProfileRootView hosts a thin, user-triggered, honest export section + model', () => {
    const m = code(APP);
    expect(m).toMatch(/struct\s+HealthKitWorkoutExportSection\b/);
    expect(m).toMatch(/class\s+HealthKitWorkoutExportModel\b/);
    expect(m).toMatch(/enum\s+WorkoutExportStatus\b/);
    // routes through the pure exporter + the export sink seam.
    expect(m).toMatch(/HealthKitWorkoutExporter\b/);
    // reads the NATIVE canonical history as the export source (never the derived bag).
    expect(m).toMatch(/\.history\b/);
    // honest status — duplicates/failure surfaced, never a fake success.
    expect(m).toMatch(/case\s+exported\b/);
    expect(m).toMatch(/case\s+failed\s*\(/);
    // an EXPLICIT user-triggered control (the export button), never automatic.
    expect(m).toMatch(/写回 Apple 健康/);
    // NEVER auto-exports: no .task / onAppear triggers the export.
    expect(m).not.toMatch(/\.task\s*\{[^}]*export/i);
    expect(m).not.toMatch(/onAppear[\s\S]{0,40}export/i);
    // the app never imports HealthKit (uses the WorkoutExportSink seam).
    expect(m).not.toMatch(/^\s*import\s+HealthKit\s*$/m);
  });
});

// ---- 4. Doc ships in sync ----

describe('HK-3 documentation', () => {
  it('6. the HK-3 doc exists and declares export / idempotent / native-only / user-triggered / device-local', () => {
    expect(exists(DOC)).toBe(true);
    const d = raw(DOC);
    expect(d).toMatch(/export|write-back/i);
    expect(d).toMatch(/idempoten/i);
    expect(d).toMatch(/native-only|no-loop-back/i);
    expect(d).toMatch(/user-triggered|user-gated/i);
    expect(d).toMatch(/device-local|on-device/i);
  });
});
