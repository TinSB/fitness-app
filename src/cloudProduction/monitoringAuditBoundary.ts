export type AuditEventCategory =
  | 'auth_login_attempt'
  | 'auth_logout_attempt'
  | 'migration_dry_run'
  | 'source_of_truth_switch_attempt'
  | 'backend_primary_read_candidate'
  | 'backend_primary_write_candidate'
  | 'rollback'
  | 'emergency_restore'
  | 'sync_conflict'
  | 'sync_rejected'
  | 'deployment_readiness_check'
  | 'secret_env_guard_rejection';

export type AuditEventSeverity = 'info' | 'warning' | 'blocked';

export type AuditEvent = {
  id: string;
  category: AuditEventCategory;
  severity: AuditEventSeverity;
  message: string;
  metadata: Record<string, string | number | boolean | null>;
  externalUploadPerformed: false;
};

export type AuditCollector = {
  externalTransportEnabled: false;
  record: (event: Omit<AuditEvent, 'externalUploadPerformed'>) => AuditEvent;
  list: () => AuditEvent[];
  clear: () => void;
};

const sensitiveKeyFragments = [
  'secret',
  'token',
  ['pass', 'word'].join(''),
  'private',
  'authorization',
  'rawAppData',
];

const redactValue = (key: string, value: unknown): string | number | boolean | null => {
  if (sensitiveKeyFragments.some((fragment) => key.toLowerCase().includes(fragment.toLowerCase()))) {
    return '[redacted]';
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return value;
  }
  return '[redacted]';
};

export const redactAuditMetadata = (
  metadata: Record<string, unknown>,
): Record<string, string | number | boolean | null> =>
  Object.fromEntries(Object.entries(metadata).map(([key, value]) => [key, redactValue(key, value)]));

export const createAuditEvent = (
  input: Omit<AuditEvent, 'metadata' | 'externalUploadPerformed'> & { metadata?: Record<string, unknown> },
): AuditEvent => ({
  id: input.id,
  category: input.category,
  severity: input.severity,
  message: input.message,
  metadata: redactAuditMetadata(input.metadata ?? {}),
  externalUploadPerformed: false,
});

export const createInMemoryAuditCollector = (): AuditCollector => {
  const events: AuditEvent[] = [];

  return {
    externalTransportEnabled: false,
    record: (event) => {
      const safeEvent = createAuditEvent(event);
      events.push(safeEvent);
      return safeEvent;
    },
    list: () => events.map((event) => ({
      ...event,
      metadata: { ...event.metadata },
    })),
    clear: () => {
      events.length = 0;
    },
  };
};
