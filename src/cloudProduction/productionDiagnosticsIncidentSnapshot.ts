export type DiagnosticEnvironment =
  | 'local'
  | 'dev'
  | 'preview'
  | 'production-candidate'
  | 'production'
  | 'emergency-local';

export type DiagnosticCandidateStatus =
  | 'disabled'
  | 'unavailable'
  | 'candidate'
  | 'ready'
  | 'failed'
  | 'unknown';

export type ProductionDiagnosticsIncidentSnapshotInput = {
  environment: DiagnosticEnvironment;
  releaseChannel: DiagnosticEnvironment;
  runtimeSourceState: 'localStorage-primary' | 'backend-candidate' | 'cloud-candidate' | 'emergency-local';
  backendPrimaryCandidateStatus?: DiagnosticCandidateStatus;
  supabaseAdapterStatus?: DiagnosticCandidateStatus;
  lastCloudPullStatus?: DiagnosticCandidateStatus;
  lastCloudPushStatus?: DiagnosticCandidateStatus;
  lastConflictStatus?: 'none' | 'manual_required' | 'unresolved' | 'resolved_candidate' | 'unknown';
  rollbackAvailable?: boolean;
  emergencyLocalModeAvailable?: boolean;
  errorCodes?: string[];
  buildMetadata?: {
    version?: string;
    commit?: string;
    builtAt?: string;
  };
  unsafeDetails?: Record<string, unknown>;
};

export type ProductionDiagnosticsIncidentSnapshot = {
  kind: 'production-diagnostics-incident-snapshot';
  environment: DiagnosticEnvironment;
  releaseChannel: DiagnosticEnvironment;
  runtimeSourceState: ProductionDiagnosticsIncidentSnapshotInput['runtimeSourceState'];
  backendPrimaryCandidateStatus: DiagnosticCandidateStatus;
  supabaseAdapterStatus: DiagnosticCandidateStatus;
  lastCloudPullStatus: DiagnosticCandidateStatus;
  lastCloudPushStatus: DiagnosticCandidateStatus;
  lastConflictStatus: 'none' | 'manual_required' | 'unresolved' | 'resolved_candidate' | 'unknown';
  rollbackAvailable: boolean;
  emergencyLocalModeAvailable: boolean;
  redactedErrorCodes: string[];
  buildMetadata: {
    version: string | null;
    commit: string | null;
    builtAt: string | null;
  };
  droppedUnsafeFields: string[];
  redacted: true;
  noExternalUpload: true;
  fullUserDataIncluded: false;
  secretsIncluded: false;
};

const unsafeFieldFragments = [
  'appdata',
  ['local', 'storage'].join(''),
  'traininglog',
  'workoutlog',
  'secret',
  'token',
  ['service', 'role'].join(''),
  'note',
  'payload',
  'requestbody',
  ['pass', 'word'].join(''),
];

const normalizeErrorCode = (value: string) =>
  value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);

const shouldDropUnsafeField = (key: string) => {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
  return unsafeFieldFragments.some((fragment) => normalized.includes(fragment));
};

export const collectDroppedDiagnosticFields = (
  unsafeDetails: Record<string, unknown> = {},
): string[] => Object.keys(unsafeDetails).filter(shouldDropUnsafeField).sort();

export const createProductionDiagnosticsIncidentSnapshot = (
  input: ProductionDiagnosticsIncidentSnapshotInput,
): ProductionDiagnosticsIncidentSnapshot => ({
  kind: 'production-diagnostics-incident-snapshot',
  environment: input.environment,
  releaseChannel: input.releaseChannel,
  runtimeSourceState: input.runtimeSourceState,
  backendPrimaryCandidateStatus: input.backendPrimaryCandidateStatus ?? 'unknown',
  supabaseAdapterStatus: input.supabaseAdapterStatus ?? 'unknown',
  lastCloudPullStatus: input.lastCloudPullStatus ?? 'unknown',
  lastCloudPushStatus: input.lastCloudPushStatus ?? 'unknown',
  lastConflictStatus: input.lastConflictStatus ?? 'unknown',
  rollbackAvailable: input.rollbackAvailable === true,
  emergencyLocalModeAvailable: input.emergencyLocalModeAvailable !== false,
  redactedErrorCodes: [...new Set((input.errorCodes ?? []).map(normalizeErrorCode).filter(Boolean))],
  buildMetadata: {
    version: input.buildMetadata?.version ?? null,
    commit: input.buildMetadata?.commit ?? null,
    builtAt: input.buildMetadata?.builtAt ?? null,
  },
  droppedUnsafeFields: collectDroppedDiagnosticFields(input.unsafeDetails),
  redacted: true,
  noExternalUpload: true,
  fullUserDataIncluded: false,
  secretsIncluded: false,
});
