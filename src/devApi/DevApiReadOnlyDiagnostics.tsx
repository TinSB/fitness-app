import { useEffect, useState } from 'react';
import type { AppData } from '../models/training-model';
import { resolveDevApiReadOnlyConfig, type DevApiReadOnlyConfig } from './devApiReadOnlyConfig';
import {
  runDevApiReadOnlyComparison,
  type DevApiReadOnlyDiagnostic,
} from './devApiReadOnlyComparison';

type DevApiReadOnlyDiagnosticsProps = {
  data: AppData;
  config?: DevApiReadOnlyConfig;
};

const runtimeConfig = resolveDevApiReadOnlyConfig(import.meta.env);

const statusLabel: Record<DevApiReadOnlyDiagnostic['status'], string> = {
  checking: 'checking',
  matching: 'matching',
  mismatch: 'mismatch',
  unavailable: 'unavailable',
  error: 'error',
};

export const DevApiReadOnlyDiagnosticsPanel = ({
  diagnostic,
}: {
  diagnostic: DevApiReadOnlyDiagnostic;
}) => (
  <div className="fixed bottom-24 right-3 z-[90] max-w-xs rounded-lg border border-slate-300 bg-white/95 p-3 text-xs text-slate-700 shadow-lg lg:bottom-4">
    <div className="font-semibold text-slate-950">Dev API read-only diagnostics</div>
    <div className="mt-1">status: {statusLabel[diagnostic.status]}</div>
    <div>checked endpoints: {diagnostic.checkedEndpoints.length}</div>
    <div>mismatches: {diagnostic.mismatchCount}</div>
    <div>last checked: {diagnostic.checkedAt || 'pending'}</div>
    {diagnostic.message ? <div className="mt-1 text-slate-500">{diagnostic.message}</div> : null}
  </div>
);

export const DevApiReadOnlyDiagnostics = ({
  data,
  config = runtimeConfig,
}: DevApiReadOnlyDiagnosticsProps) => {
  const [diagnostic, setDiagnostic] = useState<DevApiReadOnlyDiagnostic | null>(() => {
    if (config.status === 'invalid') {
      return {
        status: 'error',
        checkedAt: '',
        checkedEndpoints: [],
        mismatchCount: 0,
        message: config.error.message,
      };
    }
    return null;
  });

  useEffect(() => {
    if (!config.enabled) {
      if (config.status === 'invalid') {
        setDiagnostic({
          status: 'error',
          checkedAt: '',
          checkedEndpoints: [],
          mismatchCount: 0,
          message: config.error.message,
        });
      } else {
        setDiagnostic(null);
      }
      return undefined;
    }

    const controller = new AbortController();
    let mounted = true;
    setDiagnostic({
      status: 'checking',
      checkedAt: '',
      checkedEndpoints: [],
      mismatchCount: 0,
      message: 'Dev API read-only comparison is checking local and API summaries.',
    });

    void runDevApiReadOnlyComparison({
      data,
      config,
      signal: controller.signal,
    })
      .then((result) => {
        if (!mounted || controller.signal.aborted) return;
        setDiagnostic(result);
      })
      .catch(() => {
        if (!mounted || controller.signal.aborted) return;
        setDiagnostic({
          status: 'error',
          checkedAt: new Date().toISOString(),
          checkedEndpoints: [],
          mismatchCount: 0,
          message: 'Dev API read-only comparison failed diagnostically; App remains on localStorage.',
        });
      });

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [config, data]);

  if (!diagnostic) return null;

  return <DevApiReadOnlyDiagnosticsPanel diagnostic={diagnostic} />;
};
