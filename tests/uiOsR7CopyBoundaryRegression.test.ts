import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

const collectSourceFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });

const relativePath = (path: string) => relative(repoRoot, path).replaceAll('\\', '/');

const allowedNegativeAutoSyncCopy = ['云端候选不会自动同步', '不会自动同步', '不启用自动同步', '没有自动同步'];
const forbiddenPositiveCopy = [
  '自动同步已启用',
  '后台同步',
  '多设备自动同步',
  '云端已成为默认数据源',
  '已自动上传成功',
  '已上传成功',
  '云端同步完成',
  '自动修复已应用',
  '已自动修复数据',
  '自动应用云端数据',
  '自动上传',
];

const hasNegativeSafetyContext = (line: string) => /(不会|不启用|没有|不提供|不代表|禁止|不可|未启用|不会启用)/.test(line);

const isForbiddenPositiveRuntimeCopy = (line: string, phrase: string) => {
  if (!line.includes(phrase)) return false;
  if (allowedNegativeAutoSyncCopy.some((allowed) => line.includes(allowed))) return false;
  if ((phrase === '后台同步' || phrase === '自动上传') && hasNegativeSafetyContext(line)) return false;
  return true;
};

describe('UI-OS R7 copy boundary regression lock', () => {
  it('allows negative automatic-sync safety copy', () => {
    const runtimeCopy = [
      readFileSync('src/uiOs/surfaces/SafetyStrip.tsx', 'utf8'),
      readFileSync('src/engines/settingsSafetySummary.ts', 'utf8'),
      readFileSync('src/uiOs/settings/CloudCandidateSettingsPanel.tsx', 'utf8'),
    ].join('\n');

    expect(runtimeCopy).toContain('云端候选不会自动同步');
    for (const allowed of allowedNegativeAutoSyncCopy) {
      expect(isForbiddenPositiveRuntimeCopy(allowed, '自动同步已启用')).toBe(false);
    }
  });

  it('classifies dangerous positive claims as forbidden even though negative safety copy is allowed', () => {
    for (const phrase of forbiddenPositiveCopy) {
      expect(isForbiddenPositiveRuntimeCopy(phrase, phrase), phrase).toBe(true);
    }
    expect(isForbiddenPositiveRuntimeCopy('云端候选不会自动同步', '自动同步已启用')).toBe(false);
    expect(isForbiddenPositiveRuntimeCopy('安装 PWA 不会启用后台同步或推送通知。', '后台同步')).toBe(false);
    expect(isForbiddenPositiveRuntimeCopy('不提供自动上传。', '自动上传')).toBe(false);
  });

  it('keeps production source free of positive cloud-sync upload and auto-repair claims', () => {
    const offenders: string[] = [];
    for (const file of collectSourceFiles(resolve(repoRoot, 'src'))) {
      const source = readFileSync(file, 'utf8');
      source.split(/\r?\n/).forEach((line, index) => {
        for (const phrase of forbiddenPositiveCopy) {
          if (isForbiddenPositiveRuntimeCopy(line, phrase)) {
            offenders.push(`${relativePath(file)}:${index + 1} :: ${phrase}`);
          }
        }
      });
    }

    expect(offenders).toEqual([]);
  });
});
