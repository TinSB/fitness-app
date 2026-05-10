import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { buildReadMirrorHistoryDetail, buildReadMirrorHistoryList } from '../../apps/api/src/readMirror';
import type { AppData, TrainingSetLog } from '../models/training-model';
import {
  sanitizeHistorySetEditMessage,
  updateHistorySetEditViaDevApi,
  validateHistorySetEditPatch,
  type DevApiHistorySetEditError,
  type DevApiHistorySetEditFetch,
  type DevApiHistorySetEditMetadata,
  type DevApiHistorySetEditResult,
  type DevApiHistorySetEditSnapshot,
  type HistorySetEditPatch,
  type HistorySetEditPatchField,
} from './devApiHistorySetEditClient';
import {
  resolveDevApiHistorySetEditConfig,
  type DevApiHistorySetEditConfig,
} from './devApiHistorySetEditConfig';

type ExperimentStatus = 'idle' | 'blocked' | 'pending' | 'success' | 'failure' | 'misconfigured';
export type HistorySetEditDiagnosticState = 'idle' | 'confirming' | 'pending' | 'success' | 'failure';

export type HistorySetEditSetSnapshot = {
  id: string;
  label: string;
  type: string;
  weightKg: number;
  displayWeight?: number;
  displayUnit?: string;
  reps: number;
  rir?: number | string;
  techniqueQuality?: string;
  painFlag: boolean;
  note: string;
};

export type HistorySetEditExerciseOption = {
  id: string;
  name: string;
  movementPattern: string;
  primaryMuscle: string;
  prescriptionSummary: string;
  sets: HistorySetEditSetSnapshot[];
};

export type HistorySetEditSourceContext = {
  sessionId: string;
  calendarDate: string;
  exerciseId: string;
  setId: string;
  sessionOptions: Array<{ id: string; calendarDate: string }>;
  exerciseOptions: HistorySetEditExerciseOption[];
  selectedExercise: HistorySetEditExerciseOption;
  selectedSet: HistorySetEditSetSnapshot;
  patch: HistorySetEditPatch;
  beforeValues: HistorySetEditSetSnapshot;
  afterValues: HistorySetEditSetSnapshot;
  changedFields: HistorySetEditPatchField[];
  sourceFingerprint: string;
};

export type HistorySetEditPrototypeState = {
  status: ExperimentStatus;
  sessionId?: string;
  exerciseId?: string;
  setId?: string;
  message?: string;
  error?: DevApiHistorySetEditError;
  snapshot?: DevApiHistorySetEditSnapshot;
  metadata?: DevApiHistorySetEditMetadata;
  startedAt?: string;
  finishedAt?: string;
  lastAttemptStatus?: number;
  duplicateSubmitBlocked?: boolean;
};

export type HistorySetEditDiagnosticSummary = {
  targetReference?: string;
  state: HistorySetEditDiagnosticState;
  lastAttemptStatus?: number;
  failureCode?: string;
  failureMessage?: string;
  snapshotMetadataPresent: boolean;
  startedAt?: string;
  finishedAt?: string;
  duplicateSubmitBlocked: boolean;
  recoveryNote?: string;
};

type PatchDraft = {
  weightKg: string;
  displayWeight: string;
  displayUnit: '' | 'kg' | 'lb';
  reps: string;
  rir: string;
  techniqueQuality: '' | 'good' | 'acceptable' | 'poor';
  painFlag: boolean;
  note: string;
};

type DevApiHistorySetEditExperimentProps = {
  data: AppData;
  config?: DevApiHistorySetEditConfig;
  fetchImpl?: DevApiHistorySetEditFetch;
  now?: () => string;
};

const runtimeConfig = resolveDevApiHistorySetEditConfig(import.meta.env);

const sortForStableComparison = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortForStableComparison);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = sortForStableComparison((value as Record<string, unknown>)[key]);
      return acc;
    }, {});
};

const stableStringify = (value: unknown) => JSON.stringify(sortForStableComparison(value));

const hashString = (value: string) => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

const numberValue = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const setWeightKg = (set: TrainingSetLog) => numberValue(set.actualWeightKg ?? set.weight);

const formatValue = (value: unknown) => {
  if (value === undefined || value === null || value === '') return 'blank';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
};

const formatSetValues = (set: HistorySetEditSetSnapshot) =>
  [
    `weightKg ${formatValue(set.weightKg)}`,
    `display ${formatValue(set.displayWeight)} ${formatValue(set.displayUnit)}`,
    `reps ${formatValue(set.reps)}`,
    `RIR ${formatValue(set.rir)}`,
    `technique ${formatValue(set.techniqueQuality)}`,
    `pain ${formatValue(set.painFlag)}`,
    `note ${formatValue(set.note)}`,
  ].join(' / ');

const normalizeSetSnapshot = (set: TrainingSetLog, index: number): HistorySetEditSetSnapshot => ({
  id: String(set.id || index + 1),
  label: `${String(set.type || 'set')} ${index + 1}`,
  type: String(set.type || 'working'),
  weightKg: setWeightKg(set),
  displayWeight: typeof set.displayWeight === 'number' ? set.displayWeight : undefined,
  displayUnit: set.displayUnit,
  reps: numberValue(set.reps),
  rir: set.rir,
  techniqueQuality: set.techniqueQuality,
  painFlag: Boolean(set.painFlag),
  note: String(set.note || ''),
});

const exerciseIdentity = (exercise: AppData['history'][number]['exercises'][number]) =>
  String(exercise.id || exercise.actualExerciseId || exercise.baseId || exercise.name || '').trim();

const exerciseOption = (exercise: AppData['history'][number]['exercises'][number]): HistorySetEditExerciseOption | null => {
  const sets = Array.isArray(exercise.sets) ? exercise.sets.map(normalizeSetSnapshot) : [];
  const id = exerciseIdentity(exercise);
  if (!id || !sets.length) return null;
  return {
    id,
    name: exercise.name || exercise.originalName || id,
    movementPattern: exercise.movementPattern || exercise.kind || 'unlabeled pattern',
    primaryMuscle: exercise.primaryMuscles?.[0] || exercise.muscle || 'unlabeled muscle',
    prescriptionSummary: exercise.prescription
      ? `${exercise.prescription.sets} sets x ${exercise.prescription.repRange[0]}-${exercise.prescription.repRange[1]} reps`
      : `${sets.length} recorded sets`,
    sets,
  };
};

export const createDefaultHistorySetEditPatchDraft = (set?: HistorySetEditSetSnapshot): PatchDraft => ({
  weightKg: '',
  displayWeight: '',
  displayUnit: '',
  reps: '',
  rir: '',
  techniqueQuality: '',
  painFlag: Boolean(set?.painFlag),
  note: set?.note ? `${set.note} dev check` : 'dev set edit check',
});

export const patchDraftToPatch = (draft: PatchDraft): HistorySetEditPatch => {
  const patch: HistorySetEditPatch = {};
  if (draft.weightKg.trim()) patch.weightKg = Number(draft.weightKg);
  if (draft.displayWeight.trim()) patch.displayWeight = Number(draft.displayWeight);
  if (draft.displayUnit) patch.displayUnit = draft.displayUnit;
  if (draft.reps.trim()) patch.reps = Number(draft.reps);
  if (draft.rir.trim()) patch.rir = draft.rir.trim();
  if (draft.techniqueQuality) patch.techniqueQuality = draft.techniqueQuality;
  if (draft.painFlag) patch.painFlag = draft.painFlag;
  if (draft.note.trim()) patch.note = draft.note;
  return patch;
};

const applyPreviewPatch = (
  beforeValues: HistorySetEditSetSnapshot,
  patch: HistorySetEditPatch,
): HistorySetEditSetSnapshot => ({
  ...beforeValues,
  ...(patch.weightKg !== undefined ? { weightKg: patch.weightKg } : {}),
  ...(patch.displayWeight !== undefined ? { displayWeight: patch.displayWeight } : {}),
  ...(patch.displayUnit !== undefined ? { displayUnit: patch.displayUnit } : {}),
  ...(patch.reps !== undefined ? { reps: patch.reps } : {}),
  ...(patch.rir !== undefined ? { rir: patch.rir } : {}),
  ...(patch.techniqueQuality !== undefined ? { techniqueQuality: patch.techniqueQuality } : {}),
  ...(patch.painFlag !== undefined ? { painFlag: patch.painFlag } : {}),
  ...(patch.note !== undefined ? { note: patch.note } : {}),
});

const comparable = (value: unknown) => (value === undefined || value === null ? '' : String(value).trim());

const changedPatchFields = (
  beforeValues: HistorySetEditSetSnapshot,
  afterValues: HistorySetEditSetSnapshot,
  patchFields: HistorySetEditPatchField[],
) =>
  patchFields.filter((field) => {
    if (field === 'weightKg' || field === 'displayWeight' || field === 'reps') {
      return numberValue(beforeValues[field]) !== numberValue(afterValues[field]);
    }
    if (field === 'painFlag') return beforeValues.painFlag !== afterValues.painFlag;
    return comparable(beforeValues[field]) !== comparable(afterValues[field]);
  });

export const formatHistorySetEditTargetReference = (sessionId?: string, exerciseId?: string, setId?: string) =>
  sessionId && exerciseId && setId
    ? `set-${hashString(`${sessionId}:${exerciseId}:${setId}`)}`
    : 'unavailable';

export const createHistorySetEditSourceContext = (
  data: AppData,
  sessionId?: string,
  exerciseId?: string,
  setId?: string,
  patchDraft: PatchDraft = createDefaultHistorySetEditPatchDraft(),
): HistorySetEditSourceContext | null => {
  const sessionOptions = buildReadMirrorHistoryList(data).sessions
    .filter((session) => session.id.trim())
    .map((session) => ({ id: session.id, calendarDate: session.calendarDate }));
  if (!sessionOptions.length) return null;

  const selectedSession = sessionId
    ? sessionOptions.find((session) => session.id === sessionId) || sessionOptions[0]
    : sessionOptions[0];
  const detail = buildReadMirrorHistoryDetail(data, selectedSession.id);
  if (!detail) return null;

  const exerciseOptions = (detail.session.exercises || []).map(exerciseOption).filter(Boolean) as HistorySetEditExerciseOption[];
  if (!exerciseOptions.length) return null;
  const selectedExercise = exerciseId
    ? exerciseOptions.find((exercise) => exercise.id === exerciseId) || exerciseOptions[0]
    : exerciseOptions[0];
  const selectedSet = setId
    ? selectedExercise.sets.find((set) => set.id === setId) || selectedExercise.sets[0]
    : selectedExercise.sets[0];
  if (!selectedSet) return null;

  const validation = validateHistorySetEditPatch(patchDraftToPatch(patchDraft));
  if (!validation.ok) return null;
  const afterValues = applyPreviewPatch(selectedSet, validation.patch);
  const changedFields = changedPatchFields(selectedSet, afterValues, validation.fields);
  const source = {
    route: ['history', ':id', 'edit'],
    selectedSessionId: selectedSession.id,
    exerciseId: selectedExercise.id,
    setId: selectedSet.id,
    beforeValues: selectedSet,
    afterValues,
    changedFields,
    historyIds: sessionOptions.map((session) => session.id).sort(),
  };

  return {
    sessionId: selectedSession.id,
    calendarDate: detail.calendarDate,
    exerciseId: selectedExercise.id,
    setId: selectedSet.id,
    sessionOptions,
    exerciseOptions,
    selectedExercise,
    selectedSet,
    patch: validation.patch,
    beforeValues: selectedSet,
    afterValues,
    changedFields,
    sourceFingerprint: `history-set-edit-${hashString(stableStringify(source))}`,
  };
};

export const createHistorySetEditMetadata = ({
  sessionId,
  exerciseId,
  setId,
  changedFields,
  sourceFingerprint,
  nowIso,
  reason,
}: {
  sessionId: string;
  exerciseId: string;
  setId: string;
  changedFields: HistorySetEditPatchField[];
  sourceFingerprint: string;
  nowIso: string;
  reason?: string;
}): DevApiHistorySetEditMetadata => {
  const requestFingerprint = `request-${hashString(stableStringify({ sessionId, exerciseId, setId, changedFields, sourceFingerprint }))}`;
  const mutationId = `history-set-edit-${hashString(`${sessionId}:${exerciseId}:${setId}:${sourceFingerprint}:${nowIso}`)}`;
  return {
    sessionId,
    exerciseId,
    setId,
    changedFields,
    mutationId,
    idempotencyKey: `${mutationId}:${requestFingerprint}`,
    requestFingerprint,
    sourceFingerprint,
    confirmed: true,
    reason,
    nowIso,
  };
};

export const canSubmitHistorySetEditPrototype = ({
  config,
  sourceContext,
  confirmed,
  pending,
}: {
  config: DevApiHistorySetEditConfig;
  sourceContext: HistorySetEditSourceContext | null;
  confirmed: boolean;
  pending: boolean;
}) =>
  config.enabled
  && Boolean(sourceContext?.sessionId)
  && Boolean(sourceContext?.exerciseId)
  && Boolean(sourceContext?.setId)
  && Boolean(sourceContext?.sourceFingerprint)
  && Boolean(sourceContext?.changedFields.length)
  && confirmed
  && !pending;

export const createHistorySetEditSubmitLock = () => {
  let locked = false;
  return {
    acquire: () => {
      if (locked) return false;
      locked = true;
      return true;
    },
    release: () => {
      locked = false;
    },
    isLocked: () => locked,
  };
};

const safeErrorMessage = (error?: DevApiHistorySetEditError) => {
  if (!error) return 'History set edit experiment failed.';
  return `${error.serverCode || error.code}: ${sanitizeHistorySetEditMessage(error.message)}`.replace(/\s+/g, ' ').slice(0, 180);
};

export const getHistorySetEditRecoveryNote = (error?: DevApiHistorySetEditError) => {
  const code = error?.serverCode || error?.code;
  switch (code) {
    case 'dev_mutation_fetch_unavailable':
      return 'Fetch is unavailable in this browser. The App remains local-only.';
    case 'dev_mutation_unavailable':
      return 'Confirm the Dev API runner is running and the base URL is localhost.';
    case 'dev_mutation_timeout':
      return 'Confirm the Dev API is responsive, then retry only after explicit confirmation.';
    case 'dev_mutation_invalid_response':
      return 'Inspect Dev API logs and response shape before trusting persistence.';
    case 'dev_mutation_missing_snapshot':
      return 'Treat this as failed persistence because snapshot metadata was missing.';
    case 'dev_mutation_aborted':
      return 'The request was canceled or the component unmounted. No local data was changed.';
    case 'dev_mutation_invalid_patch':
    case 'record_edit_invalid':
      return 'Use only the constrained set fields before trying again.';
    case 'record_not_found':
      return 'Refresh read-only diagnostics or verify the history record still exists before retrying.';
    case 'record_no_change':
      return 'The target may already match the patch. Rerun read-only diagnostics before retrying.';
    case 'write_failed':
    case 'transaction_failed':
      return 'Stop the Dev API runner, make a dev DB copy, and inspect the dev DB before retrying.';
    case 'database_closed':
      return 'Restart the Dev API runner, then rerun read-only diagnostics before retrying.';
    case 'snapshot_validation_failed':
    case 'repository_schema_mismatch':
      return 'Stop the Dev API runner, make a dev DB copy, and inspect schema notes before retrying.';
    case 'unsupported_route':
      return 'Verify only the approved history set edit route is enabled for this experiment.';
    case 'dev_mutation_source_fingerprint_missing':
      return 'Rebuild read-only diagnostics first so the request has source context.';
    default:
      return 'Check Dev API logs and rerun read-only diagnostics before retrying.';
  }
};

export const createHistorySetEditDiagnosticSummary = ({
  state,
  sourceContext,
  confirmed,
}: {
  state: HistorySetEditPrototypeState;
  sourceContext: HistorySetEditSourceContext | null;
  confirmed: boolean;
}): HistorySetEditDiagnosticSummary => {
  const sessionId = state.sessionId || sourceContext?.sessionId;
  const exerciseId = state.exerciseId || sourceContext?.exerciseId;
  const setId = state.setId || sourceContext?.setId;
  const failureCode = state.error ? state.error.serverCode || state.error.code : undefined;
  const diagnosticState: HistorySetEditDiagnosticState =
    state.status === 'pending'
      ? 'pending'
      : state.status === 'success'
        ? 'success'
        : state.status === 'failure' || state.status === 'blocked' || state.status === 'misconfigured'
          ? 'failure'
          : confirmed && Boolean(sourceContext?.sessionId)
            ? 'confirming'
            : 'idle';

  return {
    targetReference: formatHistorySetEditTargetReference(sessionId, exerciseId, setId),
    state: diagnosticState,
    lastAttemptStatus: state.lastAttemptStatus,
    failureCode,
    failureMessage: state.error ? safeErrorMessage(state.error) : undefined,
    snapshotMetadataPresent: Boolean(state.snapshot?.snapshotId && state.snapshot.createdAt),
    startedAt: state.startedAt,
    finishedAt: state.finishedAt,
    duplicateSubmitBlocked: Boolean(state.duplicateSubmitBlocked),
    recoveryNote: state.error ? getHistorySetEditRecoveryNote(state.error) : undefined,
  };
};

export const DevApiHistorySetEditExperimentPanel = ({
  config,
  sourceContext,
  patchDraft,
  confirmed,
  state,
  pending,
  onSessionChange,
  onExerciseChange,
  onSetChange,
  onPatchDraftChange,
  onConfirmedChange,
  onCancel,
  onSubmit,
}: {
  config: DevApiHistorySetEditConfig;
  sourceContext: HistorySetEditSourceContext | null;
  patchDraft: PatchDraft;
  confirmed: boolean;
  state: HistorySetEditPrototypeState;
  pending: boolean;
  onSessionChange?: (sessionId: string) => void;
  onExerciseChange?: (exerciseId: string) => void;
  onSetChange?: (setId: string) => void;
  onPatchDraftChange?: (draft: PatchDraft) => void;
  onConfirmedChange?: (confirmed: boolean) => void;
  onCancel?: () => void;
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
}) => {
  if (config.status === 'disabled') return null;

  const canSubmit = canSubmitHistorySetEditPrototype({
    config,
    sourceContext,
    confirmed,
    pending,
  });
  const statusLabel =
    state.status === 'pending'
      ? 'Pending'
      : state.status === 'success'
        ? 'Success'
        : state.status === 'failure'
          ? 'Failure'
          : state.status === 'misconfigured'
            ? 'Misconfigured'
            : state.status === 'blocked'
              ? 'Blocked'
              : 'Ready';
  const diagnostic = createHistorySetEditDiagnosticSummary({ state, sourceContext, confirmed });

  return (
    <section
      aria-label="Dev API history set edit experiment"
      aria-live="polite"
      className="fixed bottom-3 left-3 z-[88] max-h-[45vh] w-[min(24rem,calc(100vw-1.5rem))] overflow-auto rounded-lg border border-amber-300 bg-amber-50/95 p-3 text-xs text-slate-800 shadow-lg lg:bottom-3"
      role="status"
    >
      <div className="text-sm font-semibold text-slate-950">Dev API history set edit experiment</div>
      <p className="mt-2 text-slate-700">
        Dev-only mutation experiment. localStorage remains source of truth. No data is changed locally.
      </p>

      {config.status === 'invalid' ? (
        <p className="mt-2 font-medium text-rose-700">
          Config is invalid. Use a localhost Dev API base URL. No request was sent.
        </p>
      ) : null}

      {config.enabled && !sourceContext ? (
        <p className="mt-2 font-medium text-slate-700">
          No stable history session, exercise, and set target is available. No request was sent.
        </p>
      ) : null}

      {sourceContext ? (
        <form className="mt-3 space-y-2" onSubmit={onSubmit}>
          <label className="block">
            <span className="font-medium">Target session</span>
            <select
              aria-label="Target session"
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1"
              disabled={pending}
              onChange={(event) => onSessionChange?.(event.target.value)}
              value={sourceContext.sessionId}
            >
              {sourceContext.sessionOptions.map((session, index) => (
                <option key={session.id} value={session.id}>
                  {`Session ${index + 1} - ${session.calendarDate}`}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="font-medium">Target exercise</span>
            <select
              aria-label="Target exercise"
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1"
              disabled={pending}
              onChange={(event) => onExerciseChange?.(event.target.value)}
              value={sourceContext.exerciseId}
            >
              {sourceContext.exerciseOptions.map((exercise) => (
                <option key={exercise.id} value={exercise.id}>
                  {exercise.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="font-medium">Target set</span>
            <select
              aria-label="Target set"
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1"
              disabled={pending}
              onChange={(event) => onSetChange?.(event.target.value)}
              value={sourceContext.setId}
            >
              {sourceContext.selectedExercise.sets.map((set) => (
                <option key={set.id} value={set.id}>
                  {set.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="font-medium">Patch note</span>
            <input
              aria-label="Patch note"
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1"
              disabled={pending}
              maxLength={240}
              onChange={(event) => {
                onPatchDraftChange?.({ ...patchDraft, note: event.target.value });
                onConfirmedChange?.(false);
              }}
              value={patchDraft.note}
            />
          </label>

          <p className="text-slate-700">
            Movement: {sourceContext.selectedExercise.movementPattern}. Primary muscle: {sourceContext.selectedExercise.primaryMuscle}.
            Prescription: {sourceContext.selectedExercise.prescriptionSummary}. Set type: {sourceContext.selectedSet.type}.
          </p>
          <p className="text-slate-700">Before values: {formatSetValues(sourceContext.beforeValues)}</p>
          <p className="text-slate-700">After values: {formatSetValues(sourceContext.afterValues)}</p>
          <p className="font-medium text-slate-800">Changed fields: {sourceContext.changedFields.join(', ') || 'none'}</p>
          <p className="text-slate-700">
            Calculation impact warning: weightKg and reps can affect volume, PR, e1RM, and effective sets. Display weight
            and display unit are display-only unless weightKg is also changed.
          </p>

          <label className="flex items-start gap-2">
            <input
              checked={confirmed}
              className="mt-0.5"
              disabled={pending}
              onChange={(event) => onConfirmedChange?.(event.target.checked)}
              type="checkbox"
            />
            <span>I confirm this one-route dev request for the selected existing set.</span>
          </label>

          <div className="flex gap-2">
            <button
              className="rounded-md border border-amber-500 bg-white px-2 py-1 font-medium text-slate-900 disabled:opacity-60"
              disabled={!canSubmit}
              type="submit"
            >
              {pending ? 'Pending' : 'Send set edit request'}
            </button>
            <button
              className="rounded-md border border-slate-300 bg-white px-2 py-1 font-medium text-slate-700 disabled:opacity-60"
              disabled={pending}
              onClick={onCancel}
              type="button"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
        <dt className="font-medium">Status</dt>
        <dd>{statusLabel}</dd>
        <dt className="font-medium">Mutation state</dt>
        <dd>{diagnostic.state}</dd>
        <dt className="font-medium">Target</dt>
        <dd>{diagnostic.targetReference}</dd>
        <dt className="font-medium">Source</dt>
        <dd>{sourceContext?.sourceFingerprint || 'unavailable'}</dd>
        <dt className="font-medium">Snapshot metadata</dt>
        <dd>{diagnostic.snapshotMetadataPresent ? 'present' : 'absent'}</dd>
        {typeof diagnostic.lastAttemptStatus === 'number' ? (
          <>
            <dt className="font-medium">HTTP status</dt>
            <dd>{diagnostic.lastAttemptStatus}</dd>
          </>
        ) : null}
        {diagnostic.failureCode ? (
          <>
            <dt className="font-medium">Failure code</dt>
            <dd>{diagnostic.failureCode}</dd>
          </>
        ) : null}
        <dt className="font-medium">Duplicate attempt</dt>
        <dd>{diagnostic.duplicateSubmitBlocked ? 'blocked' : 'none'}</dd>
      </dl>

      {state.status === 'success' ? (
        <p className="mt-2 font-medium text-emerald-700">
          Snapshot recorded: {state.snapshot?.snapshotId}. No data was changed locally. Rerun read-only comparison manually.
        </p>
      ) : null}

      {state.status === 'failure' || state.status === 'blocked' || state.status === 'misconfigured' ? (
        <>
          <p className="mt-2 font-medium text-rose-700">{state.message || safeErrorMessage(state.error)}</p>
          {diagnostic.recoveryNote ? (
            <p className="mt-1 text-slate-700">Safe recovery note: {diagnostic.recoveryNote}</p>
          ) : null}
        </>
      ) : null}
    </section>
  );
};

export const DevApiHistorySetEditExperiment = ({
  data,
  config = runtimeConfig,
  fetchImpl,
  now = () => new Date().toISOString(),
}: DevApiHistorySetEditExperimentProps) => {
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [selectedExerciseId, setSelectedExerciseId] = useState('');
  const [selectedSetId, setSelectedSetId] = useState('');
  const [patchDraft, setPatchDraft] = useState<PatchDraft>(() => createDefaultHistorySetEditPatchDraft());
  const [confirmed, setConfirmed] = useState(false);
  const [state, setState] = useState<HistorySetEditPrototypeState>(() => {
    if (config.status === 'invalid') {
      return {
        status: 'misconfigured',
        message: 'Config is invalid. Use a localhost Dev API base URL. No request was sent.',
      };
    }
    return { status: 'idle' };
  });
  const controllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const submitLockRef = useRef(createHistorySetEditSubmitLock());

  const sourceContext = useMemo(
    () => (config.enabled
      ? createHistorySetEditSourceContext(
        data,
        selectedSessionId || undefined,
        selectedExerciseId || undefined,
        selectedSetId || undefined,
        patchDraft,
      )
      : null),
    [config, data, selectedSessionId, selectedExerciseId, selectedSetId, patchDraft],
  );

  useEffect(() => {
    if (!sourceContext) return;
    const needsDefaultTarget =
      !selectedSessionId
      || sourceContext.sessionId !== selectedSessionId
      || !selectedExerciseId
      || sourceContext.exerciseId !== selectedExerciseId
      || !selectedSetId
      || sourceContext.setId !== selectedSetId;
    if (needsDefaultTarget) {
      setSelectedSessionId(sourceContext.sessionId);
      setSelectedExerciseId(sourceContext.exerciseId);
      setSelectedSetId(sourceContext.setId);
      setPatchDraft(createDefaultHistorySetEditPatchDraft(sourceContext.selectedSet));
      setConfirmed(false);
    }
  }, [selectedExerciseId, selectedSessionId, selectedSetId, sourceContext]);

  useEffect(() => () => {
    mountedRef.current = false;
    submitLockRef.current.release();
    controllerRef.current?.abort();
  }, []);

  useEffect(() => {
    if (config.status === 'invalid') {
      submitLockRef.current.release();
      controllerRef.current?.abort();
      setConfirmed(false);
      setState({
        status: 'misconfigured',
        message: 'Config is invalid. Use a localhost Dev API base URL. No request was sent.',
      });
      return;
    }
    if (!config.enabled) {
      submitLockRef.current.release();
      controllerRef.current?.abort();
      setConfirmed(false);
      setState({ status: 'idle' });
    }
  }, [config]);

  if (config.status === 'disabled') return null;

  const changeSession = (sessionId: string) => {
    const nextContext = createHistorySetEditSourceContext(data, sessionId);
    setSelectedSessionId(sessionId);
    setSelectedExerciseId(nextContext?.exerciseId || '');
    setSelectedSetId(nextContext?.setId || '');
    setPatchDraft(createDefaultHistorySetEditPatchDraft(nextContext?.selectedSet));
    setConfirmed(false);
    if (state.status !== 'pending') setState({ status: 'idle', sessionId });
  };

  const changeExercise = (exerciseId: string) => {
    const nextContext = createHistorySetEditSourceContext(data, selectedSessionId, exerciseId);
    setSelectedExerciseId(exerciseId);
    setSelectedSetId(nextContext?.setId || '');
    setPatchDraft(createDefaultHistorySetEditPatchDraft(nextContext?.selectedSet));
    setConfirmed(false);
    if (state.status !== 'pending') setState({ status: 'idle', sessionId: selectedSessionId, exerciseId });
  };

  const changeSet = (setId: string) => {
    const nextContext = createHistorySetEditSourceContext(data, selectedSessionId, selectedExerciseId, setId);
    setSelectedSetId(setId);
    setPatchDraft(createDefaultHistorySetEditPatchDraft(nextContext?.selectedSet));
    setConfirmed(false);
    if (state.status !== 'pending') setState({ status: 'idle', sessionId: selectedSessionId, exerciseId: selectedExerciseId, setId });
  };

  const changePatchDraft = (draft: PatchDraft) => {
    setPatchDraft(draft);
    setConfirmed(false);
    if (state.status !== 'pending') setState({ status: 'idle', sessionId: selectedSessionId, exerciseId: selectedExerciseId, setId: selectedSetId });
  };

  const cancel = () => {
    setConfirmed(false);
    if (state.status !== 'pending') setState({ status: 'idle', sessionId: selectedSessionId, exerciseId: selectedExerciseId, setId: selectedSetId });
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!config.enabled) return;
    if (!sourceContext?.sourceFingerprint) {
      setState({
        status: 'blocked',
        sessionId: selectedSessionId,
        exerciseId: selectedExerciseId,
        setId: selectedSetId,
        error: {
          code: 'dev_mutation_source_fingerprint_missing',
          message: 'History set edit source fingerprint is missing.',
        },
      });
      return;
    }
    if (!sourceContext.changedFields.length) {
      setState({
        status: 'blocked',
        sessionId: sourceContext.sessionId,
        exerciseId: sourceContext.exerciseId,
        setId: sourceContext.setId,
        error: {
          code: 'dev_mutation_invalid_patch',
          message: 'History set edit patch has no changed fields.',
        },
      });
      setConfirmed(false);
      return;
    }
    if (!confirmed || state.status === 'pending') return;
    if (!submitLockRef.current.acquire()) {
      setState((current) => current.status === 'pending'
        ? { ...current, duplicateSubmitBlocked: true }
        : current);
      return;
    }

    const startedAt = now();
    const metadata = createHistorySetEditMetadata({
      sessionId: sourceContext.sessionId,
      exerciseId: sourceContext.exerciseId,
      setId: sourceContext.setId,
      changedFields: sourceContext.changedFields,
      sourceFingerprint: sourceContext.sourceFingerprint,
      nowIso: startedAt,
      reason: 'dev-only history set edit experiment',
    });

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState({
      status: 'pending',
      sessionId: sourceContext.sessionId,
      exerciseId: sourceContext.exerciseId,
      setId: sourceContext.setId,
      metadata,
      startedAt,
      duplicateSubmitBlocked: false,
    });

    const result: DevApiHistorySetEditResult = await updateHistorySetEditViaDevApi({
      sessionId: sourceContext.sessionId,
      exerciseId: sourceContext.exerciseId,
      setId: sourceContext.setId,
      patch: sourceContext.patch,
      reason: metadata.reason,
      config,
      metadata,
      fetchImpl,
      signal: controller.signal,
    });

    if (controller.signal.aborted || !mountedRef.current) {
      submitLockRef.current.release();
      return;
    }

    if (result.ok) {
      submitLockRef.current.release();
      setState({
        status: 'success',
        sessionId: result.sessionId,
        exerciseId: result.exerciseId,
        setId: result.setId,
        snapshot: result.snapshot,
        metadata: result.metadata,
        startedAt,
        finishedAt: now(),
        lastAttemptStatus: result.status,
        message: 'Snapshot metadata was returned. No data was changed locally.',
      });
      setConfirmed(false);
      return;
    }

    submitLockRef.current.release();
    setState({
      status: 'failure',
      sessionId: result.sessionId,
      exerciseId: result.exerciseId || sourceContext.exerciseId,
      setId: result.setId || sourceContext.setId,
      error: result.error,
      metadata: result.metadata,
      startedAt,
      finishedAt: now(),
      lastAttemptStatus: result.status,
      message: safeErrorMessage(result.error),
    });
    setConfirmed(false);
  };

  return (
    <DevApiHistorySetEditExperimentPanel
      config={config}
      confirmed={confirmed}
      onCancel={cancel}
      onConfirmedChange={setConfirmed}
      onExerciseChange={changeExercise}
      onPatchDraftChange={changePatchDraft}
      onSessionChange={changeSession}
      onSetChange={changeSet}
      onSubmit={submit}
      patchDraft={patchDraft}
      pending={state.status === 'pending'}
      sourceContext={sourceContext}
      state={state}
    />
  );
};
