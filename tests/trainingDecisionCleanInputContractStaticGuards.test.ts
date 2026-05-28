// Static guards for TrainingDecision Clean Input Contract Lock V1.
// File-system level scans that fail CI when a future change introduces a raw
// AppData → TrainingDecision call path. See
// docs/TRAININGDECISION_CLEAN_INPUT_CONTRACT_LOCK_V1.md.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '..');

const readSource = (relPath: string): string => readFileSync(resolve(ROOT, relPath), 'utf8');

const walk = (dir: string, files: string[] = []): string[] => {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) walk(full, files);
    else if (/\.(ts|tsx)$/.test(entry)) files.push(full);
  }
  return files;
};

const collect = (relPaths: string[]) =>
  relPaths.flatMap((rel) => walk(resolve(ROOT, rel)));

const relPath = (full: string) => relative(ROOT, full).replaceAll('\\', '/');

const FORBIDDEN_RAW_ENGINE_SYMBOLS = [
  'buildTrainingDecision',
  'buildTrainingDecisionContext',
];

const importsRawSymbol = (source: string, symbol: string): boolean => {
  // Match `import { ... symbol ... } from '...engines/trainingDecision(Engine|Context)'`
  // including multi-line import lists.
  const pattern = new RegExp(
    `import\\s+(?:type\\s+)?\\{[^}]*\\b${symbol}\\b[^}]*\\}\\s+from\\s+['"][^'"]*\\/engines\\/trainingDecision(?:Engine|Context)['"]`,
    's',
  );
  return pattern.test(source);
};

describe('trainingDecisionCleanInputContractStaticGuards', () => {
  it('trainingDecisionCleanInputContractModuleExposesContract', () => {
    const source = readSource('src/engines/trainingDecisionCleanInput.ts');
    expect(source.includes('CLEAN_TRAINING_DECISION_INPUT_BRAND')).toBe(true);
    expect(source.includes('CLEAN_TRAINING_DECISION_CONTEXT_SOURCE_BRAND')).toBe(true);
    expect(source.includes('export type CleanTrainingDecisionInput')).toBe(true);
    expect(source.includes('export type CleanTrainingDecisionContextSource')).toBe(true);
    expect(source.includes('export const createCleanTrainingDecisionInput')).toBe(true);
    expect(source.includes('export const createCleanTrainingDecisionContextSource')).toBe(true);
    expect(source.includes('export function assertCleanTrainingDecisionInput')).toBe(true);
    expect(source.includes('export const buildTrainingDecisionFromCleanInput')).toBe(true);
    expect(source.includes('export const buildTrainingDecisionContextFromCleanInput')).toBe(true);
  });

  it('trainingDecisionCleanInputContractCleanModuleIsPure', () => {
    const source = readSource('src/engines/trainingDecisionCleanInput.ts');
    expect(source).not.toMatch(/from\s+['"][^'"]*\/cloudSync\//);
    expect(source).not.toMatch(/from\s+['"][^'"]*\/cloudProduction\//);
    expect(source).not.toMatch(/from\s+['"][^'"]*\/productionApi\//);
    expect(source).not.toMatch(/from\s+['"][^'"]*\/storage\//);
    expect(source).not.toMatch(/\blocalStorage\b/);
    expect(source).not.toMatch(/\bIndexedDB\b/);
    expect(source).not.toMatch(/\bnavigator\.sendBeacon\b/);
  });

  it('trainingDecisionCleanInputContractFeaturesDoNotImportRawEngine', () => {
    const files = collect(['src/features']);
    const offenders: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      for (const symbol of FORBIDDEN_RAW_ENGINE_SYMBOLS) {
        if (importsRawSymbol(src, symbol)) {
          offenders.push(`${relPath(file)}: imports ${symbol} from raw engine`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('trainingDecisionCleanInputContractFeaturesUseCleanFactory', () => {
    const features = ['TodayView', 'PlanView', 'RecordView'];
    for (const name of features) {
      const file = resolve(ROOT, `src/features/${name}.tsx`);
      const src = readFileSync(file, 'utf8');
      expect(src.includes('trainingDecisionCleanInput'), `${name} must import from trainingDecisionCleanInput`).toBe(true);
      expect(src.includes('createCleanTrainingDecisionInput'), `${name} must use createCleanTrainingDecisionInput`).toBe(true);
      expect(src.includes('buildTrainingDecisionFromCleanInput'), `${name} must use buildTrainingDecisionFromCleanInput`).toBe(true);
    }
  });

  it('trainingDecisionCleanInputContractAppUsesCleanFactory', () => {
    const src = readSource('src/App.tsx');
    expect(src.includes('trainingDecisionCleanInput')).toBe(true);
    expect(src.includes('createCleanTrainingDecisionInput')).toBe(true);
    expect(src.includes('buildTrainingDecisionFromCleanInput')).toBe(true);
    // The leftover finishSession code path must no longer call buildTrainingDecision directly.
    expect(/\bbuildTrainingDecision\s*\(/.test(src)).toBe(false);
  });

  it('trainingDecisionCleanInputContractCloudPathsDoNotImportEngine', () => {
    const files = collect(['src/cloudProduction', 'src/cloudSync', 'src/storage', 'src/sync']);
    const offenders: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      for (const symbol of FORBIDDEN_RAW_ENGINE_SYMBOLS) {
        if (importsRawSymbol(src, symbol)) {
          offenders.push(`${relPath(file)}: imports ${symbol}`);
        }
      }
      // Cloud paths must not import sessionBuilder either — they go through CleanAppDataView only.
      if (/from\s+['"][^'"]*\/engines\/sessionBuilder['"]/.test(src)) {
        offenders.push(`${relPath(file)}: imports sessionBuilder`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('trainingDecisionCleanInputContractEnginePipelineRemainsCanonical', () => {
    const source = readSource('src/engines/enginePipeline.ts');
    expect(source.includes('buildCleanAppDataView')).toBe(true);
    expect(/buildTrainingDecisionContext\(\s*cleanAppDataView\.appData/.test(source)).toBe(true);
  });

  it('trainingDecisionCleanInputContractEngineSourceHasNoLegacyAdviceRead', () => {
    const decisionSource = readSource('src/engines/trainingDecisionEngine.ts');
    const readinessSource = readSource('src/engines/readinessEngine.ts');
    const adaptiveSource = readSource('src/engines/adaptiveFeedbackEngine.ts');
    const combined = `${decisionSource}\n${readinessSource}\n${adaptiveSource}`;
    [
      'exercise.suggestion',
      'exercise.warning',
      '.prescription.weeklyAdjustment',
      'session.explanations',
    ].forEach((pattern) => {
      expect(combined.includes(pattern), `forbidden legacy advice read: ${pattern}`).toBe(false);
    });
  });

  it('trainingDecisionCleanInputContractSessionBuilderNoLiveLegacyAdviceRead', () => {
    const source = readSource('src/engines/sessionBuilder.ts');
    // sessionBuilder writes session.explanations / exercise.suggestion as
    // snapshot fields on the new session object — that is allowed. What is
    // forbidden is reading those fields back from history as live recommendation
    // input. The patterns below would only appear if a future change began
    // reading them.
    [
      'session.explanations[',
      '.suggestion ?? makeSuggestion',
      'history.map((session) => session.explanations',
      'history.flatMap((session) => session.explanations',
      'session.deloadDecision.options',
      'session.deloadDecision.title',
    ].forEach((pattern) => {
      expect(source.includes(pattern), `forbidden legacy-advice live read: ${pattern}`).toBe(false);
    });
  });

  it('trainingDecisionCleanInputContractFeaturesDirectDataExtractionAbsent', () => {
    // The features below must not extract { todayStatus, history, mesocyclePlan,
    // screening } from raw `data.` directly to feed buildTrainingDecision. The
    // tripwire matches a multi-line literal pattern of the form
    // `buildTrainingDecision(\n        {\n          ...todayStatus: data.todayStatus`.
    const offenders: string[] = [];
    for (const file of ['src/features/TodayView.tsx', 'src/features/PlanView.tsx', 'src/features/RecordView.tsx']) {
      const src = readSource(file);
      const tripwire = /buildTrainingDecision\s*\(\s*\{[^}]*todayStatus:\s*data\.todayStatus[^}]*history:\s*data\.history/s;
      if (tripwire.test(src)) offenders.push(`${file}: raw data extraction into buildTrainingDecision`);
    }
    expect(offenders).toEqual([]);
  });

  it('trainingDecisionCleanInputContractCleanInputIsCanonicalImport', () => {
    // No production file outside src/engines/** and src/App.tsx should import
    // buildTrainingDecision from trainingDecisionEngine. Tests are exempt.
    const offenders: string[] = [];
    const files = collect(['src/features', 'src/presenters', 'src/ui', 'src/uiOs', 'src/devApi']);
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      if (/import[^;]*\bbuildTrainingDecision\b[^;]*from\s+['"][^'"]*trainingDecisionEngine['"]/.test(src)) {
        offenders.push(`${relPath(file)} imports buildTrainingDecision from trainingDecisionEngine`);
      }
      if (/import[^;]*\bbuildTrainingDecisionContext\b[^;]*from\s+['"][^'"]*trainingDecisionContext['"]/.test(src)) {
        offenders.push(`${relPath(file)} imports buildTrainingDecisionContext from trainingDecisionContext`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('trainingDecisionCleanInputContractCleanAppDataViewSourcedFromIngressOnly', () => {
    // buildCleanAppDataView callers must be either enginePipeline, ingress
    // pipeline, App.tsx (startSession), the new clean input module, or a feature
    // that derives its own per-component view (RecordView). Future callers from
    // cloud / storage / sync paths must instead use processIncomingAppData.
    const offenders: string[] = [];
    const ALLOWED_CALLERS = new Set([
      'src/engines/enginePipeline.ts',
      'src/engines/trainingDecisionCleanInput.ts',
      'src/dataHealth/appDataIngressPipeline.ts',
      'src/dataHealth/cleanAppDataView.ts',
      'src/App.tsx',
      'src/features/RecordView.tsx',
    ]);
    const files = collect(['src']);
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      if (!/\bbuildCleanAppDataView\s*\(/.test(src)) continue;
      const rel = relPath(file);
      if (!ALLOWED_CALLERS.has(rel)) offenders.push(`${rel} calls buildCleanAppDataView outside the allowed list`);
    }
    expect(offenders).toEqual([]);
  });
});
