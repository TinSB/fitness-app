import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('UI migration guard', () => {
  const todaySource = readFileSync('src/features/TodayView.tsx', 'utf8');
  const focusSource = readFileSync('src/features/TrainingFocusView.tsx', 'utf8');
  const progressSource = readFileSync('src/features/ProgressView.tsx', 'utf8');
  const profileSource = readFileSync('src/features/ProfileView.tsx', 'utf8');

  it('TodayView uses the product decision-card layer', () => {
    expect(todaySource).toContain('buildTodayViewModel');
    expect(todaySource).toContain('ProductCard');
    expect(todaySource).toContain('MetricCard');
  });

  it('TrainingFocusView uses the workout remote components', () => {
    expect(focusSource).toContain('WorkoutActionBar');
    expect(focusSource).toContain('BottomSheet');
    expect(focusSource).toContain('Toast');
  });

  it('Record/Progress uses the record-center segmented control', () => {
    expect(progressSource).toContain('SegmentedControl');
    expect(progressSource).toContain('initialSection');
    expect(progressSource).toContain('calendar');
  });

  it('ProfileView remains the owner of low-frequency settings', () => {
    expect(profileSource).toContain('HealthDataPanel');
    expect(profileSource).toContain('onOpenAssessment');
    expect(profileSource).toContain('onUpdateUnitSettings');
    expect(profileSource).toContain('onOpenRecordData');
  });
});
