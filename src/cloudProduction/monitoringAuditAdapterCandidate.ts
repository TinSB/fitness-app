export type MonitoringAuditEventType =
  | 'release_channel_selected'
  | 'deployment_config_rejected'
  | 'cloud_pull_candidate_checked'
  | 'cloud_push_candidate_checked'
  | 'manual_conflict_resolution_requested'
  | 'rollback_requested'
  | 'emergency_local_mode_enabled'
  | 'diagnostic_snapshot_created';

export type MonitoringAuditSeverity = 'info' | 'warning' | 'error';

export type MonitoringAuditEventInput = {
  type: MonitoringAuditEventType;
  severity?: MonitoringAuditSeverity;
  occurredAt?: string;
  releaseChannel?: string;
  stableErrorCode?: string;
  metadata?: Record<string, unknown>;
};

export type RedactedAuditEvent = {
  type: MonitoringAuditEventType;
  severity: MonitoringAuditSeverity;
  occurredAt: string;
  releaseChannel: string | null;
  stableErrorCode: string | null;
  metadata: Record<string, string | number | boolean | null>;
  droppedMetadataKeys: string[];
  redacted: true;
  noExternalUpload: true;
};

export type MonitoringAuditSnapshot = {
  eventCount: number;
  events: RedactedAuditEvent[];
  redacted: true;
  externalTransport: 'none';
  noExternalUpload: true;
};

export type MonitoringAuditAdapterCandidate = {
  kind: 'monitoring-audit-adapter-candidate';
  enabled: boolean;
  externalTransport: 'none';
  noExternalUpload: true;
  record: (event: MonitoringAuditEventInput) => RedactedAuditEvent;
  snapshot: () => MonitoringAuditSnapshot;
  clear: () => void;
};

const blockedMetadataFragments = [
  'appdata',
  ['local', 'storage'].join(''),
  'traininglog',
  'workoutlog',
  'secret',
  'token',
  ['service', 'role'].join(''),
  'note',
  'payload',
  ['pass', 'word'].join(''),
  'private',
];

const defaultOccurredAt = '1970-01-01T00:00:00.000Z';

const isSafeMetadataValue = (value: unknown): value is string | number | boolean | null =>
  value === null || ['string', 'number', 'boolean'].includes(typeof value);

const shouldDropMetadataKey = (key: string) => {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
  return blockedMetadataFragments.some((fragment) => normalized.includes(fragment));
};

export const createRedactedAuditEvent = (
  input: MonitoringAuditEventInput,
): RedactedAuditEvent => {
  const metadata: Record<string, string | number | boolean | null> = {};
  const droppedMetadataKeys: string[] = [];

  for (const [key, value] of Object.entries(input.metadata ?? {})) {
    if (shouldDropMetadataKey(key) || !isSafeMetadataValue(value)) {
      droppedMetadataKeys.push(key);
      continue;
    }
    metadata[key] = value;
  }

  return {
    type: input.type,
    severity: input.severity ?? 'info',
    occurredAt: input.occurredAt ?? defaultOccurredAt,
    releaseChannel: input.releaseChannel ?? null,
    stableErrorCode: input.stableErrorCode ?? null,
    metadata,
    droppedMetadataKeys,
    redacted: true,
    noExternalUpload: true,
  };
};

export const createMonitoringAuditSnapshot = (
  events: RedactedAuditEvent[],
): MonitoringAuditSnapshot => ({
  eventCount: events.length,
  events: events.map((event) => ({ ...event, metadata: { ...event.metadata } })),
  redacted: true,
  externalTransport: 'none',
  noExternalUpload: true,
});

export const createMonitoringAuditAdapterCandidate = (
  options: { enabled?: boolean } = {},
): MonitoringAuditAdapterCandidate => {
  const events: RedactedAuditEvent[] = [];

  return {
    kind: 'monitoring-audit-adapter-candidate',
    enabled: options.enabled === true,
    externalTransport: 'none',
    noExternalUpload: true,
    record: (event) => {
      const redactedEvent = createRedactedAuditEvent(event);
      events.push(redactedEvent);
      return redactedEvent;
    },
    snapshot: () => createMonitoringAuditSnapshot(events),
    clear: () => {
      events.length = 0;
    },
  };
};
