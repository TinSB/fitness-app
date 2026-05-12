export type AuthAccountIdentity = {
  accountId: string;
  providerSubjectId: string;
  displayName?: string;
};

export type AuthBoundaryStatus = 'not-implemented';

export type AuthBoundaryUnavailable = {
  ok: false;
  status: AuthBoundaryStatus;
  reason: 'auth_runtime_not_implemented';
  message: string;
};

export type AuthBoundaryResult = AuthBoundaryUnavailable;

export type AuthProviderAdapterSkeleton = {
  kind: 'auth-provider-adapter-skeleton';
  runtime: AuthBoundaryStatus;
  resolveCurrentIdentity: () => AuthBoundaryResult;
};
