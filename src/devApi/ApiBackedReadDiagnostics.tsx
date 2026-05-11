import type { ApiBackedReadPath } from './apiBackedReadClient';
import type { ApiBackedReadConfig } from './apiBackedReadConfig';

export type ApiBackedReadDiagnosticStatus =
  | 'disabled'
  | 'ready'
  | 'checking'
  | 'available'
  | 'partial'
  | 'unavailable'
  | 'error'
  | 'misconfigured';

export type ApiBackedReadEndpointDiagnostic = {
  path: ApiBackedReadPath | '/history/:id';
  status: 'pending' | 'available' | 'missing_snapshot_metadata' | 'unavailable' | 'error' | 'skipped';
  reason?: string;
};

export type ApiBackedReadDiagnostic = {
  status: ApiBackedReadDiagnosticStatus;
  checkedAt: string;
  checkedEndpoints: ApiBackedReadEndpointDiagnostic[];
  snapshotMetadataPresent: boolean;
  message?: string;
};

export type ApiBackedReadStatusSeverity = 'neutral' | 'info' | 'warning' | 'error';

export type ApiBackedReadStatusDisplay = {
  label: string;
  explanation: string;
  severity: ApiBackedReadStatusSeverity;
};

export const API_BACKED_READ_STATUS_MODEL: Record<ApiBackedReadDiagnosticStatus, ApiBackedReadStatusDisplay> = {
  disabled: {
    label: 'Disabled',
    explanation: 'API-backed read diagnostics are off.',
    severity: 'neutral',
  },
  ready: {
    label: 'Ready',
    explanation: 'API-backed read diagnostics are configured but have not loaded API results.',
    severity: 'info',
  },
  checking: {
    label: 'Checking',
    explanation: 'API-backed read diagnostics are fetching GET-only summaries.',
    severity: 'info',
  },
  available: {
    label: 'Available',
    explanation: 'API-backed read diagnostics are available for display only.',
    severity: 'info',
  },
  partial: {
    label: 'Partial',
    explanation: 'Some API-backed read diagnostics are missing safe snapshot metadata.',
    severity: 'warning',
  },
  unavailable: {
    label: 'Unavailable',
    explanation: 'API unavailable; App remains usable from localStorage.',
    severity: 'warning',
  },
  error: {
    label: 'Diagnostic error',
    explanation: 'API-backed read diagnostics returned an error. App remains localStorage-backed.',
    severity: 'error',
  },
  misconfigured: {
    label: 'Misconfigured',
    explanation: 'API-backed read diagnostics require a localhost-only base URL.',
    severity: 'error',
  },
};

const severityClass: Record<ApiBackedReadStatusSeverity, string> = {
  neutral: 'border-slate-300 bg-white/95 text-slate-700',
  info: 'border-sky-300 bg-sky-50/95 text-slate-800',
  warning: 'border-amber-300 bg-amber-50/95 text-slate-800',
  error: 'border-rose-300 bg-rose-50/95 text-slate-800',
};

const compactText = (text: string) => text.replace(/\s+/g, ' ').trim().slice(0, 140);

const hasUnsafeDiagnosticText = (text: string) =>
  /(\bat\s+\S+\(|stack|trace|sqlite|select\s+\*|pragma|^\s*[{[]|<\/?[a-z]|\b(repair|sync|overwrite|import|export|reset|apply|fix)\b)/i.test(text);

const safeMessage = (message: string | undefined, fallback: string) => {
  if (!message) return fallback;
  const compact = compactText(message);
  return hasUnsafeDiagnosticText(compact) ? fallback : compact;
};

export const createApiBackedReadConfigDiagnostic = (config: ApiBackedReadConfig): ApiBackedReadDiagnostic => {
  if (config.enabled) {
    return {
      status: 'ready',
      checkedAt: '',
      checkedEndpoints: [],
      snapshotMetadataPresent: false,
      message: 'API-backed read diagnostics are ready. localStorage remains source of truth.',
    };
  }

  if (config.status === 'invalid') {
    return {
      status: 'misconfigured',
      checkedAt: '',
      checkedEndpoints: [],
      snapshotMetadataPresent: false,
      message: 'API-backed read diagnostics are misconfigured. Use a localhost Dev API base URL.',
    };
  }

  return {
    status: 'disabled',
    checkedAt: '',
    checkedEndpoints: [],
    snapshotMetadataPresent: false,
    message: 'API-backed read diagnostics are disabled.',
  };
};

export const getApiBackedReadStatusDisplay = (status: ApiBackedReadDiagnosticStatus) =>
  API_BACKED_READ_STATUS_MODEL[status];

export const ApiBackedReadDiagnosticsPanel = ({
  diagnostic,
}: {
  diagnostic: ApiBackedReadDiagnostic;
}) => {
  if (diagnostic.status === 'disabled') return null;

  const display = getApiBackedReadStatusDisplay(diagnostic.status);
  const statusClass = severityClass[display.severity];

  return (
    <section
      aria-label="API-backed read diagnostics"
      aria-live="polite"
      className={`fixed bottom-24 left-3 z-[90] max-h-[45vh] w-[min(24rem,calc(100vw-1.5rem))] overflow-auto rounded-lg border p-3 text-xs shadow-lg lg:bottom-4 ${statusClass}`}
      role="status"
    >
      <div className="text-sm font-semibold text-slate-950">API-backed read diagnostics</div>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
        <dt className="font-medium">Status</dt>
        <dd>{display.label}</dd>
        <dt className="font-medium">Severity</dt>
        <dd>{display.severity}</dd>
        <dt className="font-medium">Endpoints</dt>
        <dd>{diagnostic.checkedEndpoints.length}</dd>
        <dt className="font-medium">Snapshot metadata</dt>
        <dd>{diagnostic.snapshotMetadataPresent ? 'present' : 'not stored'}</dd>
        <dt className="font-medium">Last checked</dt>
        <dd>{diagnostic.checkedAt || 'pending'}</dd>
      </dl>
      <p className="mt-2 text-slate-700">
        {safeMessage(diagnostic.message, display.explanation)}
      </p>
      <p className="mt-1 font-medium text-slate-800">
        localStorage remains source of truth. API results never overwrite AppData or localStorage.
      </p>
      {diagnostic.checkedEndpoints.length > 0 ? (
        <div className="mt-2">
          <div className="font-medium text-slate-800">GET endpoint summary</div>
          <ul className="mt-1 space-y-1">
            {diagnostic.checkedEndpoints.map((endpoint) => (
              <li key={endpoint.path}>
                <span className="font-mono">{endpoint.path}</span>
                <span>{`: ${endpoint.status}`}</span>
                {endpoint.reason ? (
                  <span className="text-slate-600">
                    {` - ${safeMessage(endpoint.reason, 'Endpoint returned a diagnostic status.')}`}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
};
