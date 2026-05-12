import {
  resolveRuntimeSourceConfig,
  type RuntimeSourceConfig,
  type RuntimeSourceEnv,
  type RuntimeSourceMode,
} from './runtimeSourceConfig';

export type RuntimeSourceSelection = {
  mode: RuntimeSourceMode;
  fallbackMode: 'localStorage';
  sourceOfTruth: RuntimeSourceMode;
  appBootSource: RuntimeSourceMode;
  appWriteTarget: RuntimeSourceMode;
  apiBaseUrl?: string;
  apiReadEnabled: boolean;
  apiWriteEnabled: boolean;
  localStorageFallbackAvailable: true;
  productionReady: false;
  requiresVisibleFailure: boolean;
};

export const selectRuntimeSource = (config: RuntimeSourceConfig): RuntimeSourceSelection => {
  if (config.mode === 'api-readonly') {
    return {
      mode: 'api-readonly',
      fallbackMode: 'localStorage',
      sourceOfTruth: 'localStorage',
      appBootSource: 'localStorage',
      appWriteTarget: 'localStorage',
      apiBaseUrl: config.baseUrl,
      apiReadEnabled: true,
      apiWriteEnabled: false,
      localStorageFallbackAvailable: true,
      productionReady: false,
      requiresVisibleFailure: true,
    };
  }

  if (config.mode === 'api-primary-dev') {
    return {
      mode: 'api-primary-dev',
      fallbackMode: 'localStorage',
      sourceOfTruth: 'api-primary-dev',
      appBootSource: 'api-primary-dev',
      appWriteTarget: 'api-primary-dev',
      apiBaseUrl: config.baseUrl,
      apiReadEnabled: true,
      apiWriteEnabled: true,
      localStorageFallbackAvailable: true,
      productionReady: false,
      requiresVisibleFailure: true,
    };
  }

  return {
    mode: 'localStorage',
    fallbackMode: 'localStorage',
    sourceOfTruth: 'localStorage',
    appBootSource: 'localStorage',
    appWriteTarget: 'localStorage',
    apiReadEnabled: false,
    apiWriteEnabled: false,
    localStorageFallbackAvailable: true,
    productionReady: false,
    requiresVisibleFailure: false,
  };
};

export const createRuntimeSourceSelector = (env: RuntimeSourceEnv): RuntimeSourceSelection =>
  selectRuntimeSource(resolveRuntimeSourceConfig(env));
