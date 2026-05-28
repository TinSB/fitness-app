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

describe('cloudSubsequentUploadFlowStatic', () => {
  it('cloudSubsequentUploadFlowStaticModuleSurfaceExists', () => {
    const source = readSource('src/cloudProduction/cloudSubsequentUploadFlow.ts');
    expect(source.includes('export const runCloudSubsequentUpload')).toBe(true);
    expect(source.includes('export const computeSubsequentUploadPassiveLine')).toBe(true);
    expect(source.includes('CLOUD_SUBSEQUENT_UPLOAD_REASON_VALUES')).toBe(true);
  });

  it('cloudSubsequentUploadFlowStaticImportsEnsureCloudUploadEligible', () => {
    const source = readSource('src/cloudProduction/cloudSubsequentUploadFlow.ts');
    expect(importsSymbol(source, 'ensureCloudUploadEligible')).toBe(true);
    expect(source.includes("snapshotKind: 'subsequent-upload'")).toBe(true);
  });

  it('cloudSubsequentUploadFlowStaticNoModalOrConfirmImports', () => {
    const source = readSource('src/cloudProduction/cloudSubsequentUploadFlow.ts');
    expect(source.toLowerCase().includes('confirm(')).toBe(false);
    expect(source.toLowerCase().includes('alert(')).toBe(false);
    expect(source.toLowerCase().includes('prompt(')).toBe(false);
    expect(source.toLowerCase().includes('window.confirm')).toBe(false);
    expect(source.includes("from '../../ui/useConfirmDialog'")).toBe(false);
    expect(source.includes("from '../ui/useConfirmDialog'")).toBe(false);
  });

  it('cloudSubsequentUploadFlowStaticNoSupabaseClientImports', () => {
    const source = readSource('src/cloudProduction/cloudSubsequentUploadFlow.ts');
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

  it('cloudSubsequentUploadFlowStaticDoesNotMutateAppDataDirectly', () => {
    const source = readSource('src/cloudProduction/cloudSubsequentUploadFlow.ts');
    expect(source.includes('appData.history.push')).toBe(false);
    expect(source.includes('appData.settings =')).toBe(false);
    expect(source.includes('delete appData')).toBe(false);
    expect(source.includes('localStorage.clear')).toBe(false);
    expect(source.includes('localStorage.removeItem')).toBe(false);
  });

  it('cloudSubsequentUploadFlowStaticUiCallersUseCentralFlow', () => {
    // For every UI file that imports `runCloudSubsequentUpload`, it must
    // dispatch the upload through that central module rather than calling
    // Supabase or `gateway.writeSnapshot` directly. Today there is at
    // most one UI caller (the CloudSync settings panel). If it imports the
    // central flow, the static contract is satisfied.
    const violations: string[] = [];
    SRC_FILES_ALL.forEach((path) => {
      if (!isUiFile(path)) return;
      const source = readFileSync(path, 'utf8');
      if (!importsSymbol(source, 'runCloudSubsequentUpload')) return;
      const usesGatewayDirect = source.includes("from('cloud_appdata_snapshots'") ||
        source.includes('writeCloudAppDataCandidate(') ||
        source.includes('.insert(');
      if (usesGatewayDirect) {
        violations.push(relativeFromRoot(path));
      }
    });
    expect(violations).toEqual([]);
  });

  it('cloudSubsequentUploadFlowStaticNoUiSupabaseWriteImports', () => {
    const violations: Array<{ file: string; pattern: string }> = [];
    SRC_FILES_ALL.forEach((path) => {
      if (!isUiFile(path)) return;
      const source = readFileSync(path, 'utf8');
      [
        '@supabase/supabase-js',
        'createClient(',
        "from('cloud_appdata_snapshots').insert",
        "from('cloud_appdata_snapshots').upsert",
        'writeCloudAppDataCandidate(',
      ].forEach((pattern) => {
        if (source.includes(pattern)) {
          violations.push({ file: relativeFromRoot(path), pattern });
        }
      });
    });
    expect(violations).toEqual([]);
  });

  it('cloudSubsequentUploadFlowStaticBackgroundSyncStaysDisabled', () => {
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
    // The V4 module itself must NOT use setInterval / setTimeout to schedule
    // background uploads. The runtime timer-tick interval in App.tsx is for
    // the rest timer UI, not for sync.
    const v4Source = readSource('src/cloudProduction/cloudSubsequentUploadFlow.ts');
    expect(v4Source.includes('setInterval(')).toBe(false);
    expect(v4Source.includes('setTimeout(')).toBe(false);
  });

  it('cloudSubsequentUploadFlowStaticGuardImportInvariantPreserved', () => {
    // V3 invariant: any non-test file outside cloudProduction/sync/devApi that
    // imports production upload candidates must also import ensureCloudUploadEligible.
    const UPLOAD_NAMES = ['runProductionFullAcceptanceSync', 'buildFirstUploadExplicitApply', 'runCloudPushCandidate'];
    const violations: Array<{ file: string; symbol: string }> = [];
    SRC_FILES_ALL.forEach((path) => {
      const rel = relativeFromRoot(path);
      if (rel.startsWith('src/cloudProduction/') || rel.startsWith('src/sync/') || rel.startsWith('src/devApi/')) return;
      const source = readFileSync(path, 'utf8');
      UPLOAD_NAMES.forEach((symbol) => {
        if (!importsSymbol(source, symbol)) return;
        if (!source.includes('ensureCloudUploadEligible')) {
          violations.push({ file: rel, symbol });
        }
      });
    });
    expect(violations).toEqual([]);
  });

  it('cloudSubsequentUploadFlowStaticFilePathSafeForBoundaryScan', () => {
    const subsequentPath = 'src/cloudProduction/cloudSubsequentUploadFlow.ts';
    const stats = statSync(resolve(repoRoot, subsequentPath));
    expect(stats.size).toBeGreaterThan(0);
    // The path itself contains "Cloud" but lives inside cloudProduction/ which
    // is the canonical home for cloud-side candidates. Boundary tests already
    // exempt that subtree.
    expect(subsequentPath.startsWith('src/cloudProduction/')).toBe(true);
  });

  it('cloudSubsequentUploadFlowStaticDocsMentionContract', () => {
    const policy = readSource('docs/DATA_REPAIR_POLICY.md');
    expect(policy.includes('runCloudSubsequentUpload')).toBe(true);
  });

  it('cloudSubsequentUploadFlowStaticGuardOriginNotDuplicated', () => {
    const candidates = SRC_FILES_ALL.filter((path) => {
      const source = readFileSync(path, 'utf8');
      return /export\s+const\s+ensureCloudUploadEligible\s*=/.test(source);
    }).map(relativeFromRoot);
    expect(candidates).toEqual(['src/dataHealth/uploadEligibilityGuard.ts']);
  });
});
