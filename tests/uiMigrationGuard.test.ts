import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('UI migration guard', () => {
  const todaySource = read('src/features/TodayView.tsx');
  const focusSource = read('src/features/TrainingFocusView.tsx');
  const trainingSource = read('src/features/TrainingView.tsx');
  const recordSource = read('src/features/RecordView.tsx');
  const planSource = read('src/features/PlanView.tsx');
  const profileSource = read('src/features/ProfileView.tsx');
  const assessmentSource = read('src/features/AssessmentView.tsx');

  const forbiddenCommonMainImports = ['Page', 'Stat', 'Card', 'ActionButton', 'StatusBadge'];

  const getCommonImport = (source: string) =>
    source
      .split('\n')
      .find((line) => line.includes("from '../ui/common'") || line.includes('from "../ui/common"')) || '';

  it('TodayView and TrainingView no longer use common Page or Stat as their page shell', () => {
    expect(getCommonImport(todaySource)).not.toMatch(/\bPage\b|\bStat\b/);
    expect(getCommonImport(trainingSource)).not.toMatch(/\bPage\b|\bStat\b/);
    expect(todaySource).toContain("from '../ui/PageHeader'");
    expect(trainingSource).toContain("from '../ui/PageHeader'");
    expect(trainingSource).toContain("from '../ui/MetricCard'");
  });

  it('RecordView is independent and built from the new record-center components', () => {
    expect(recordSource).not.toContain("from './ProgressView'");
    expect(recordSource).toContain("from '../ui/SegmentedControl'");
    expect(recordSource).toContain("from '../ui/Drawer'");
    expect(recordSource).toContain("from '../ui/ConfirmDialog'");
  });

  it('Plan/Profile/Assessment do not import old common main components', () => {
    for (const source of [planSource, profileSource, assessmentSource]) {
      const commonImport = getCommonImport(source);
      for (const symbol of forbiddenCommonMainImports) {
        expect(commonImport).not.toContain(symbol);
      }
    }
  });

  it('TrainingFocusView still uses the workout remote layer', () => {
    expect(focusSource).toContain('WorkoutActionBar');
    expect(focusSource).toContain('BottomSheet');
    expect(focusSource).toContain('Toast');
    expect(focusSource).toContain("from '../ui/StatusBadge'");
  });
});
