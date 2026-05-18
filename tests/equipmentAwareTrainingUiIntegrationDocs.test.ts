import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('equipment aware training UI integration docs', () => {
  it('documents Task 17E identity baseline surfaces examples and next task', () => {
    const content = readSource('docs/EQUIPMENT_AWARE_TRAINING_UI_INTEGRATION.md');

    for (const expected of [
      'Task 17E',
      'Equipment-Aware Training UI Integration',
      'PR #266',
      'b6542bc2f51bd7ad448bff1fb3fb161234ae6256',
      '1088 files / 4431 tests',
      '`TrainingView` set cards',
      '`TrainingFocusView` main warmup/working recommendation card',
      '17 lb',
      '45 lb empty Olympic bar',
      '135 lb total + 每边 45 lb',
      'per-hand dumbbell display',
      'selectorized machine stack',
      '器械自重未计入',
      'Task 17F is recommended next.',
      'Task 17F is not started by Task 17E.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('documents display-only safety boundaries and deferred surfaces', () => {
    const content = readSource('docs/EQUIPMENT_AWARE_TRAINING_UI_INTEGRATION.md');

    for (const expected of [
      'presentation-only output',
      'Today recommendation cards remain unchanged',
      'Profile persistence and custom equipment profile editing are deferred',
      'Historical record display is unchanged',
      'change training algorithm',
      'change warmup algorithm directly',
      'change saved set values',
      'change actual draft values',
      'change session mutation payloads',
      'change source-of-truth behavior',
    ]) {
      expect(content).toContain(expected);
    }
  });
});
