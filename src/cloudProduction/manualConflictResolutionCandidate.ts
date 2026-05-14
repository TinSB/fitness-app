export type ManualConflictResolutionAction =
  | 'keep_local'
  | 'keep_cloud'
  | 'create_backup_then_replace_local'
  | 'create_cloud_snapshot_from_local'
  | 'abort';

export type ManualConflictResolutionInput = {
  action?: ManualConflictResolutionAction;
  confirmed?: boolean;
  backupAvailable?: boolean;
  backupCreated?: boolean;
  ownerValidated?: boolean;
  schemaValidated?: boolean;
};

export type ManualConflictResolutionResult = {
  action: ManualConflictResolutionAction;
  confirmed: boolean;
  backupRequired: boolean;
  backupCreated: boolean;
  ownerValidated: boolean;
  schemaValidated: boolean;
  localDataChanged: false;
  cloudDataChanged: false;
  sourceOfTruthChanged: false;
  aborted: boolean;
  reason: string;
};

const destructiveLookingActions = new Set<ManualConflictResolutionAction>([
  'create_backup_then_replace_local',
  'create_cloud_snapshot_from_local',
]);

const result = (
  action: ManualConflictResolutionAction,
  reason: string,
  input: ManualConflictResolutionInput,
  options: { backupRequired?: boolean; aborted?: boolean } = {},
): ManualConflictResolutionResult => ({
  action,
  confirmed: input.confirmed === true,
  backupRequired: options.backupRequired ?? false,
  backupCreated: input.backupCreated === true,
  ownerValidated: input.ownerValidated === true,
  schemaValidated: input.schemaValidated === true,
  localDataChanged: false,
  cloudDataChanged: false,
  sourceOfTruthChanged: false,
  aborted: options.aborted ?? false,
  reason,
});

export const runManualConflictResolutionCandidate = (
  input: ManualConflictResolutionInput = {},
): ManualConflictResolutionResult => {
  const action = input.action ?? 'abort';

  if (action === 'abort') {
    return result('abort', 'Manual conflict resolution was aborted.', input, { aborted: true });
  }

  const backupRequired = destructiveLookingActions.has(action);

  if (input.confirmed !== true) {
    return result(action, 'Manual confirmation is required.', input, { backupRequired, aborted: true });
  }

  if (backupRequired && (input.backupAvailable !== true || input.backupCreated !== true)) {
    return result(action, 'Backup is required before this conflict resolution candidate.', input, {
      backupRequired,
      aborted: true,
    });
  }

  if (input.ownerValidated !== true) {
    return result(action, 'Owner validation is required.', input, { backupRequired, aborted: true });
  }

  if (input.schemaValidated !== true) {
    return result(action, 'Schema validation is required.', input, { backupRequired, aborted: true });
  }

  return result(action, 'Manual conflict resolution candidate is ready for review.', input, {
    backupRequired,
    aborted: false,
  });
};
