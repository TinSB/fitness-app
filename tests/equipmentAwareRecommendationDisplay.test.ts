import { describe, expect, it } from 'vitest';
import {
  createOlympicBarbellProfile,
  createPlateLoadedMachineProfile,
  createSelectorizedMachineProfile,
} from '../src/engines/equipmentAwareLoadModel';
import { buildEquipmentAwareRecommendationDisplay } from '../src/engines/equipmentAwareRecommendationDisplay';

describe('equipment aware recommendation display', () => {
  it('displays a Bench Press 17 lb warmup as the 45 lb empty Olympic bar', () => {
    const display = buildEquipmentAwareRecommendationDisplay({
      exerciseName: 'Bench Press',
      theoreticalWeightLb: 17,
      setPurpose: 'warmup',
      showTheoreticalDetail: true,
    });

    expect(display.equipmentKind).toBe('barbell');
    expect(display.feasibleWeightLb).toBe(45);
    expect(display.primaryLabel).toBe('空杆 45 lb');
    expect(display.reasonLabel).toBe('理论重量低于空杆，使用空杆热身');
    expect(display.detailLabel).toContain('理论计算：17 lb');
    expect(display.detailLabel).toContain('实际可做：45 lb');
    expect(display.isEmptyBar).toBe(true);
    expect(display.sourceOfTruthChanged).toBe(false);
    expect(display.trainingAlgorithmChanged).toBe(false);
  });

  it('displays common barbell totals with per-side load and plate breakdown', () => {
    const onePlate = buildEquipmentAwareRecommendationDisplay({
      exerciseName: 'Bench Press',
      theoreticalWeightLb: 135,
      setPurpose: 'working',
    });
    const oneFifteen = buildEquipmentAwareRecommendationDisplay({
      exerciseName: 'Bench Press',
      theoreticalWeightLb: 115,
      setPurpose: 'working',
    });

    expect(onePlate.primaryLabel).toBe('135 lb 总重量');
    expect(onePlate.secondaryLabel).toBe('每边 45 lb');
    expect(onePlate.detailLabel).toBe('杆重 45 lb 已计入');
    expect(oneFifteen.primaryLabel).toBe('115 lb 总重量');
    expect(oneFifteen.secondaryLabel).toBe('每边 35 lb');
    expect(oneFifteen.plateBreakdownLabel).toBe('每边 25 + 10');
  });

  it('displays Smith machine empty bar and per-side loading with the 25 lb default bar', () => {
    const empty = buildEquipmentAwareRecommendationDisplay({
      exerciseName: 'Smith Machine Squat',
      theoreticalWeightLb: 17,
      setPurpose: 'warmup',
    });
    const loaded = buildEquipmentAwareRecommendationDisplay({
      exerciseName: 'Smith Machine Squat',
      theoreticalWeightLb: 95,
      setPurpose: 'working',
    });

    expect(empty.primaryLabel).toBe('史密斯空杆 25 lb');
    expect(empty.reasonLabel).toBe('理论重量低于 Smith 杆重，使用空杆');
    expect(loaded.primaryLabel).toBe('95 lb 总重量');
    expect(loaded.secondaryLabel).toBe('每边 35 lb');
    expect(loaded.detailLabel).toBe('Smith 杆重 25 lb 已计入');
  });

  it('displays dumbbell recommendations per hand without doubling weight', () => {
    const conservative = buildEquipmentAwareRecommendationDisplay({
      exerciseName: 'Dumbbell Bench Press',
      theoreticalWeightLb: 42,
      setPurpose: 'working',
      readinessBias: 'conservative',
    });
    const progressive = buildEquipmentAwareRecommendationDisplay({
      exerciseName: 'Dumbbell Bench Press',
      theoreticalWeightLb: 42,
      setPurpose: 'working',
      readinessBias: 'progressive',
    });

    expect(conservative.primaryLabel).toBe('每只手 40 lb');
    expect(progressive.primaryLabel).toBe('每只手 45 lb');
    expect(progressive.primaryLabel).not.toContain('90 lb');
    expect(progressive.secondaryLabel).toBe('按每只手显示');
    expect(progressive.detailLabel).toBe('哑铃按每只手记录，不合并双手总重量');
  });

  it('displays selectorized machine stack values from custom options', () => {
    const profile = {
      ...createSelectorizedMachineProfile(),
      machineWeightOptionsLb: [15, 30, 45, 60, 75, 90],
      roundingPreference: 'nearest' as const,
    };
    const display = buildEquipmentAwareRecommendationDisplay({
      exerciseName: 'Lat Pulldown',
      theoreticalWeightLb: 52,
      setPurpose: 'working',
      equipmentProfile: profile,
    });

    expect(display.equipmentKind).toBe('selectorized_machine');
    expect(display.primaryLabel).toBe('插片 45 lb');
    expect(display.secondaryLabel).toBe('插片重量');
    expect(display.reasonLabel).toBe('已按器械重量栈/插片选项调整');
  });

  it('displays plate-loaded base inclusion and unknown-base warnings', () => {
    const included = buildEquipmentAwareRecommendationDisplay({
      exerciseName: 'Leg Press',
      theoreticalWeightLb: 190,
      setPurpose: 'working',
      equipmentProfile: {
        ...createPlateLoadedMachineProfile(true),
        baseMachineWeightLb: 100,
      },
    });
    const unknownBase = buildEquipmentAwareRecommendationDisplay({
      exerciseName: 'Leg Press',
      theoreticalWeightLb: 90,
      setPurpose: 'working',
      equipmentProfile: {
        ...createPlateLoadedMachineProfile(false),
        displayMode: 'per_side_plates',
      },
    });

    expect(included.primaryLabel).toBe('190 lb 总重量');
    expect(included.secondaryLabel).toBe('每边 45 lb');
    expect(included.detailLabel).toBe('器械自重/底座重量 100 lb 已计入');
    expect(unknownBase.primaryLabel).toBe('加重 90 lb');
    expect(unknownBase.warningLabel).toBe('器械自重未计入');
  });

  it('returns safe fallback copy for unknown custom exercises', () => {
    const display = buildEquipmentAwareRecommendationDisplay({
      exerciseName: 'Custom Tempo Lift',
      theoreticalWeightLb: 77,
      setPurpose: 'working',
    });

    expect(display.equipmentKind).toBe('unknown');
    expect(display.primaryLabel).toBe('77 lb 总重量');
    expect(display.secondaryLabel).toBe('未知/自定义器械');
    expect(display.warningLabel).toBe('未知器械档案，建议之后配置器械');
    expect(display.isFeasible).toBe(false);
  });

  it('does not mutate caller-provided equipment profiles', () => {
    const profile = {
      ...createOlympicBarbellProfile(),
      availablePlatesLb: [45, 25, 10, 5, 2.5],
    };
    const before = JSON.stringify(profile);

    buildEquipmentAwareRecommendationDisplay({
      exerciseName: 'Bench Press',
      theoreticalWeightLb: 118,
      setPurpose: 'working',
      readinessBias: 'progressive',
      roundingPreference: 'readiness_based',
      equipmentProfile: profile,
    });

    expect(JSON.stringify(profile)).toBe(before);
  });
});
