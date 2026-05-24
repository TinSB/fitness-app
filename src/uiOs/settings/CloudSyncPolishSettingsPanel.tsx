import React from 'react';
import { CloudSyncSettingsSection } from '../../cloudSync';
import {
  buildSupabaseProjectRuntimeReadinessCheck,
  type Phase20bEnvRecord,
  type Phase20bSupabaseProjectRuntimeReadinessResult,
} from '../../cloudProduction/supabaseProjectRuntimeReadinessCheck';
import {
  buildCloudSyncSettingsSectionPropsFromRuntime,
  type CloudSyncSettingsRuntimeInput,
} from './cloudSyncRuntimeSettingsAdapter';

export type CloudSyncPolishSettingsPanelProps = CloudSyncSettingsRuntimeInput & {
  browserEnv?: Phase20bEnvRecord | null;
  readiness?: Phase20bSupabaseProjectRuntimeReadinessResult | null;
};

const phase20aAuthorization = {
  runtimeImplementationAuthorized: true,
  canStart20B: true,
  liveCloudSyncActivated: false,
  authRuntimeEnabled: false,
  syncRuntimeEnabled: false,
  cloudPrimaryEnabled: false,
  defaultSyncEnabled: false,
  backgroundWorkEnabled: false,
  sourceOfTruthChanged: false,
  localStorageDeleted: false,
};

const runtimeBoundary = {
  authRuntimeEnabled: false,
  syncRuntimeEnabled: false,
  cloudPrimaryEnabled: false,
  defaultSyncEnabled: false,
  backgroundWorkEnabled: false,
  sourceOfTruthChanged: false,
  localStorageDeleted: false,
};

const readPublicBrowserEnv = (): Phase20bEnvRecord => ({
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
  VITE_IRONPATH_AUTH_CALLBACK_URL: import.meta.env.VITE_IRONPATH_AUTH_CALLBACK_URL,
  VITE_IRONPATH_CLOUD_ENVIRONMENT: import.meta.env.VITE_IRONPATH_CLOUD_ENVIRONMENT,
});

export function CloudSyncPolishSettingsPanel({
  browserEnv,
  readiness: providedReadiness,
  ...runtimeInput
}: CloudSyncPolishSettingsPanelProps) {
  const readiness = React.useMemo(
    () =>
      providedReadiness ??
      buildSupabaseProjectRuntimeReadinessCheck({
        enabled: true,
        phase20aAuthorization,
        browserEnv: browserEnv ?? readPublicBrowserEnv(),
        runtimeBoundary,
        serviceRoleKeyPresent: false,
        browserConfig: { publicBrowserConfigOnly: true },
      }),
    [browserEnv, providedReadiness],
  );
  const sectionProps = React.useMemo(
    () => buildCloudSyncSettingsSectionPropsFromRuntime({ ...runtimeInput, readiness }),
    [readiness, runtimeInput],
  );

  return <CloudSyncSettingsSection {...sectionProps} />;
}
