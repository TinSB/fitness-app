import type {
  DevApiReadOnlyDiagnostic,
  DevApiReadOnlyDiagnosticStatus,
  DevApiReadOnlyEndpointDiagnostic,
} from './devApiReadOnlyComparison';

export type DevApiReadOnlyStatusSeverity = 'neutral' | 'info' | 'warning' | 'error';

export type DevApiReadOnlyStatusDisplay = {
  label: string;
  explanation: string;
  severity: DevApiReadOnlyStatusSeverity;
};

export const DEV_API_READ_ONLY_STATUS_MODEL: Record<DevApiReadOnlyDiagnosticStatus, DevApiReadOnlyStatusDisplay> = {
  disabled: {
    label: 'Disabled',
    explanation: 'Read-only diagnostics are off.',
    severity: 'neutral',
  },
  checking: {
    label: 'Checking',
    explanation: 'Comparing local summaries with Dev API read results.',
    severity: 'info',
  },
  matching: {
    label: 'Matching',
    explanation: 'Dev API read results match local summaries.',
    severity: 'info',
  },
  mismatch: {
    label: 'Mismatch',
    explanation: 'Read-only comparison found differences. localStorage remains source of truth. No data was changed.',
    severity: 'warning',
  },
  unavailable: {
    label: 'Unavailable',
    explanation: 'Dev API unavailable; app continues normally using localStorage.',
    severity: 'warning',
  },
  error: {
    label: 'Diagnostic error',
    explanation: 'Read-only comparison returned a diagnostic error. App continues using localStorage.',
    severity: 'error',
  },
  misconfigured: {
    label: 'Misconfigured',
    explanation: 'Dev API comparison requires a localhost-only base URL.',
    severity: 'error',
  },
};

const severityClass: Record<DevApiReadOnlyStatusSeverity, string> = {
  neutral: 'border-slate-300 bg-white/95 text-slate-700',
  info: 'border-sky-300 bg-sky-50/95 text-slate-800',
  warning: 'border-amber-300 bg-amber-50/95 text-slate-800',
  error: 'border-rose-300 bg-rose-50/95 text-slate-800',
};

const endpointLabel = (endpoint: DevApiReadOnlyEndpointDiagnostic) =>
  endpoint.path.startsWith('/history/') ? '/history/:id' : endpoint.path;

const hasUnsafeDiagnosticText = (text: string) =>
  /(\bat\s+\S+\(|stack|trace|sqlite|select\s+\*|pragma|^\s*[{[]|<\/?[a-z]|\b(repair|sync|overwrite|import|export|reset|apply|fix)\b)/i.test(text);

const compactText = (text: string) => text.replace(/\s+/g, ' ').trim().slice(0, 120);

const safeConfigMessage = (message: string) => {
  const compact = compactText(message);
  if (/VITE_|process\.env|^\s*[{[]|https?:\/\/(?!localhost|127\.0\.0\.1|\[?::1\]?)/i.test(compact)) {
    return 'Dev API comparison config is invalid.';
  }
  return compact;
};

export const safeEndpointReason = (endpoint: DevApiReadOnlyEndpointDiagnostic) => {
  if (endpoint.status === 'skipped') return endpoint.reason || 'No stable local history id is available.';
  if (!endpoint.error) return endpoint.reason;

  const rawCode = endpoint.error.serverCode || endpoint.error.code;
  const code = /sqlite/i.test(rawCode) ? endpoint.error.code : rawCode;
  const message = compactText(endpoint.error.message);
  const safeMessage = hasUnsafeDiagnosticText(message) ? 'Endpoint returned a diagnostic error.' : message;
  return `${code}: ${safeMessage}`;
};

export const getDevApiReadOnlyStatusDisplay = (status: DevApiReadOnlyDiagnosticStatus) =>
  DEV_API_READ_ONLY_STATUS_MODEL[status];

export const createDevApiMisconfiguredDiagnostic = (message: string): DevApiReadOnlyDiagnostic => ({
  status: 'misconfigured',
  checkedAt: '',
  checkedEndpoints: [],
  mismatchCount: 0,
  message: `${safeConfigMessage(message)} Use a localhost Dev API base URL.`,
});

export const createDevApiCheckingDiagnostic = (): DevApiReadOnlyDiagnostic => ({
  status: 'checking',
  checkedAt: '',
  checkedEndpoints: [],
  mismatchCount: 0,
  message: 'Read-only diagnostics are checking local and Dev API summaries.',
});

export const createDevApiErrorDiagnostic = (checkedAt: string): DevApiReadOnlyDiagnostic => ({
  status: 'error',
  checkedAt,
  checkedEndpoints: [],
  mismatchCount: 0,
  message: 'Read-only diagnostics stopped with an error. App continues using localStorage.',
});

export const DevApiReadOnlyDiagnosticsPanel = ({
  diagnostic,
}: {
  diagnostic: DevApiReadOnlyDiagnostic;
}) => {
  if (diagnostic.status === 'disabled') return null;

  const display = getDevApiReadOnlyStatusDisplay(diagnostic.status);
  const mismatchEndpoints = diagnostic.checkedEndpoints.filter((endpoint) => endpoint.status === 'mismatch');
  const statusClass = severityClass[display.severity];

  return (
    <section
      aria-label="Dev API read-only diagnostics"
      aria-live="polite"
      className={`fixed bottom-24 right-3 z-[90] max-h-[45vh] w-[min(22rem,calc(100vw-1.5rem))] overflow-auto rounded-lg border p-3 text-xs shadow-lg lg:bottom-4 ${statusClass}`}
      role="status"
    >
      <div className="text-sm font-semibold text-slate-950">Dev API read-only diagnostics</div>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
        <dt className="font-medium">Status</dt>
        <dd>{display.label}</dd>
        <dt className="font-medium">Severity</dt>
        <dd>{display.severity}</dd>
        <dt className="font-medium">Endpoints</dt>
        <dd>{diagnostic.checkedEndpoints.length}</dd>
        <dt className="font-medium">Differences</dt>
        <dd>{diagnostic.mismatchCount}</dd>
        <dt className="font-medium">Last checked</dt>
        <dd>{diagnostic.checkedAt || 'pending'}</dd>
      </dl>
      <p className="mt-2 text-slate-700">{diagnostic.message || display.explanation}</p>
      {diagnostic.status === 'mismatch' ? (
        <p className="mt-1 font-medium text-slate-800">localStorage remains source of truth. No data was changed.</p>
      ) : null}
      {diagnostic.status === 'unavailable' ? (
        <p className="mt-1 font-medium text-slate-800">App continues using localStorage.</p>
      ) : null}
      {mismatchEndpoints.length > 0 ? (
        <div className="mt-2">
          <div className="font-medium text-slate-800">Difference endpoints</div>
          <ul className="mt-1 space-y-1">
            {mismatchEndpoints.map((endpoint) => (
              <li key={endpoint.path}>{endpointLabel(endpoint)}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {diagnostic.checkedEndpoints.length > 0 ? (
        <div className="mt-2">
          <div className="font-medium text-slate-800">Endpoint summary</div>
          <ul className="mt-1 space-y-1">
            {diagnostic.checkedEndpoints.map((endpoint) => {
              const reason = safeEndpointReason(endpoint);
              return (
                <li key={endpoint.path}>
                  <span className="font-mono">{endpointLabel(endpoint)}</span>
                  <span>{`: ${endpoint.status}`}</span>
                  {reason ? <span className="text-slate-600">{` - ${reason}`}</span> : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
};
