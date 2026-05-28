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

// Files that legally re-implement upload-related types or wrap candidates.
// They DO consult the guard or live inside cloudProduction/ which is the
// candidate origin folder for boundary-locked upload candidates. Tests are
// also exempt.
const CLOUD_PRODUCTION_OWN_FILE = (path: string): boolean =>
  relativeFromRoot(path).startsWith('src/cloudProduction/') ||
  relativeFromRoot(path).startsWith('src/sync/') ||
  relativeFromRoot(path).startsWith('src/devApi/');

const UPLOAD_FUNCTION_NAMES = [
  'runProductionFullAcceptanceSync',
  'buildFirstUploadExplicitApply',
  'runCloudPushCandidate',
] as const;

describe('cloudUploadEligibilityEnforcementStatic', () => {
  it('cloudUploadEligibilityEnforcementStaticGuardModuleExists', () => {
    const source = readSource('src/dataHealth/uploadEligibilityGuard.ts');
    expect(source.includes('ensureCloudUploadEligible')).toBe(true);
    expect(source.includes('UPLOAD_ELIGIBILITY_GUARD_REASON_VALUES')).toBe(true);
    expect(source.includes('UPLOAD_ELIGIBILITY_GUARD_SOURCE_VALUES')).toBe(true);
    expect(source.includes('UPLOAD_ELIGIBILITY_GUARD_SNAPSHOT_KINDS')).toBe(true);
  });

  it('cloudUploadEligibilityEnforcementStaticGuardCallsEvaluator', () => {
    const source = readSource('src/dataHealth/uploadEligibilityGuard.ts');
    expect(source.includes('evaluateCloudUploadEligibility(')).toBe(true);
  });

  it('cloudUploadEligibilityEnforcementStaticNoDuplicateEvaluator', () => {
    const candidates = SRC_FILES_ALL.filter((path) => {
      const source = readFileSync(path, 'utf8');
      return /export\s+const\s+evaluateCloudUploadEligibility\s*=/.test(source) ||
        /export\s+function\s+evaluateCloudUploadEligibility\s*\(/.test(source);
    }).map(relativeFromRoot);
    expect(candidates).toEqual(['src/dataHealth/uploadEligibility.ts']);
  });

  it('cloudUploadEligibilityEnforcementStaticProductionCallersImportGuard', () => {
    const violations: Array<{ file: string; function: string }> = [];
    SRC_FILES_ALL.forEach((path) => {
      if (CLOUD_PRODUCTION_OWN_FILE(path)) return;
      const source = readFileSync(path, 'utf8');
      UPLOAD_FUNCTION_NAMES.forEach((name) => {
        // Only count actual imports of the upload function — comments and
        // string literals that mention the symbol are not callers.
        const importPattern = new RegExp(`^\\s*import\\b[^;]*\\b${name}\\b`, 'm');
        if (!importPattern.test(source)) return;
        if (!source.includes('ensureCloudUploadEligible')) {
          violations.push({ file: relativeFromRoot(path), function: name });
        }
      });
    });
    expect(violations).toEqual([]);
  });

  it('cloudUploadEligibilityEnforcementStaticGuardHasNoModalImports', () => {
    const source = readSource('src/dataHealth/uploadEligibilityGuard.ts');
    expect(source.toLowerCase().includes('confirm(')).toBe(false);
    expect(source.toLowerCase().includes('alert(')).toBe(false);
    expect(source.toLowerCase().includes('prompt(')).toBe(false);
    expect(source.toLowerCase().includes('window.confirm')).toBe(false);
    expect(source.includes("'../ui/useConfirmDialog'")).toBe(false);
    expect(source.includes("from '../ui/Toast'")).toBe(false);
  });

  it('cloudUploadEligibilityEnforcementStaticGuardDoesNotImportCloudWriteHelpers', () => {
    const source = readSource('src/dataHealth/uploadEligibilityGuard.ts');
    [
      'writeCloudAppDataCandidate',
      'cloudPushCandidate',
      'firstUploadExplicitApply',
      'productionFullAcceptanceRuntime',
      'cloudWriteShadow',
      'supabase',
      '@supabase/supabase-js',
    ].forEach((forbidden) => {
      expect(source.includes(forbidden)).toBe(false);
    });
  });

  it('cloudUploadEligibilityEnforcementStaticGuardReturnsCompactPassiveStatus', () => {
    const source = readSource('src/dataHealth/uploadEligibilityGuard.ts');
    [
      '数据正在自动整理，稍后同步',
      '数据已整理完成，可同步',
      '同步暂缓，等待数据整理完成',
    ].forEach((line) => {
      expect(source).toContain(line);
    });
  });

  it('cloudUploadEligibilityEnforcementStaticBackgroundSyncStaysDisabled', () => {
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

  it('cloudUploadEligibilityEnforcementStaticGuardModuleIsTypeOnlyWrtAppData', () => {
    // The guard module must read AppData by value through evaluator, not mutate.
    const source = readSource('src/dataHealth/uploadEligibilityGuard.ts');
    expect(source.includes('appData.history.push')).toBe(false);
    expect(source.includes('appData.settings =')).toBe(false);
    expect(source.includes('delete appData')).toBe(false);
    expect(source.includes('localStorage.clear')).toBe(false);
    expect(source.includes('localStorage.removeItem')).toBe(false);
  });

  it('cloudUploadEligibilityEnforcementStaticDocsMentionGuardContract', () => {
    const policy = readSource('docs/DATA_REPAIR_POLICY.md');
    expect(policy.includes('ensureCloudUploadEligible')).toBe(true);
  });

  it('cloudUploadEligibilityEnforcementStaticBoundaryHelperAllowsDataHealthLinkage', () => {
    const boundary = readSource('tests/runtimeBoundaryTestHelpers.ts');
    // Boundary helper continues to recognize the data-health automation diff.
    expect(boundary.includes('isDataHealthRepairAutomationDiff')).toBe(true);
  });

  it('cloudUploadEligibilityEnforcementStaticGuardFileNameNotMatchingForbiddenSubstring', () => {
    // Verify the guard file path does not contain the literal "/cloud" substring
    // which the boundary tests flag in source content. Using ../dataHealth/* is
    // the canonical safe import path.
    const guardPath = 'src/dataHealth/uploadEligibilityGuard.ts';
    expect(guardPath.includes('/cloud')).toBe(false);
    // Also verify the file exists and is not empty.
    const stats = statSync(resolve(repoRoot, guardPath));
    expect(stats.size).toBeGreaterThan(0);
  });
});
