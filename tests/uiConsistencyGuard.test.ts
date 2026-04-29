import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('UI consistency guard', () => {
  it('keeps primary pages on the shared page shell and header rhythm', () => {
    const pageFiles = [
      'src/features/TodayView.tsx',
      'src/features/TrainingView.tsx',
      'src/features/RecordView.tsx',
      'src/features/PlanView.tsx',
      'src/features/ProfileView.tsx',
      'src/features/AssessmentView.tsx',
    ];

    for (const file of pageFiles) {
      const source = read(file);
      expect(source, file).toContain('ResponsivePageLayout');
      expect(source, file).toContain('PageHeader');
      expect(source, file).toContain('Card');
      expect(source, file).toContain('ActionButton');
    }
  });

  it('keeps Focus Mode controls readable, two-layered, and safe-area aware', () => {
    const focus = read('src/features/TrainingFocusView.tsx');
    const actionBar = read('src/ui/WorkoutActionBar.tsx');
    const button = read('src/ui/ActionButton.tsx');

    expect(focus).toContain('专注训练');
    expect(focus).not.toContain('Focus Mode');
    expect(focus).toContain('grid grid-cols-3 gap-2');
    expect(focus).toContain('复制上组');
    expect(focus).toContain('标记不适');
    expect(focus).toContain('aria-label="替代动作"');
    expect(focus).toContain('完成一组');
    expect(actionBar).toContain('env(safe-area-inset-bottom)');
    expect(actionBar).toContain('bg-white');
    expect(button).toContain('disabled:text-slate-400');
    expect(button).not.toMatch(/opacity-(30|40)|text-slate-300/);
  });

  it('keeps modal, drawer, bottom sheet, and toast surfaces visually aligned', () => {
    const confirm = read('src/ui/ConfirmDialog.tsx');
    const confirmHost = read('src/ui/useConfirmDialog.tsx');
    const drawer = read('src/ui/Drawer.tsx');
    const sheet = read('src/ui/BottomSheet.tsx');
    const toast = read('src/ui/Toast.tsx');

    expect(confirm).toContain('rounded-xl');
    expect(confirm).toContain('max-h-[55svh]');
    expect(confirmHost).toContain('env(safe-area-inset-top)');
    expect(confirmHost).toContain('env(safe-area-inset-bottom)');
    expect(drawer).toContain('SafeAreaHeader');
    expect(sheet).toContain('SafeAreaHeader');
    expect(toast).toContain('role="status"');
  });

  it('keeps Today and My low-noise by default', () => {
    const today = read('src/features/TodayView.tsx');
    const profile = read('src/features/ProfileView.tsx');
    const coachReminderPresenter = read('src/presenters/coachReminderPresenter.ts');
    const dataHealthPresenter = read('src/presenters/dataHealthPresenter.ts');

    expect(today).toContain('splitCoachReminders(rawCoachReminders, 2)');
    expect(today).toContain('查看更多提醒');
    expect(coachReminderPresenter).toContain('dedupeCoachReminders');
    expect(profile).toContain('visibleDataHealthIssues');
    expect(profile).toContain('查看全部问题');
    expect(dataHealthPresenter).toContain('primaryIssues: issues.slice(0, 3)');
  });

  it('keeps app navigation aligned to the current information architecture', () => {
    const app = read('src/App.tsx');

    expect(app).toContain("label: '今日'");
    expect(app).toContain("label: '训练'");
    expect(app).toContain("label: '记录'");
    expect(app).toContain("label: '计划'");
    expect(app).toContain("label: '我的'");
    expect(app).not.toContain("label: 'Progress'");
  });
});
