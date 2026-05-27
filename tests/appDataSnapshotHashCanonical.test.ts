import { describe, expect, it } from 'vitest';
import { buildAppDataSnapshotHash } from '../src/cloudProduction/accountBoundaryLocalInventory';
import { emptyData } from '../src/storage/appDataSanitize';
import type { AppData } from '../src/models/training-model';

describe('buildAppDataSnapshotHash (canonical regression guard)', () => {
  // The hash is the single source of truth for cloud-sync parity checks
  // (dry-run vs upload-receipt vs read-after-write). It MUST be:
  //   1. pure: same input -> same output across repeated calls.
  //   2. jsonb-roundtrip stable: hash(x) === hash(JSON.parse(JSON.stringify(x))).
  //
  // It used to also "canonicalise via sanitizeData", which intentionally
  // FILLED missing optional fields with `new Date().toISOString()` /
  // `Date.now()` defaults. That broke property 1 every time the AppData
  // had a row missing a timestamp — the iOS "上传完成但云端校验失败"
  // false positive was the direct symptom. We no longer route through
  // sanitize here; the persistence layer owns schema correctness, and
  // the hash owns determinism.

  it('is pure: repeated calls on the same input return the same hash', () => {
    const appData = emptyData();
    const first = buildAppDataSnapshotHash(appData);
    const second = buildAppDataSnapshotHash(appData);
    const third = buildAppDataSnapshotHash(appData);
    expect(first).toBe(second);
    expect(second).toBe(third);
  });

  it('is jsonb-roundtrip stable so cloud parity does not depend on Supabase echo formatting', () => {
    const appData = emptyData();
    const roundtripped = JSON.parse(JSON.stringify(appData)) as AppData;
    expect(buildAppDataSnapshotHash(appData)).toBe(buildAppDataSnapshotHash(roundtripped));
  });

  it('is stable when an optional field is undefined vs absent (mimics JSON.stringify drop semantics)', () => {
    const appData = emptyData();
    const withUndefined = {
      ...appData,
      settings: { ...appData.settings, dataRepairLogs: undefined },
    } as unknown as AppData;
    const withoutKey = { ...appData, settings: { ...appData.settings } } as AppData;
    delete (withoutKey.settings as Record<string, unknown>).dataRepairLogs;
    expect(buildAppDataSnapshotHash(withUndefined)).toBe(buildAppDataSnapshotHash(withoutKey));
  });

  it('distinguishes two genuinely different AppData values', () => {
    const a = emptyData();
    const b: AppData = { ...a, trainingMode: a.trainingMode === 'hybrid' ? 'strength' : 'hybrid' };
    expect(buildAppDataSnapshotHash(a)).not.toBe(buildAppDataSnapshotHash(b));
  });

  it('returns a deterministic string for non-AppData inputs (does not throw)', () => {
    expect(() => buildAppDataSnapshotHash({ junk: 1 })).not.toThrow();
    expect(typeof buildAppDataSnapshotHash({ junk: 1 })).toBe('string');
    // pure: junk object hashes consistently across calls.
    expect(buildAppDataSnapshotHash({ junk: 1 })).toBe(buildAppDataSnapshotHash({ junk: 1 }));
  });

  it('returns the expected phase19b- prefix shape so downstream snapshot ids stay parseable', () => {
    const hash = buildAppDataSnapshotHash(emptyData());
    expect(hash).toMatch(/^phase19b-[0-9a-f]{8}$/);
  });
});
