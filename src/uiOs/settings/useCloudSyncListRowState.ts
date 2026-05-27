import { useSyncExternalStore } from 'react';
import {
  readPersistedCloudSyncEnabledReceipt,
  subscribeToCloudSyncFlowStateChanges,
} from '../../storage/localStorageAdapter';

// The Settings list row for "账号与同步" lives in ProfileView, OUTSIDE the
// CloudSyncPolishSettingsPanel. Before this hook existed, the row's value
// was a hardcoded literal "未开启" that never reflected the persisted sync-on
// receipt. After explicit sync succeeded (panel wrote
// ironpath_cloud_sync_flow_state_v1.syncedAppDataHash to localStorage), the
// row kept saying "未开启" until the next full app reload — and on iPhone PWA
// reopens it kept saying "未开启" forever even though the receipt was intact.
//
// useSyncExternalStore lets the row subscribe to the same envelope the panel
// reads on mount. Same-document writes go through the
// `subscribeToCloudSyncFlowStateChanges` notifier; cross-tab writes (PWA in
// two windows, dev tools editing localStorage) go through the storage event
// the subscriber wires up internally. We deliberately do not read any other
// field from the envelope here — the row label is a single-bit signal.

const getSnapshot = (): string | null => readPersistedCloudSyncEnabledReceipt();
// Same snapshot for client and server: the loader already short-circuits to
// null when localStorage is unavailable (true SSR), so we don't need a
// separate path. Sharing the function also keeps `renderToStaticMarkup`
// tests faithful — they exercise the same read path the browser will run.
const getServerSnapshot = getSnapshot;

export const useCloudSyncListRowEnabled = (): boolean => {
  const hash = useSyncExternalStore(
    subscribeToCloudSyncFlowStateChanges,
    getSnapshot,
    getServerSnapshot,
  );
  return hash !== null;
};

// String constants are kept here (not inside ProfileView) so the row label
// remains co-located with the hook that drives it. This keeps the language
// surface that needs to match the in-panel SyncStatusCenter ("已开启" /
// "未开启") in one place and makes it easy to swap the copy later.
export const CLOUD_SYNC_LIST_ROW_LABEL_ENABLED = '已开启';
export const CLOUD_SYNC_LIST_ROW_LABEL_NOT_ENABLED = '未开启';
