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

export type RecordDataHealthMutationReasonCode =
  | 'record_updated'
  | 'record_not_found'
  | 'record_no_change'
  | 'record_edit_invalid'
  | 'record_edit_requires_confirmation'
  | 'data_health_issue_dismissed'
  | 'data_health_issue_not_found'
  | 'data_health_no_change'
  | 'data_health_repair_requires_confirmation'
  | 'data_health_repair_applied'
  | 'data_health_repair_not_supported'
  | 'unsafe_import_rejected'
  | 'backup_import_requires_review'
  | 'unsupported_route';

export type RecordDataHealthMutationStatus =
  | 'success'
  | 'no_change'
  | 'not_found'
  | 'requires_confirmation'
  | 'unsupported'
  | 'invalid'
  | 'unsafe'
  | 'needs_review';

export type RecordDataHealthMutationRequest = {
  method: string;
  path: string;
  body?: unknown;
  nowIso?: string;
};

export type RecordDataHealthMutationResult = {
  ok: boolean;
  changed: boolean;
  status: RecordDataHealthMutationStatus;
  reasonCode: RecordDataHealthMutationReasonCode;
  message: string;
  warnings?: string[];
  requiresConfirmation?: boolean;
};

export type RecordDataHealthMutationResponse = {
  status: number;
  result: RecordDataHealthMutationResult;
  nextData?: ContractAppData;
};
