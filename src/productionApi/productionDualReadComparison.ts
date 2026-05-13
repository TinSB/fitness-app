import type { ProductionApiClientResult } from './productionApiClient';

export type ProductionDualReadStatus = 'disabled' | 'unavailable' | 'match' | 'mismatch' | 'failed';

export type ProductionDualReadComparisonInput<T> = {
  enabled?: boolean;
  localValue: T;
  productionRead: () => Promise<ProductionApiClientResult<T>>;
  timeoutMs?: number;
};

export type ProductionDualReadComparisonResult<T> = {
  status: ProductionDualReadStatus;
  diagnosticOnly: true;
  appCanContinue: true;
  mutatedLocal: false;
  localValue: T;
  productionValue?: T;
  errorCode?: string;
};

const sortForStableCompare = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortForStableCompare);
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, sortForStableCompare(entry)]),
    );
  }
  return value;
};

const stableSerialize = (value: unknown) => JSON.stringify(sortForStableCompare(value));

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('production_dual_read_timeout')), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
};

export const compareProductionDualRead = async <T>({
  enabled = false,
  localValue,
  productionRead,
  timeoutMs = 2_000,
}: ProductionDualReadComparisonInput<T>): Promise<ProductionDualReadComparisonResult<T>> => {
  if (!enabled) {
    return {
      status: 'disabled',
      diagnosticOnly: true,
      appCanContinue: true,
      mutatedLocal: false,
      localValue,
    };
  }

  try {
    const productionResult = await withTimeout(productionRead(), timeoutMs);
    if (!productionResult.ok) {
      return {
        status: 'unavailable',
        diagnosticOnly: true,
        appCanContinue: true,
        mutatedLocal: false,
        localValue,
        errorCode: productionResult.error.code,
      };
    }

    return {
      status: stableSerialize(localValue) === stableSerialize(productionResult.value) ? 'match' : 'mismatch',
      diagnosticOnly: true,
      appCanContinue: true,
      mutatedLocal: false,
      localValue,
      productionValue: productionResult.value,
    };
  } catch {
    return {
      status: 'failed',
      diagnosticOnly: true,
      appCanContinue: true,
      mutatedLocal: false,
      localValue,
      errorCode: 'production_dual_read_failed',
    };
  }
};
