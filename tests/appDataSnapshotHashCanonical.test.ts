import { describe, expect, it } from 'vitest';
import { buildAppDataSnapshotHash } from '../src/cloudProduction/accountBoundaryLocalInventory';
import { emptyData, sanitizeData } from '../src/storage/appDataSanitize';
import { exportAppData } from '../src/storage/backup';
import type { AppData } from '../src/models/training-model';

describe('buildAppDataSnapshotHash (canonical regression guard)', () => {
  it('returns the same hash for canonical AppData and for the same data parsed from its export', () => {
    const appData = emptyData();
    const parsedFromExport = JSON.parse(exportAppData(appData)) as AppData;
    expect(buildAppDataSnapshotHash(appData)).toBe(buildAppDataSnapshotHash(parsedFromExport));
  });

  it('returns the same hash when the in-memory AppData is missing optional fields that sanitize would fill in', () => {
    const canonical = emptyData();
    const drifted = {
      ...canonical,
      settings: { ...canonical.settings, dataRepairLogs: undefined },
    } as unknown as AppData;

    // Confirm that raw stringify would have disagreed: drifted vs sanitized
    // are not byte identical at the surface level.
    expect(JSON.stringify(drifted)).not.toBe(JSON.stringify(sanitizeData(drifted)));

    // But the canonical hash function normalizes both, so they agree.
    expect(buildAppDataSnapshotHash(drifted)).toBe(buildAppDataSnapshotHash(sanitizeData(drifted)));
    expect(buildAppDataSnapshotHash(drifted)).toBe(buildAppDataSnapshotHash(canonical));
  });

  it('distinguishes two genuinely different AppData values', () => {
    const a = emptyData();
    const b: AppData = { ...a, trainingMode: a.trainingMode === 'hybrid' ? 'strength' : 'hybrid' };
    expect(buildAppDataSnapshotHash(a)).not.toBe(buildAppDataSnapshotHash(b));
  });

  it('falls back to raw hashing when the input is not exportable AppData', () => {
    // exportAppData would throw on a junk object; the canonical normalization
    // catches that and falls back to the legacy stable-stringify hashing so
    // the function still returns a deterministic hash without bubbling up
    // the failure to call sites that expect a string.
    expect(() => buildAppDataSnapshotHash({ junk: 1 })).not.toThrow();
    expect(typeof buildAppDataSnapshotHash({ junk: 1 })).toBe('string');
  });

  it('returns the expected phase19b- prefix shape so downstream snapshot ids stay parseable', () => {
    const hash = buildAppDataSnapshotHash(emptyData());
    expect(hash).toMatch(/^phase19b-[0-9a-f]{8}$/);
  });
});
