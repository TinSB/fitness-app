export type AppDataOwnerScope =
  | 'anonymous-local'
  | 'device-local'
  | 'backend-primary-candidate'
  | 'cloud-account-candidate';

export type AccountScopedAppDataOwner = {
  scope: AppDataOwnerScope;
  ownerId: string;
  deviceId?: string;
  accountId?: string;
};

export type LocalAccountLinkingErrorCode =
  | 'owner_missing'
  | 'owner_scope_mismatch'
  | 'account_candidate_missing'
  | 'already_linked_candidate'
  | 'unlink_requires_confirmation';

export type LocalAccountLinkingWarningCode =
  | 'manual_confirmation_required'
  | 'device_owner_will_remain_local'
  | 'backend_candidate_owner_detected'
  | 'unlink_dry_run_only';

export type LocalAccountLinkingDryRunInput = {
  ownerBefore?: AccountScopedAppDataOwner | null;
  cloudAccountCandidate?: AccountScopedAppDataOwner | null;
  mode?: 'link' | 'unlink';
  allowAlreadyLinked?: boolean;
  manualConfirmation?: boolean;
};

export type LocalAccountLinkingDryRunResult = {
  ok: boolean;
  safeToLink: boolean;
  warnings: LocalAccountLinkingWarningCode[];
  blockingErrors: LocalAccountLinkingErrorCode[];
  ownerBefore: AccountScopedAppDataOwner | null;
  ownerAfterCandidate: AccountScopedAppDataOwner | null;
  localDataChanged: false;
  cloudDataChanged: false;
  sourceOfTruthChanged: false;
};

const cloneOwner = (owner: AccountScopedAppDataOwner): AccountScopedAppDataOwner => ({
  scope: owner.scope,
  ownerId: owner.ownerId,
  ...(owner.deviceId ? { deviceId: owner.deviceId } : {}),
  ...(owner.accountId ? { accountId: owner.accountId } : {}),
});

const ownerScope = (owner: AccountScopedAppDataOwner | null | undefined): AppDataOwnerScope | null =>
  owner?.scope ?? null;

const validOwner = (owner: AccountScopedAppDataOwner | null | undefined): owner is AccountScopedAppDataOwner =>
  !!owner &&
  !!owner.scope &&
  !!owner.ownerId &&
  (owner.scope !== 'cloud-account-candidate' || !!owner.accountId);

export const runLocalAccountLinkingDryRun = (
  input: LocalAccountLinkingDryRunInput = {},
): LocalAccountLinkingDryRunResult => {
  const warnings: LocalAccountLinkingWarningCode[] = [];
  const blockingErrors: LocalAccountLinkingErrorCode[] = [];
  const mode = input.mode ?? 'link';
  const ownerBefore = input.ownerBefore ? cloneOwner(input.ownerBefore) : null;
  const cloudAccountCandidate = input.cloudAccountCandidate ? cloneOwner(input.cloudAccountCandidate) : null;

  if (!ownerBefore || !validOwner(ownerBefore)) {
    blockingErrors.push('owner_missing');
  }

  if (mode === 'unlink') {
    warnings.push('unlink_dry_run_only');
    if (input.manualConfirmation !== true) {
      blockingErrors.push('unlink_requires_confirmation');
    }
    return {
      ok: blockingErrors.length === 0,
      safeToLink: false,
      warnings,
      blockingErrors,
      ownerBefore,
      ownerAfterCandidate: ownerBefore,
      localDataChanged: false,
      cloudDataChanged: false,
      sourceOfTruthChanged: false,
    };
  }

  if (!cloudAccountCandidate || !validOwner(cloudAccountCandidate)) {
    blockingErrors.push('account_candidate_missing');
  } else if (cloudAccountCandidate.scope !== 'cloud-account-candidate') {
    blockingErrors.push('owner_scope_mismatch');
  }

  if (ownerScope(ownerBefore) === 'cloud-account-candidate' && input.allowAlreadyLinked !== true) {
    blockingErrors.push('already_linked_candidate');
  }

  if (ownerScope(ownerBefore) === 'backend-primary-candidate') {
    warnings.push('backend_candidate_owner_detected');
  }

  if (ownerScope(ownerBefore) === 'device-local') {
    warnings.push('device_owner_will_remain_local');
  }

  if (input.manualConfirmation !== true) {
    warnings.push('manual_confirmation_required');
  }

  const ownerAfterCandidate = cloudAccountCandidate ? cloneOwner(cloudAccountCandidate) : null;
  const safeToLink = blockingErrors.length === 0 && input.manualConfirmation === true;

  return {
    ok: blockingErrors.length === 0,
    safeToLink,
    warnings,
    blockingErrors,
    ownerBefore,
    ownerAfterCandidate,
    localDataChanged: false,
    cloudDataChanged: false,
    sourceOfTruthChanged: false,
  };
};
