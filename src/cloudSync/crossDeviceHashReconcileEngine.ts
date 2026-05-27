// Feature #39: Compare the local "this is the hash I last uploaded"
// receipt against the cloud row to detect three states:
//
//   1. `aligned`     — cloud row hash matches local; sync is honest.
//   2. `local_ahead` — cloud row hash is the one I last uploaded, but my
//                       local AppData has drifted since. Caller should
//                       offer a re-upload.
//   3. `cross_device_overwrite` — cloud row hash is neither my last
//                       upload nor my current local; some other device
//                       pushed in between. Caller should surface conflict
//                       review.
//
// This engine is pure data — the existing reconcile effect in
// CloudSyncPolishSettingsPanel.tsx feeds it the three hashes (last
// uploaded, current local, cloud row) and decides what UI affordance to
// surface.

export type CrossDeviceReconcileInput = {
  locallyKnownSyncedHash: string | null;
  currentLocalHash: string | null;
  cloudRowHash: string | null;
  cloudRowDeviceId: string | null;
  lastKnownDeviceId: string | null;
};

export type CrossDeviceReconcileState =
  | 'no_cloud_row'
  | 'never_synced_locally'
  | 'aligned'
  | 'local_ahead'
  | 'cross_device_overwrite'
  | 'cloud_diverged_unknown_origin';

export type CrossDeviceReconcileResult = {
  state: CrossDeviceReconcileState;
  shouldClearLocalSyncedHash: boolean;
  shouldOfferReupload: boolean;
  shouldSurfaceConflict: boolean;
  cloudDeviceMatchesLocal: boolean;
};

export const reconcileCrossDeviceHash = (
  input: CrossDeviceReconcileInput,
): CrossDeviceReconcileResult => {
  if (!input.cloudRowHash) {
    return {
      state: 'no_cloud_row',
      shouldClearLocalSyncedHash: Boolean(input.locallyKnownSyncedHash),
      shouldOfferReupload: false,
      shouldSurfaceConflict: false,
      cloudDeviceMatchesLocal: false,
    };
  }

  if (!input.locallyKnownSyncedHash) {
    return {
      state: 'never_synced_locally',
      shouldClearLocalSyncedHash: false,
      shouldOfferReupload: false,
      shouldSurfaceConflict: false,
      cloudDeviceMatchesLocal:
        Boolean(input.cloudRowDeviceId) && input.cloudRowDeviceId === input.lastKnownDeviceId,
    };
  }

  const deviceMatches =
    Boolean(input.cloudRowDeviceId) && input.cloudRowDeviceId === input.lastKnownDeviceId;

  if (input.cloudRowHash === input.locallyKnownSyncedHash) {
    if (input.currentLocalHash === input.locallyKnownSyncedHash) {
      return {
        state: 'aligned',
        shouldClearLocalSyncedHash: false,
        shouldOfferReupload: false,
        shouldSurfaceConflict: false,
        cloudDeviceMatchesLocal: deviceMatches,
      };
    }
    return {
      state: 'local_ahead',
      shouldClearLocalSyncedHash: false,
      shouldOfferReupload: true,
      shouldSurfaceConflict: false,
      cloudDeviceMatchesLocal: deviceMatches,
    };
  }

  // Cloud row hash differs from my last-uploaded hash. Either another
  // device wrote (cross_device_overwrite) or the same device wrote from
  // a different signed-out state (cloud_diverged_unknown_origin).
  if (input.cloudRowDeviceId && input.cloudRowDeviceId !== input.lastKnownDeviceId) {
    return {
      state: 'cross_device_overwrite',
      shouldClearLocalSyncedHash: true,
      shouldOfferReupload: false,
      shouldSurfaceConflict: true,
      cloudDeviceMatchesLocal: false,
    };
  }
  return {
    state: 'cloud_diverged_unknown_origin',
    shouldClearLocalSyncedHash: true,
    shouldOfferReupload: false,
    shouldSurfaceConflict: true,
    cloudDeviceMatchesLocal: deviceMatches,
  };
};
