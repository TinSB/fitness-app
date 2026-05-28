/*
 * iOS-0 parity-goldens generator (TypeScript entrypoint).
 *
 * Wrapped by scripts/generate-parity-goldens.mjs. NOT a runtime module —
 * it lives under scripts/ and is bundled via `vite build --ssr` into
 * `.ironpath/parity-goldens-runner/` before being executed by Node.
 *
 * Determinism contract — read this before changing anything:
 *   1. No Date.now() / Math.random() anywhere in this file or in the
 *      engines it drives. Clocks come from parityMeta.deterministicClockIso.
 *   2. JSON output is canonicalised (sorted keys, 2-space indent,
 *      trailing newline) so two consecutive runs produce byte-identical
 *      goldens.
 *   3. The privacy guard re-validates inputs and goldens; any token / email /
 *      userId / deviceLabel / JWT prefix aborts the run.
 *
 * iOS-0 freezes 5 fixture groups under tests/fixtures/parity/ — see
 * docs/ios-native-migration/IOS_0_CONTRACT_FIXTURE_EXPORT_V1.md.
 */

import { execSync } from 'node:child_process';
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { STORAGE_VERSION } from '../src/data/appConfig';
import { buildAppDataSnapshotHash } from '../src/cloudProduction/accountBoundaryLocalInventory';
import { buildCleanAppDataView } from '../src/dataHealth/cleanAppDataView';
import {
  createCleanTrainingDecisionInput,
  buildTrainingDecisionFromCleanInput,
} from '../src/engines/trainingDecisionCleanInput';
import { runAutoRepairOrchestrator } from '../src/dataHealth/autoRepairOrchestrator';
import { getAppDataRepairRegistry } from '../src/dataHealth/appDataRepairRegistry';
import { buildFocusStepQueue } from '../src/engines/focusModeStateEngine';
import { resolveFocusModeInteractionState } from '../src/engines/focusModeInteractionState';
import type { AppData, TrainingSession, TrainingTemplate } from '../src/models/training-model';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// The "phase19b-" prefix used by buildAppDataSnapshotHash. The parity
// tests assert any snapshot-hash golden carries this prefix.
const SNAPSHOT_HASH_PREFIX = 'phase19b-';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

const INPUT_ROOT = resolve(REPO_ROOT, 'tests/fixtures/parity/inputs');
const GOLDEN_ROOT = resolve(REPO_ROOT, 'tests/fixtures/parity/golden');

const GENERATOR_VERSION = 'v1';

const FIXTURE_IDS = [
  'app-data/snapshot-hash-stable-v1',
  'training-decision/normal-session-v1',
  'data-repair/session-lifecycle-residue-v1',
  'real-export/redacted-2026-05-27',
  'focus-mode/golden-path-session-v1',
] as const;

type FixtureId = (typeof FIXTURE_IDS)[number];

// ---------------------------------------------------------------------------
// Canonical JSON helpers
// ---------------------------------------------------------------------------

const sortKeysDeep = (value: unknown): unknown => {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => [k, sortKeysDeep(v)] as const);
  return Object.fromEntries(entries);
};

const canonicalStringify = (value: unknown): string =>
  `${JSON.stringify(sortKeysDeep(value), null, 2)}\n`;

const readJson = (path: string): unknown => {
  if (!existsSync(path)) {
    throw new Error(
      `parityGoldensEntry: input fixture missing — ${path}. ` +
        `Re-author the fixture before re-running the generator.`,
    );
  }
  return JSON.parse(readFileSync(path, 'utf8'));
};

const writeIfChanged = (
  path: string,
  contents: string,
  mode: GeneratorMode,
): { wrote: boolean; changed: boolean } => {
  const onDisk = existsSync(path) ? readFileSync(path, 'utf8') : null;
  const changed = onDisk !== contents;
  if (mode === 'check') return { wrote: false, changed };
  if (!changed) return { wrote: false, changed };
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, 'utf8');
  return { wrote: true, changed };
};

// ---------------------------------------------------------------------------
// Privacy guard
// ---------------------------------------------------------------------------

const PRIVACY_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'supabase_service_role_key', pattern: /SUPABASE_SERVICE_ROLE_KEY/i },
  { name: 'sb_secret_prefix', pattern: /sb_secret_/ },
  { name: 'service_role_literal', pattern: /service_role/i },
  // JWT prefix common to Supabase access tokens.
  { name: 'jwt_prefix', pattern: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXV/ },
  { name: 'stripe_or_api_key', pattern: /sk_(live|test)_/ },
  { name: 'api_key_literal', pattern: /api[_-]?key\s*[:=]/i },
  { name: 'email', pattern: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i },
  { name: 'bearer_token', pattern: /\bbearer\s+[A-Za-z0-9._\-=+]+/i },
  { name: 'authorization_header', pattern: /authorization\s*:/i },
  { name: 'cookie_header', pattern: /(set-cookie|cookie)\s*:/i },
];

// Allowed placeholder values. Anything matching these is exempt from the
// "userId / deviceLabel literal" guard so the goldens can document the
// allowed placeholder shape without tripping the scanner.
const PRIVACY_ALLOWLIST_VALUES = new Set([
  '<redacted>',
  'synthetic-user',
  'iPhone',
  'iPad',
  'redacted-device',
]);

class PrivacyGuardError extends Error {
  constructor(fixtureId: string, hits: string[]) {
    super(
      `parityGoldensEntry: privacy guard failed for ${fixtureId}\n` +
        hits.map((h) => `  - ${h}`).join('\n'),
    );
  }
}

const runPrivacyGuard = (fixtureId: string, jsonText: string): void => {
  const hits: string[] = [];
  for (const { name, pattern } of PRIVACY_PATTERNS) {
    const match = jsonText.match(pattern);
    if (match) {
      hits.push(`pattern '${name}' matched substring: ${truncate(match[0], 80)}`);
    }
  }
  // Targeted userId / deviceLabel guard — find any "userId": "<value>" or
  // "deviceLabel": "<value>" pair and reject unless the value is in the
  // allowlist or starts with `synthetic-`.
  const idPair = /"(userId|deviceLabel)"\s*:\s*"([^"]+)"/g;
  for (const m of jsonText.matchAll(idPair)) {
    const value = m[2];
    if (PRIVACY_ALLOWLIST_VALUES.has(value)) continue;
    if (value.startsWith('synthetic-')) continue;
    if (value === '<redacted>') continue;
    hits.push(`raw ${m[1]} '${truncate(value, 40)}' is not in the allowlist`);
  }
  if (hits.length > 0) throw new PrivacyGuardError(fixtureId, hits);
};

const truncate = (s: string, n: number): string =>
  s.length <= n ? s : `${s.slice(0, n)}…`;

// ---------------------------------------------------------------------------
// parityMeta validation
// ---------------------------------------------------------------------------

type ParityMeta = {
  id: FixtureId;
  schemaVersion: number;
  describes: string;
  privacy: 'synthetic' | 'redacted' | 'redacted-pointer';
  generatedFrom: string;
  tsCommit: string;
  generatedAtPolicy: 'none' | 'deterministic-clock';
  deterministicClockIso?: string;
  sourceNotes?: string;
};

const validateParityMeta = (fixtureId: FixtureId, raw: unknown): ParityMeta => {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`parityGoldensEntry: ${fixtureId} missing parityMeta object`);
  }
  const meta = (raw as Record<string, unknown>).parityMeta as
    | Record<string, unknown>
    | undefined;
  if (!meta) {
    throw new Error(`parityGoldensEntry: ${fixtureId} missing parityMeta object`);
  }
  if (meta.id !== fixtureId) {
    throw new Error(
      `parityGoldensEntry: ${fixtureId} parityMeta.id mismatch — got ${String(
        meta.id,
      )}`,
    );
  }
  if (meta.schemaVersion !== STORAGE_VERSION) {
    throw new Error(
      `parityGoldensEntry: ${fixtureId} parityMeta.schemaVersion=${String(
        meta.schemaVersion,
      )} must equal STORAGE_VERSION=${STORAGE_VERSION}`,
    );
  }
  if (typeof meta.tsCommit !== 'string' || meta.tsCommit.length === 0) {
    throw new Error(`parityGoldensEntry: ${fixtureId} parityMeta.tsCommit missing`);
  }
  if (meta.generatedAtPolicy === 'deterministic-clock' && typeof meta.deterministicClockIso !== 'string') {
    throw new Error(
      `parityGoldensEntry: ${fixtureId} parityMeta.deterministicClockIso required when generatedAtPolicy=deterministic-clock`,
    );
  }
  if (meta.privacy !== 'synthetic' && meta.privacy !== 'redacted' && meta.privacy !== 'redacted-pointer') {
    throw new Error(
      `parityGoldensEntry: ${fixtureId} parityMeta.privacy must be one of synthetic|redacted|redacted-pointer`,
    );
  }
  return meta as unknown as ParityMeta;
};

// ---------------------------------------------------------------------------
// Per-fixture generators
// ---------------------------------------------------------------------------

const generateSnapshotHash = (input: any, meta: ParityMeta) => {
  const payload = input.payload as Record<string, unknown>;
  const snapshotHash = buildAppDataSnapshotHash(payload);
  // 1-line shape summary so the Swift port can sanity-check input shape
  // without re-deriving the hash twice.
  const stableStringifyHashInputSummary = {
    topLevelKeys: Object.keys(payload).sort(),
    schemaVersion: payload.schemaVersion,
    unitSettingsWeightUnit:
      (payload.unitSettings as Record<string, unknown> | undefined)?.weightUnit ?? null,
    settingsTopLevelKeys:
      payload.settings && typeof payload.settings === 'object'
        ? Object.keys(payload.settings as Record<string, unknown>).sort()
        : [],
  };
  return {
    sourceFixtureId: meta.id,
    schemaVersion: STORAGE_VERSION,
    snapshotHash,
    snapshotHashPrefix: SNAPSHOT_HASH_PREFIX,
    stableStringifyHashInputSummary,
  };
};

const loadPointerAppData = (input: any): AppData => {
  const path = input.pointer?.path;
  if (typeof path !== 'string') {
    throw new Error('parityGoldensEntry: pointer fixture missing pointer.path');
  }
  return readJson(resolve(REPO_ROOT, path)) as AppData;
};

const generateTrainingDecision = (input: any, meta: ParityMeta) => {
  if (!meta.deterministicClockIso) {
    throw new Error('parityGoldensEntry: training-decision requires deterministicClockIso');
  }
  const nowIso = meta.deterministicClockIso;
  const appData = loadPointerAppData(input);
  const templateId = input.decisionMetadata?.templateId;
  const template = (appData.templates || []).find(
    (t: TrainingTemplate) => t.id === templateId,
  );
  if (!template) {
    throw new Error(
      `parityGoldensEntry: template ${templateId} not found in pointer AppData`,
    );
  }
  const clock = { now: () => new Date(nowIso) };
  const cleanView = buildCleanAppDataView(appData, clock);
  const cleanInput = createCleanTrainingDecisionInput(cleanView, {
    template,
    nowIso,
    trainingMode: input.decisionMetadata?.trainingMode,
  });
  const decision = buildTrainingDecisionFromCleanInput(cleanInput);
  return {
    sourceFixtureId: meta.id,
    decisionVersion: decision.decisionVersion,
    userFacing: decision.userFacing,
    hiddenDebugSignals: {
      arbitrationTrace: decision.hiddenDebugSignals?.arbitrationTrace ?? [],
    },
    // Useful auxiliary surfaces for the Swift parity port:
    finalDose: decision.finalDose,
    decisionCategory: decision.decisionCategory,
    decisionStrength: decision.decisionStrength,
    arbitrationReasonCode: decision.arbitrationReasonCode,
  };
};

const generateDataRepair = async (input: any, meta: ParityMeta) => {
  if (!meta.deterministicClockIso) {
    throw new Error('parityGoldensEntry: data-repair requires deterministicClockIso');
  }
  const nowDate = new Date(meta.deterministicClockIso);
  const baseAppData = input.payload as AppData;
  // Dry-run: invoke the orchestrator with detection only. There's no
  // dedicated dry-run flag — the orchestrator always applies safe-auto
  // repairs, so we re-derive the detection summary directly from the
  // registry to surface it in the golden alongside the apply result.
  const registry = getAppDataRepairRegistry();
  const detected = registry.byLayer('safe_auto')
    .map((definition) => definition.detect(baseAppData))
    .filter((r) => r.detected)
    .map((r) => ({
      repairId: r.repairId,
      occurrences: r.occurrences,
      affectedIds: r.affectedIds,
      severity: r.severity,
      userMessage: r.userMessage,
    }));
  // Apply pass.
  const applied = await runAutoRepairOrchestrator({
    appData: baseAppData,
    triggeredBy: 'startup',
    now: () => nowDate,
  });
  // Idempotency: second pass over already-repaired AppData should detect
  // no further occurrences (or, if it does, the receipt should match an
  // idempotent prior entry).
  const second = await runAutoRepairOrchestrator({
    appData: applied.appData,
    triggeredBy: 'startup',
    now: () => nowDate,
  });
  const ledger = (applied.appData as AppData).settings?.dataHealthRepairLedger ?? [];
  const lastReceipt = applied.results.find((r) => r.receipt)?.receipt ?? null;
  return {
    sourceFixtureId: meta.id,
    detected,
    dryRun: {
      summary: `${detected.length} repair(s) would apply`,
      detectedRepairIds: detected.map((d) => d.repairId),
    },
    applied: {
      changed: applied.changed,
      appliedCount: applied.results.filter((r) => r.status === 'applied').length,
      results: applied.results.map((r) => ({
        repairId: r.repairId,
        status: r.status,
        occurrences: r.occurrences,
        affectedIds: r.affectedIds,
      })),
      appDataHashBefore: applied.appDataHashBefore,
      appDataHashAfter: applied.appDataHashAfter,
    },
    receipt: lastReceipt
      ? {
          // Shape mirrors DataRepairLogEntry (src/models/training-model.ts).
          // createdAt is intentionally omitted from the golden — it is the
          // deterministic clock injected via parityMeta and already lives
          // in `parityGolden.deterministicClockIso`.
          id: lastReceipt.id,
          repairId: lastReceipt.repairId,
          category: lastReceipt.category,
          action: lastReceipt.action,
          affectedIds: lastReceipt.affectedIds,
          beforeSummary: lastReceipt.beforeSummary,
          afterSummary: lastReceipt.afterSummary,
        }
      : null,
    ledger: {
      length: Array.isArray(ledger) ? ledger.length : 0,
      lastEntryRepairId:
        Array.isArray(ledger) && ledger.length > 0
          ? ledger[ledger.length - 1]?.repairId
          : null,
    },
    postRepair: {
      historyLength: (applied.appData as AppData).history?.length ?? 0,
      restTimerCleared: !(applied.appData as AppData).history?.some(
        (s: TrainingSession) => s.restTimerState?.isRunning === true,
      ),
      currentExerciseCleared: !(applied.appData as AppData).history?.some(
        (s: TrainingSession) => typeof s.currentExerciseId === 'string' && s.currentExerciseId.length > 0,
      ),
    },
    idempotencySecondRun: {
      changed: second.changed,
      detectedCount: second.results.filter((r) => r.status === 'applied').length,
    },
  };
};

const generateRealExport = async (input: any, meta: ParityMeta) => {
  if (!meta.deterministicClockIso) {
    throw new Error('parityGoldensEntry: real-export requires deterministicClockIso');
  }
  const nowIso = meta.deterministicClockIso;
  const appData = loadPointerAppData(input);
  const clock = { now: () => new Date(nowIso) };
  const cleanView = buildCleanAppDataView(appData, clock);
  // Detection counts from the registry, not raw payloads.
  const registry = getAppDataRepairRegistry();
  const dataHealthScan = registry.list().map((definition) => {
    const r = definition.detect(appData);
    return {
      repairId: r.repairId,
      detected: r.detected,
      occurrences: r.occurrences,
      severity: r.severity,
    };
  });
  return {
    sourceFixtureId: meta.id,
    fixtureLoaded: true,
    privacyGuardPassed: true,
    expectedSchemaVersion: STORAGE_VERSION,
    actualSchemaVersion: appData.schemaVersion,
    snapshotHash: buildAppDataSnapshotHash(appData),
    cleanAppDataViewBuilt: cleanView !== null && cleanView !== undefined,
    cleanedHistoryLength: cleanView.appData.history?.length ?? 0,
    dataHealthScan,
  };
};

const generateFocusMode = (input: any, meta: ParityMeta) => {
  const session = input.session as TrainingSession;
  const queue = buildFocusStepQueue(session);
  const interactionState = resolveFocusModeInteractionState({
    session,
    focusStepQueue: queue,
    activeStep: queue[0],
    primaryAction: 'log-set',
    isActiveSession: true,
  } as any);
  return {
    sourceFixtureId: meta.id,
    focusStepQueueLength: queue.length,
    focusStepQueue: queue,
    stepIds: queue.map((s) => s.id),
    primaryActions: {
      forActiveStep: interactionState?.primaryAction ?? null,
    },
    terminalState: {
      lastStepId: queue[queue.length - 1]?.id ?? null,
      lastStepType: queue[queue.length - 1]?.stepType ?? null,
    },
  };
};

const GENERATORS: Record<FixtureId, (input: any, meta: ParityMeta) => unknown | Promise<unknown>> = {
  'app-data/snapshot-hash-stable-v1': generateSnapshotHash,
  'training-decision/normal-session-v1': generateTrainingDecision,
  'data-repair/session-lifecycle-residue-v1': generateDataRepair,
  'real-export/redacted-2026-05-27': generateRealExport,
  'focus-mode/golden-path-session-v1': generateFocusMode,
};

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------

type GeneratorMode = 'write' | 'check' | 'list';

const sourceCommitShort = (): string => {
  try {
    return execSync('git rev-parse HEAD', { cwd: REPO_ROOT })
      .toString()
      .trim();
  } catch {
    return 'unknown';
  }
};

const runFixture = async (
  id: FixtureId,
  mode: GeneratorMode,
  sourceCommit: string,
): Promise<{ id: FixtureId; changed: boolean }> => {
  const inputPath = resolve(INPUT_ROOT, `${id}.json`);
  const goldenPath = resolve(GOLDEN_ROOT, `${id}.json`);
  const inputRaw = readJson(inputPath);
  const meta = validateParityMeta(id, inputRaw);
  // Privacy guard runs on the input fixture's text — not on the
  // dereferenced redacted real export.
  runPrivacyGuard(`${id} (input)`, readFileSync(inputPath, 'utf8'));
  const payload = await GENERATORS[id](inputRaw, meta);
  const goldenObject = {
    parityGolden: {
      sourceFixtureId: id,
      generatedFromCommit: sourceCommit,
      generatedAtPolicy: meta.generatedAtPolicy,
      deterministicClockIso: meta.deterministicClockIso ?? null,
      generatorVersion: GENERATOR_VERSION,
    },
    ...(payload as Record<string, unknown>),
  };
  const goldenText = canonicalStringify(goldenObject);
  // Privacy guard re-runs on the golden text.
  runPrivacyGuard(`${id} (golden)`, goldenText);
  const result = writeIfChanged(goldenPath, goldenText, mode);
  return { id, changed: result.changed };
};

const parseArgs = (argv: string[]): GeneratorMode => {
  if (argv.includes('--list')) return 'list';
  if (argv.includes('--check')) return 'check';
  return 'write';
};

const main = async (argv: string[]): Promise<number> => {
  const mode = parseArgs(argv);
  if (mode === 'list') {
    for (const id of FIXTURE_IDS) {
      // eslint-disable-next-line no-console
      console.log(id);
    }
    return 0;
  }
  const sourceCommit = sourceCommitShort();
  const summary: Array<{ id: FixtureId; changed: boolean }> = [];
  for (const id of FIXTURE_IDS) {
    summary.push(await runFixture(id, mode, sourceCommit));
  }
  const changedCount = summary.filter((s) => s.changed).length;
  // eslint-disable-next-line no-console
  console.log(
    `${mode === 'check' ? 'checked' : 'generated'} ${summary.length} fixture(s); ${changedCount} changed`,
  );
  for (const s of summary) {
    // eslint-disable-next-line no-console
    console.log(`  ${s.changed ? '*' : ' '} ${s.id}`);
  }
  if (mode === 'check' && changedCount > 0) {
    // eslint-disable-next-line no-console
    console.error(
      `parityGoldensEntry: --check failed; ${changedCount} fixture(s) drifted. ` +
        `Run \`node scripts/generate-parity-goldens.mjs\` and commit the diff.`,
    );
    return 1;
  }
  return 0;
};

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });

// readdirSync is unused at runtime but kept imported so future fixture
// discovery diff stays minimal; reference it once to satisfy strict TS.
void readdirSync;
