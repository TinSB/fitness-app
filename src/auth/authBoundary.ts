import type { AuthBoundaryResult, AuthProviderAdapterSkeleton } from './authProviderTypes';

export const AUTH_PROVIDER_ADAPTER_KIND = 'auth-provider-adapter-skeleton' as const;

export const createAuthUnavailableResult = (): AuthBoundaryResult => ({
  ok: false,
  status: 'not-implemented',
  reason: 'auth_runtime_not_implemented',
  message: 'Auth provider adapter skeleton is type-only and has no runtime sign-in flow.',
});

export const createAuthProviderAdapterSkeleton = (): AuthProviderAdapterSkeleton => ({
  kind: AUTH_PROVIDER_ADAPTER_KIND,
  runtime: 'not-implemented',
  resolveCurrentIdentity: createAuthUnavailableResult,
});

export const isAuthRuntimeImplemented = () => false;
