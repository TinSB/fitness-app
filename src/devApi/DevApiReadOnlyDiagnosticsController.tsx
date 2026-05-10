import { useEffect, useState } from 'react';
import type { AppData } from '../models/training-model';
import { resolveDevApiReadOnlyConfig, type DevApiReadOnlyConfig } from './devApiReadOnlyConfig';
import {
  createDevApiCheckingDiagnostic,
  createDevApiErrorDiagnostic,
  createDevApiMisconfiguredDiagnostic,
  DevApiReadOnlyDiagnosticsPanel,
} from './DevApiReadOnlyDiagnostics';
import {
  runDevApiReadOnlyComparison,
  type DevApiReadOnlyDiagnostic,
} from './devApiReadOnlyComparison';

type DevApiReadOnlyDiagnosticsProps = {
  data: AppData;
  config?: DevApiReadOnlyConfig;
};

const runtimeConfig = resolveDevApiReadOnlyConfig(import.meta.env);

export const DevApiReadOnlyDiagnostics = ({
  data,
  config = runtimeConfig,
}: DevApiReadOnlyDiagnosticsProps) => {
  const [diagnostic, setDiagnostic] = useState<DevApiReadOnlyDiagnostic | null>(() => {
    if (config.status === 'invalid') {
      return createDevApiMisconfiguredDiagnostic(config.error.message);
    }
    return null;
  });

  useEffect(() => {
    if (!config.enabled) {
      if (config.status === 'invalid') {
        setDiagnostic(createDevApiMisconfiguredDiagnostic(config.error.message));
      } else {
        setDiagnostic(null);
      }
      return undefined;
    }

    const controller = new AbortController();
    let mounted = true;
    setDiagnostic(createDevApiCheckingDiagnostic());

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
        setDiagnostic(createDevApiErrorDiagnostic(new Date().toISOString()));
      });

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [config, data]);

  if (!diagnostic) return null;

  return <DevApiReadOnlyDiagnosticsPanel diagnostic={diagnostic} />;
};
