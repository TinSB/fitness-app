import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file: string) => readFileSync(resolve(root, file), 'utf8');

const collectSourceFiles = (dir: string): string[] => {
  return readdirSync(dir)
    .flatMap((entry) => {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) return collectSourceFiles(full);
      return /\.(ts|tsx)$/.test(entry) ? [full] : [];
    });
};

describe('confirm dialog usage', () => {
  it('does not use browser native confirm in source files', () => {
    const offenders = collectSourceFiles(resolve(root, 'src'))
      .filter((file) => readFileSync(file, 'utf8').includes('window.confirm'))
      .map((file) => relative(root, file));

    expect(offenders).toEqual([]);
  });

  it('routes dangerous flows through ConfirmDialog copy', () => {
    const app = read('src/App.tsx');
    const record = read('src/features/RecordView.tsx');
    const profile = read('src/features/ProfileView.tsx');
    const health = read('src/features/HealthDataPanel.tsx');
    const focus = read('src/features/TrainingFocusView.tsx');
    const today = read('src/features/TodayView.tsx');
    const plan = read('src/features/PlanView.tsx');
    const progress = read('src/features/ProgressView.tsx');

    expect(app).toContain('放弃当前训练？');
    expect(record).toContain('删除这次训练？');
    expect(record).toContain('保存修正？');
    expect(plan).toContain('回滚到原模板？');
    expect(profile).toContain('导入备份？');
    expect(health).toContain('删除这批健康数据？');
    expect(health).toContain('继续解析大型 XML？');
    expect(focus).toContain('确认保存这组？');
    expect(today).toContain('今天已经完成训练，仍要再练一场？');
    expect(progress).toContain('应用实验模板？');
  });
});
