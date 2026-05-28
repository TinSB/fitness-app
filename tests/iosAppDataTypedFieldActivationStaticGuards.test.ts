import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// iOS-2C AppData Typed Field Activation — TS static guards.
//
// Asserts every iOS-2C-promoted model file actually carries the
// documented typed fields (not just a `_unknown` carrier). The list
// mirrors the iOS-3 / iOS-4 / iOS-5 Data Health / Training /
// Focus Mode unblock subset from the iOS-2C task brief.
//
// Source pattern checks: `public let <field>:` declared inside the
// model struct. Pure source-level scan — no Swift toolchain needed.
// ---------------------------------------------------------------------------

const repoRoot = resolve(process.cwd());
const MODELS_DIR = 'ios/packages/IronPathDomain/Sources/IronPathDomain';

const readModel = (basename: string): string =>
  readFileSync(resolve(repoRoot, MODELS_DIR, `${basename}.swift`), 'utf8');

interface ModelExpectation {
  readonly model: string;
  /** Field names that MUST be declared as `public let <name>:` */
  readonly typedFields: readonly string[];
}

/**
 * The iOS-2C minimum-unblock typed-field list. Every entry is a
 * field iOS-3 / iOS-4 / iOS-5 will read through a typed accessor.
 * Adding new fields requires extending this list AND the model
 * struct.
 */
const EXPECTATIONS: readonly ModelExpectation[] = [
  {
    model: 'TrainingSession',
    typedFields: [
      'id', 'date', 'startedAt', 'finishedAt', 'durationMin',
      'completed', 'earlyEndReason', 'restTimerState',
      'currentExerciseId', 'currentFocusStepId', 'currentSetIndex',
      'focusSessionComplete', 'focusCompletedStepIds',
      'focusActualSetDrafts', 'focusWarmupSetLogs', 'exercises',
    ],
  },
  {
    model: 'TrainingSetLog',
    typedFields: [
      'id', 'setIndex', 'exerciseId', 'originalExerciseId',
      'actualExerciseId', 'weight', 'actualWeightKg',
      'displayWeight', 'displayUnit', 'reps', 'rir', 'rpe',
      'techniqueQuality', 'painFlag', 'painArea', 'painSeverity',
      'completedAt', 'completionStatus', 'done',
    ],
  },
  {
    model: 'ExercisePrescription',
    typedFields: [
      'id', 'exerciseId', 'name', 'originalExerciseId',
      'actualExerciseId', 'displayExerciseId', 'recordExerciseId',
      'sets', 'warmupSets', 'plannedSets', 'prescription',
      'suggestion', 'adjustment', 'warning', 'explanations',
    ],
  },
  {
    model: 'ActualSetDraft',
    typedFields: [
      'setIndex', 'weight', 'reps', 'rir', 'rpe', 'exerciseId',
      'source', 'completedAt',
    ],
  },
  {
    model: 'AppSettings',
    typedFields: [
      'schemaVersion', 'selectedTemplateId', 'trainingMode',
      'unitSettings', 'healthIntegrationSettings',
      'useHealthDataForReadiness',
      'dataHealthRepairLedger', 'dataHealthAutoRepairSummary',
      'dataHealthRuntimeFlags', 'dataRepairLogs',
    ],
  },
  {
    model: 'UserProfile',
    typedFields: [
      'id', 'name', 'sex', 'age', 'heightCm', 'weightKg',
      'trainingLevel', 'primaryGoal', 'weeklyTrainingDays',
      'sessionDurationMin',
    ],
  },
  {
    model: 'ScreeningProfile',
    typedFields: [
      'userId', 'painTriggers', 'restrictedExercises',
      'correctionPriority', 'adaptiveState',
    ],
  },
  {
    model: 'ProgramTemplate',
    typedFields: [
      'id', 'userId', 'primaryGoal', 'splitType', 'daysPerWeek',
    ],
  },
  {
    model: 'MesocyclePlan',
    typedFields: ['id', 'startDate', 'endDate', 'phase', 'weeks'],
  },
  {
    model: 'TodayStatus',
    typedFields: ['date', 'sleep', 'energy', 'time', 'soreness'],
  },
  {
    model: 'AdaptiveCalibrationState',
    typedFields: ['version', 'lastUpdated', 'entries', 'recommendationLog'],
  },
  {
    model: 'HealthMetricSample',
    typedFields: [
      'id', 'source', 'sourceName', 'metricType',
      'startDate', 'endDate', 'value', 'unit',
      'importedAt', 'raw',
    ],
  },
  {
    model: 'UnitSettings',
    typedFields: ['weightUnit', 'displayUnit'],
  },
];

describe('iosAppDataTypedFieldActivation — every iOS-2C model declares its documented typed fields', () => {
  for (const { model, typedFields } of EXPECTATIONS) {
    it(`iosAppDataTypedFieldActivation ${model} declares ${typedFields.length} typed fields`, () => {
      const text = readModel(model);
      const missing: string[] = [];
      for (const field of typedFields) {
        const pattern = new RegExp(`\\bpublic\\s+let\\s+${field}\\s*:`);
        if (!pattern.test(text)) missing.push(field);
      }
      expect(missing,
        `${model} missing typed fields: ${missing.join(', ')}`,
      ).toEqual([]);
    });

    it(`iosAppDataTypedFieldActivation ${model} retains _unknown open-bag carrier`, () => {
      const text = readModel(model);
      expect(text).toMatch(/public\s+let\s+_unknown\s*:\s*OrderedJSONObject/);
    });

    it(`iosAppDataTypedFieldActivation ${model} declares an encoded() helper merging typed + unknown`, () => {
      const text = readModel(model);
      expect(text).toMatch(/public\s+func\s+encoded\(\)\s*->\s*JSONValue/);
    });
  }
});

describe('iosAppDataTypedFieldActivation — AppData typed accessors over root', () => {
  it('iosAppDataTypedFieldActivation AppData declares history / activeSession / settings / healthMetricSamples / adaptiveCalibration', () => {
    const text = readModel('AppData');
    for (const accessor of [
      'public var history: [TrainingSession]',
      'public var activeSession: TrainingSession?',
      'public var settings: AppSettings',
      'public var healthMetricSamples: [HealthMetricSample]',
      'public var adaptiveCalibration: AdaptiveCalibrationState?',
      'public var unitSettings: UnitSettings',
      'public var todayStatus: TodayStatus',
      'public var screeningProfile: ScreeningProfile',
      'public var mesocyclePlan: MesocyclePlan',
      'public var programTemplate: ProgramTemplate',
      'public var userProfile: UserProfile',
    ]) {
      expect(text, `AppData missing accessor: ${accessor}`).toContain(accessor);
    }
  });

  it('iosAppDataTypedFieldActivation AppData retains the root carrier + schemaVersion', () => {
    const text = readModel('AppData');
    expect(text).toMatch(/public\s+let\s+root\s*:\s*OrderedJSONObject/);
    expect(text).toMatch(/public\s+let\s+schemaVersion\s*:\s*SchemaVersion/);
  });
});

describe('iosAppDataTypedFieldActivation — NumberRepr triple shape (integer / double / decimal)', () => {
  it('iosAppDataTypedFieldActivation NumberRepr enum carries all three cases', () => {
    const text = readModel('JSONValue');
    expect(text).toMatch(/case\s+integer\(Int64\)/);
    expect(text).toMatch(/case\s+double\(Double\)/);
    expect(text).toMatch(/case\s+decimal\(Decimal\)/);
  });

  it('iosAppDataTypedFieldActivation canonical key comparator is case-insensitive', () => {
    const text = readModel('JSONValue');
    expect(text).toContain('canonicalKeyOrder');
    expect(text).toMatch(/lowercased\(\)/);
  });
});

describe('iosAppDataTypedFieldActivation — Swift test files for typed activation + real export exist', () => {
  it('iosAppDataTypedFieldActivation AppDataTypedFieldActivationTests.swift exists', () => {
    expect(
      existsSync(
        resolve(
          repoRoot,
          'ios/packages/IronPathDomain/Tests/IronPathDomainTests/AppDataTypedFieldActivationTests.swift',
        ),
      ),
    ).toBe(true);
  });

  it('iosAppDataTypedFieldActivation AppDataRealExportParityTests.swift exists', () => {
    expect(
      existsSync(
        resolve(
          repoRoot,
          'ios/packages/IronPathDomain/Tests/IronPathDomainTests/AppDataRealExportParityTests.swift',
        ),
      ),
    ).toBe(true);
  });
});
