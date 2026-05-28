import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(__dirname, '..');
const readSource = (relativePath: string): string =>
  readFileSync(resolve(repoRoot, relativePath), 'utf8');

const collectSourceFiles = (directory: string): string[] => {
  const entries = readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') return [];
      return collectSourceFiles(path);
    }
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
};

const relativeFromRoot = (path: string): string => relative(repoRoot, path).replaceAll('\\', '/');

const SRC_FILES_ALL = collectSourceFiles(resolve(repoRoot, 'src'));

const isUiFile = (path: string): boolean =>
  relativeFromRoot(path).startsWith('src/uiOs/') ||
  relativeFromRoot(path).startsWith('src/features/') ||
  relativeFromRoot(path).startsWith('src/ui/');

const importsSymbol = (source: string, symbol: string): boolean => {
  const pattern = new RegExp(`^\\s*import\\b[^;]*\\b${symbol}\\b`, 'm');
  return pattern.test(source);
};

const V5_FLOW = 'src/cloudProduction/cloudSubsequentUploadFlow.ts';

describe('cloudOptimisticConcurrencyV5Static', () => {
  it('cloudOptimisticConcurrencyV5StaticReasonsIncludeRemoteChanged', () => {
    const source = readSource(V5_FLOW);
    expect(source.includes("'remote_changed'")).toBe(true);
    expect(source.includes("'remote_unavailable'")).toBe(true);
    expect(source.includes("'missing_expected_previous_snapshot'")).toBe(true);
  });

  it('cloudOptimisticConcurrencyV5StaticReasonValuesListIncludesNewReasons', () => {
    const source = readSource(V5_FLOW);
    // The exported runtime-readable list must include the three new reasons
    // so static configuration in callers cannot ignore them.
    const listMatch = source.match(
      /CLOUD_SUBSEQUENT_UPLOAD_REASON_VALUES[\s\S]*?\];/,
    );
    expect(listMatch).not.toBeNull();
    const list = listMatch ? listMatch[0] : '';
    expect(list.includes("'remote_changed'")).toBe(true);
    expect(list.includes("'remote_unavailable'")).toBe(true);
    expect(list.includes("'missing_expected_previous_snapshot'")).toBe(true);
  });

  it('cloudOptimisticConcurrencyV5StaticGatewayDeclaresReadLatestSnapshot', () => {
    const source = readSource(V5_FLOW);
    // The optional `readLatestSnapshot` field must be declared on the
    // gateway interface so callers can wire a real reader without changing
    // the V4 import surface.
    expect(source.includes('readLatestSnapshot?:')).toBe(true);
    expect(/readLatestSnapshot\?\:\s*\(input:\s*\{/.test(source)).toBe(true);
  });

  it('cloudOptimisticConcurrencyV5StaticFreshReadGuardsWriteSnapshot', () => {
    const source = readSource(V5_FLOW);
    // The flow must call `gateway.readLatestSnapshot` before `writeSnapshot`
    // when the capability is provided. Verify ordering by index.
    const readIdx = source.indexOf('gateway.readLatestSnapshot');
    const writeIdx = source.indexOf('gateway.writeSnapshot');
    expect(readIdx).toBeGreaterThan(-1);
    expect(writeIdx).toBeGreaterThan(-1);
    expect(readIdx).toBeLessThan(writeIdx);
  });

  it('cloudOptimisticConcurrencyV5StaticRemoteChangedDoesNotWriteSnapshot', () => {
    const source = readSource(V5_FLOW);
    // Slice the source between the V5 preflight block and the writeSnapshot
    // call site. The slice must contain `remote_changed` short-circuit logic
    // and must NOT contain a call to `gateway.writeSnapshot` — i.e. the
    // mismatch branch must return before reaching the write.
    const preflightIdx = source.indexOf("'remote_changed'");
    const writeIdx = source.indexOf('await input.gateway.writeSnapshot(');
    expect(preflightIdx).toBeGreaterThan(-1);
    expect(writeIdx).toBeGreaterThan(-1);
    expect(preflightIdx).toBeLessThan(writeIdx);
  });

  it('cloudOptimisticConcurrencyV5StaticNoSupabaseClientImports', () => {
    const source = readSource(V5_FLOW);
    [
      '@supabase/supabase-js',
      'createClient(',
      'supabase.from',
      "from('cloud_appdata_snapshots'",
      "from('cloud_export_delete_requests'",
      'fetch(',
      'XMLHttpRequest',
      'navigator.sendBeacon',
    ].forEach((forbidden) => {
      expect(source.includes(forbidden)).toBe(false);
    });
  });

  it('cloudOptimisticConcurrencyV5StaticNoLocalStorageClearOrDelete', () => {
    const source = readSource(V5_FLOW);
    expect(source.includes('localStorage.clear')).toBe(false);
    expect(source.includes('localStorage.removeItem')).toBe(false);
    // Cloud row deletion is permanently out of scope for the upload flow.
    expect(source.includes('.delete(')).toBe(false);
    expect(source.includes('.remove(')).toBe(false);
  });

  it('cloudOptimisticConcurrencyV5StaticNoModalOrConfirmImports', () => {
    const source = readSource(V5_FLOW);
    expect(source.toLowerCase().includes('confirm(')).toBe(false);
    expect(source.toLowerCase().includes('alert(')).toBe(false);
    expect(source.toLowerCase().includes('prompt(')).toBe(false);
    expect(source.toLowerCase().includes('window.confirm')).toBe(false);
  });

  it('cloudOptimisticConcurrencyV5StaticNoBackgroundSyncTimers', () => {
    const source = readSource(V5_FLOW);
    expect(source.includes('setInterval(')).toBe(false);
    expect(source.includes('setTimeout(')).toBe(false);
  });

  it('cloudOptimisticConcurrencyV5StaticAppHasNoCloudPrimaryOrDefaultSyncFlags', () => {
    const appSource = readSource('src/App.tsx');
    [
      'cloudPrimaryEnabled: true',
      'defaultSyncEnabled: true',
      'backgroundWorkEnabled: true',
      'sourceOfTruthChanged: true',
      'localStorageDeleted: true',
    ].forEach((forbidden) => {
      expect(appSource.includes(forbidden)).toBe(false);
    });
  });

  it('cloudOptimisticConcurrencyV5StaticUiCallersDoNotBypassFlow', () => {
    // Any UI file that imports runCloudSubsequentUpload must NOT also call
    // gateway.writeSnapshot directly or insert into cloud_appdata_snapshots.
    // V5 inherits this guard from V4 and re-asserts it here.
    const violations: string[] = [];
    SRC_FILES_ALL.forEach((path) => {
      if (!isUiFile(path)) return;
      const source = readFileSync(path, 'utf8');
      if (!importsSymbol(source, 'runCloudSubsequentUpload')) return;
      const usesGatewayDirect =
        source.includes("from('cloud_appdata_snapshots'") ||
        source.includes('writeCloudAppDataCandidate(') ||
        source.includes('.gateway.writeSnapshot(') ||
        source.includes('gateway.writeSnapshot({') ||
        source.includes('.insert(');
      if (usesGatewayDirect) {
        violations.push(relativeFromRoot(path));
      }
    });
    expect(violations).toEqual([]);
  });

  it('cloudOptimisticConcurrencyV5StaticNoUiSupabaseWriteImports', () => {
    const violations: Array<{ file: string; pattern: string }> = [];
    SRC_FILES_ALL.forEach((path) => {
      if (!isUiFile(path)) return;
      const source = readFileSync(path, 'utf8');
      [
        '@supabase/supabase-js',
        'createClient(',
        "from('cloud_appdata_snapshots').insert",
        "from('cloud_appdata_snapshots').upsert",
        "from('cloud_appdata_snapshots').delete",
        'writeCloudAppDataCandidate(',
      ].forEach((pattern) => {
        if (source.includes(pattern)) {
          violations.push({ file: relativeFromRoot(path), pattern });
        }
      });
    });
    expect(violations).toEqual([]);
  });

  it('cloudOptimisticConcurrencyV5StaticDocsExist', () => {
    const planPath = resolve(repoRoot, 'docs/CLOUD_OPTIMISTIC_CONCURRENCY_V5_PLAN.md');
    const docPath = resolve(repoRoot, 'docs/CLOUD_OPTIMISTIC_CONCURRENCY_V5.md');
    expect(statSync(planPath).size).toBeGreaterThan(0);
    expect(statSync(docPath).size).toBeGreaterThan(0);
    const planSrc = readFileSync(planPath, 'utf8');
    const docSrc = readFileSync(docPath, 'utf8');
    expect(planSrc.includes('expectedPreviousSnapshotHash')).toBe(true);
    expect(planSrc.includes('remote_changed')).toBe(true);
    expect(docSrc.includes('expectedPreviousSnapshotHash')).toBe(true);
    expect(docSrc.includes('remote_changed')).toBe(true);
  });

  it('cloudOptimisticConcurrencyV5StaticV4DocsReferenceV5', () => {
    const v4Doc = readSource('docs/CLOUD_SUBSEQUENT_UPLOAD_FLOW_V4.md');
    expect(v4Doc.includes('CLOUD_OPTIMISTIC_CONCURRENCY_V5')).toBe(true);
  });

  it('cloudOptimisticConcurrencyV5StaticPassiveLinesExistForNewReasons', () => {
    const source = readSource(V5_FLOW);
    expect(source.includes('PASSIVE_REMOTE_CHANGED')).toBe(true);
    expect(source.includes('PASSIVE_REMOTE_UNAVAILABLE')).toBe(true);
    expect(source.includes('云端有更新')).toBe(true);
  });

  it('cloudOptimisticConcurrencyV5StaticReadLatestRunsBeforeUnchangedShortCircuit', () => {
    // The fresh read MUST run BEFORE the unchanged short-circuit so the case
    // "local hash matches synced hash but cloud has moved on" surfaces as
    // `remote_changed`, not as a misleading `unchanged`. This is the core V5
    // semantic improvement over V4.
    const source = readSource(V5_FLOW);
    const readIdx = source.indexOf('gateway.readLatestSnapshot');
    // Find the unchanged short-circuit: `if (localHash === previousHash)` is
    // the exact V4 condition that returns `unchanged`.
    const unchangedIdx = source.indexOf('if (localHash === previousHash)');
    expect(readIdx).toBeGreaterThan(-1);
    expect(unchangedIdx).toBeGreaterThan(-1);
    expect(readIdx).toBeLessThan(unchangedIdx);
  });

  it('cloudOptimisticConcurrencyV5StaticReadLatestGatedByGatewayCapability', () => {
    // The fresh read must only fire when the gateway provides
    // `readLatestSnapshot`. Legacy V4 callers that pass a write-only gateway
    // (or `gateway: null`) must keep their previous semantics.
    const source = readSource(V5_FLOW);
    const guardPattern =
      /if\s*\(\s*input\.gateway\s*&&\s*typeof\s+input\.gateway\.readLatestSnapshot\s*===\s*['"]function['"]\s*\)/;
    expect(guardPattern.test(source)).toBe(true);
  });
});
