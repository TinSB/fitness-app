import type { AppData } from '../models/training-model';

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

export type AccountScopedAppData<TAppData = AppData> = {
  appData: TAppData;
  owner: AccountScopedAppDataOwner;
  localStorageEmergencyBackupOwner: AccountScopedAppDataOwner;
  sourceOfTruthChanged: false;
};

export type AccountScopedAppDataErrorCode =
  | 'owner_missing'
  | 'owner_scope_missing'
  | 'owner_id_missing'
  | 'owner_mismatch'
  | 'account_id_required';

export type AccountScopedAppDataResult<TAppData = AppData> =
  | {
      ok: true;
      scoped: AccountScopedAppData<TAppData>;
    }
  | {
      ok: false;
      errorCode: AccountScopedAppDataErrorCode;
      message: string;
    };

export type OwnerScopeCheckResult = {
  ok: boolean;
  errorCode?: AccountScopedAppDataErrorCode;
  message: string;
};

const cloneOwner = (owner: AccountScopedAppDataOwner): AccountScopedAppDataOwner => ({
  scope: owner.scope,
  ownerId: owner.ownerId,
  ...(owner.deviceId ? { deviceId: owner.deviceId } : {}),
  ...(owner.accountId ? { accountId: owner.accountId } : {}),
});

export const createAnonymousLocalOwner = (
  localOwnerId: string,
  deviceId?: string,
): AccountScopedAppDataOwner => ({
  scope: 'anonymous-local',
  ownerId: localOwnerId,
  ...(deviceId ? { deviceId } : {}),
});

export const createDeviceLocalOwner = (
  localOwnerId: string,
  deviceId: string,
): AccountScopedAppDataOwner => ({
  scope: 'device-local',
  ownerId: localOwnerId,
  deviceId,
});

export const createBackendPrimaryCandidateOwner = (
  localOwnerId: string,
  deviceId?: string,
): AccountScopedAppDataOwner => ({
  scope: 'backend-primary-candidate',
  ownerId: localOwnerId,
  ...(deviceId ? { deviceId } : {}),
});

export const createCloudAccountCandidateOwner = (
  accountId: string,
  deviceId?: string,
): AccountScopedAppDataOwner => ({
  scope: 'cloud-account-candidate',
  ownerId: accountId,
  accountId,
  ...(deviceId ? { deviceId } : {}),
});

export const validateAccountScopedOwner = (
  owner: AccountScopedAppDataOwner | null | undefined,
): OwnerScopeCheckResult => {
  if (!owner) return { ok: false, errorCode: 'owner_missing', message: 'Owner is required.' };
  if (!owner.scope) return { ok: false, errorCode: 'owner_scope_missing', message: 'Owner scope is required.' };
  if (!owner.ownerId) return { ok: false, errorCode: 'owner_id_missing', message: 'Owner id is required.' };
  if (owner.scope === 'cloud-account-candidate' && !owner.accountId) {
    return { ok: false, errorCode: 'account_id_required', message: 'Cloud account candidate owner requires account id.' };
  }
  return { ok: true, message: 'Owner is valid.' };
};

export const assignOwnerScopeToAppData = <TAppData>(
  appData: TAppData,
  owner: AccountScopedAppDataOwner,
): AccountScopedAppDataResult<TAppData> => {
  const ownerValidation = validateAccountScopedOwner(owner);
  if (!ownerValidation.ok) {
    return {
      ok: false,
      errorCode: ownerValidation.errorCode ?? 'owner_missing',
      message: ownerValidation.message,
    };
  }

  const ownerCopy = cloneOwner(owner);
  return {
    ok: true,
    scoped: {
      appData,
      owner: ownerCopy,
      localStorageEmergencyBackupOwner: cloneOwner(ownerCopy),
      sourceOfTruthChanged: false,
    },
  };
};

export const checkOwnerScope = <TAppData>(
  scoped: AccountScopedAppData<TAppData>,
  expectedOwner: AccountScopedAppDataOwner,
): OwnerScopeCheckResult => {
  const expectedValidation = validateAccountScopedOwner(expectedOwner);
  if (!expectedValidation.ok) return expectedValidation;

  if (
    scoped.owner.scope !== expectedOwner.scope ||
    scoped.owner.ownerId !== expectedOwner.ownerId ||
    scoped.owner.accountId !== expectedOwner.accountId
  ) {
    return {
      ok: false,
      errorCode: 'owner_mismatch',
      message: 'AppData owner scope does not match expected owner.',
    };
  }

  return { ok: true, message: 'AppData owner scope matches expected owner.' };
};

export const createOwnerPreservingEmergencyBackup = <TAppData>(
  scoped: AccountScopedAppData<TAppData>,
): AccountScopedAppData<TAppData> => ({
  appData: scoped.appData,
  owner: cloneOwner(scoped.owner),
  localStorageEmergencyBackupOwner: cloneOwner(scoped.localStorageEmergencyBackupOwner),
  sourceOfTruthChanged: false,
});
