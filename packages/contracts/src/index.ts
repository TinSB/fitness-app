import type { AppData as ContractAppData } from '../../../src/models/training-model';

export type {
  AppData,
  ExercisePrescription as TrainingExercise,
  PendingSessionPatch,
  ProgramAdjustmentDraft,
  ProgramTemplate,
  SessionPatch,
  SessionEditHistoryItem as SessionEditHistoryEntry,
  TrainingSession,
  TrainingSetLog as TrainingSet,
} from '../../../src/models/training-model';
export type { DataHealthIssue, DataHealthReport } from '../../../src/engines/dataHealthEngine';
export type { FocusActionReasonCode, FocusActionResult } from '../../../src/engines/workoutExecutionStateMachine';

export { STORAGE_VERSION as APP_DATA_SCHEMA_VERSION } from '../../../src/data/appConfig';
export { default as appDataJsonSchema } from '../../../src/models/training-data.schema.json';

export type SessionMutationReasonCode =
  | 'session_started'
  | 'active_session_exists'
  | 'template_not_found'
  | 'no_active_session'
  | 'session_patches_applied'
  | 'pending_patch_not_found'
  | 'no_change'
  | 'incomplete_main_work_requires_confirmation'
  | 'session_completed'
  | 'discard_requires_confirmation'
  | 'session_discarded'
  | 'unsupported_route';

export type SessionMutationStatus =
  | 'success'
  | 'no_change'
  | 'conflict'
  | 'not_found'
  | 'requires_confirmation'
  | 'unsupported'
  | 'invalid';

export type SessionMutationRequest = {
  method: string;
  path: string;
  body?: unknown;
  nowIso?: string;
};

export type SessionMutationResult = {
  ok: boolean;
  changed: boolean;
  status: SessionMutationStatus;
  reasonCode: SessionMutationReasonCode;
  message: string;
  warnings?: string[];
  requiresConfirmation?: boolean;
};

export type SessionMutationResponse = {
  status: number;
  result: SessionMutationResult;
  nextData?: ContractAppData;
};
