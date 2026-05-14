import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { SupabaseProjectGuardResult } from './supabaseEnvironmentProjectGuard';

export type SupabaseClientAdapterCandidateStatus =
  | 'disabled'
  | 'config_missing'
  | 'unsafe_config'
  | 'ready_candidate'
  | 'read_candidate'
  | 'write_candidate'
  | 'failed';

export type SupabaseClientAdapterCandidateErrorCode =
  | 'adapter_disabled'
  | 'project_guard_missing'
  | 'project_guard_rejected'
  | 'anon_key_missing'
  | 'service_role_rejected'
  | 'read_failed'
  | 'write_failed'
  | 'operation_not_mocked';

export type SupabaseClientAdapterCandidateResult<TData = unknown> = {
  ok: boolean;
  status: SupabaseClientAdapterCandidateStatus;
  errorCode?: SupabaseClientAdapterCandidateErrorCode;
  data: TData | null;
  networkAttempted: false;
  serviceRoleExposed: false;
  localDataChanged: false;
  sourceOfTruthChanged: false;
  message: string;
};

export type SupabaseClientAdapterCandidateOptions<TRead = unknown, TWrite = unknown> = {
  enabled?: boolean;
  projectGuard?: SupabaseProjectGuardResult;
  anonKeyCandidate?: string;
  serviceRoleKeyPresent?: boolean;
  clientFactory?: (projectUrl: string, anonKey: string) => SupabaseClient;
  mockRead?: () => SupabaseClientAdapterCandidateResult<TRead>;
  mockWrite?: (data: TWrite) => SupabaseClientAdapterCandidateResult<TWrite>;
};

export type SupabaseClientAdapterCandidate<TRead = unknown, TWrite = unknown> = {
  status: SupabaseClientAdapterCandidateStatus;
  enabled: boolean;
  clientCreated: boolean;
  serviceRoleExposed: false;
  sourceOfTruthChanged: false;
  readCandidate: () => SupabaseClientAdapterCandidateResult<TRead>;
  writeCandidate: (data: TWrite) => SupabaseClientAdapterCandidateResult<TWrite>;
};

const result = <TData>(
  status: SupabaseClientAdapterCandidateStatus,
  message: string,
  options: {
    ok?: boolean;
    errorCode?: SupabaseClientAdapterCandidateErrorCode;
    data?: TData | null;
  } = {},
): SupabaseClientAdapterCandidateResult<TData> => ({
  ok: options.ok ?? false,
  status,
  errorCode: options.errorCode,
  data: options.data ?? null,
  networkAttempted: false,
  serviceRoleExposed: false,
  localDataChanged: false,
  sourceOfTruthChanged: false,
  message,
});

const disabled = <TRead, TWrite>(): SupabaseClientAdapterCandidate<TRead, TWrite> => ({
  status: 'disabled',
  enabled: false,
  clientCreated: false,
  serviceRoleExposed: false,
  sourceOfTruthChanged: false,
  readCandidate: () => result('disabled', 'Supabase client adapter candidate is disabled by default.', {
    errorCode: 'adapter_disabled',
  }),
  writeCandidate: () => result('disabled', 'Supabase client adapter candidate is disabled by default.', {
    errorCode: 'adapter_disabled',
  }),
});

export const createSupabaseClientAdapterCandidate = <TRead = unknown, TWrite = unknown>(
  options: SupabaseClientAdapterCandidateOptions<TRead, TWrite> = {},
): SupabaseClientAdapterCandidate<TRead, TWrite> => {
  if (options.enabled !== true) return disabled();

  if (!options.projectGuard) {
    return {
      ...disabled(),
      status: 'config_missing',
      readCandidate: () => result('config_missing', 'Supabase project guard result is required.', {
        errorCode: 'project_guard_missing',
      }),
      writeCandidate: () => result('config_missing', 'Supabase project guard result is required.', {
        errorCode: 'project_guard_missing',
      }),
    };
  }

  if (!options.projectGuard.ok) {
    return {
      ...disabled(),
      status: 'unsafe_config',
      readCandidate: () => result('unsafe_config', 'Supabase project guard rejected this candidate config.', {
        errorCode: 'project_guard_rejected',
      }),
      writeCandidate: () => result('unsafe_config', 'Supabase project guard rejected this candidate config.', {
        errorCode: 'project_guard_rejected',
      }),
    };
  }

  if (!options.anonKeyCandidate) {
    return {
      ...disabled(),
      status: 'config_missing',
      readCandidate: () => result('config_missing', 'Supabase anon key candidate is required.', {
        errorCode: 'anon_key_missing',
      }),
      writeCandidate: () => result('config_missing', 'Supabase anon key candidate is required.', {
        errorCode: 'anon_key_missing',
      }),
    };
  }

  if (options.serviceRoleKeyPresent === true) {
    return {
      ...disabled(),
      status: 'unsafe_config',
      readCandidate: () => result('unsafe_config', 'Service role key is not browser safe.', {
        errorCode: 'service_role_rejected',
      }),
      writeCandidate: () => result('unsafe_config', 'Service role key is not browser safe.', {
        errorCode: 'service_role_rejected',
      }),
    };
  }

  const clientFactory = options.clientFactory ?? createClient;
  clientFactory(options.projectGuard.projectUrl, options.anonKeyCandidate);

  return {
    status: 'ready_candidate',
    enabled: true,
    clientCreated: true,
    serviceRoleExposed: false,
    sourceOfTruthChanged: false,
    readCandidate: () =>
      options.mockRead
        ? options.mockRead()
        : result('failed', 'Read candidate requires a mocked adapter operation in Phase 12.', {
            errorCode: 'operation_not_mocked',
          }),
    writeCandidate: (data: TWrite) =>
      options.mockWrite
        ? options.mockWrite(data)
        : result('failed', 'Write candidate requires a mocked adapter operation in Phase 12.', {
            errorCode: 'operation_not_mocked',
          }),
  };
};
