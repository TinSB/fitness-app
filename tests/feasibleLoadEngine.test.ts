import { describe, expect, it } from 'vitest';
import {
  createDumbbellProfile,
  createOlympicBarbellProfile,
  createPlateLoadedMachineProfile,
  createSelectorizedMachineProfile,
  createSmithMachineProfile,
  type EquipmentProfile,
} from '../src/engines/equipmentAwareLoadModel';
import {
  buildPlateBreakdown,
  chooseFeasibleCandidate,
  formatFeasibleLoadSummary,
  getDefaultEquipmentProfile,
  resolveDumbbellFeasibleLoad,
  resolveFeasibleLoad,
  resolvePlateLoadedMachineFeasibleLoad,
  resolveSelectorizedMachineFeasibleLoad,
} from '../src/engines/feasibleLoadEngine';

describe('feasible load engine', () => {
  it('resolves a 17 lb Olympic barbell warmup to the 45 lb empty bar', () => {
    const resolved = resolveFeasibleLoad({
      theoreticalWeightLb: 17,
      equipmentProfile: createOlympicBarbellProfile(),
      setPurpose: 'warmup',
    });

    expect(resolved.feasibleWeightLb).toBe(45);
    expect(resolved.displayWeightLb).toBe(45);
    expect(resolved.isEmptyBar).toBe(true);
    expect(resolved.roundingDirection).toBe('minimum_feasible');
    expect(resolved.reason).toBe('below_minimum_bar_weight');
    expect(resolved.sourceOfTruthChanged).toBe(false);
  });

  it('keeps Olympic empty bar and common plate combinations feasible', () => {
    const profile = createOlympicBarbellProfile();
    const empty = resolveFeasibleLoad({ theoreticalWeightLb: 45, equipmentProfile: profile });
    const onePlate = resolveFeasibleLoad({ theoreticalWeightLb: 135, equipmentProfile: profile });
    const oneFifteen = resolveFeasibleLoad({ theoreticalWeightLb: 115, equipmentProfile: profile });

    expect(empty.feasibleWeightLb).toBe(45);
    expect(empty.isEmptyBar).toBe(true);
    expect(onePlate.feasibleWeightLb).toBe(135);
    expect(onePlate.perSideLoadLb).toBe(45);
    expect(onePlate.plateBreakdown?.platesPerSideLb).toEqual([45]);
    expect(oneFifteen.feasibleWeightLb).toBe(115);
    expect(oneFifteen.perSideLoadLb).toBe(35);
    expect(oneFifteen.plateBreakdown?.platesPerSideLb).toEqual([25, 10]);
    expect(formatFeasibleLoadSummary(oneFifteen)).toBe('115 lb total (25 + 10 per side)');
  });

  it('rounds barbell weights by readiness and set purpose without going below minimum', () => {
    const profile: EquipmentProfile = { ...createOlympicBarbellProfile(), roundingPreference: 'readiness_based' };

    expect(resolveFeasibleLoad({ theoreticalWeightLb: 118, equipmentProfile: profile, readinessBias: 'conservative' }).feasibleWeightLb).toBe(115);
    expect(resolveFeasibleLoad({ theoreticalWeightLb: 118, equipmentProfile: profile, readinessBias: 'progressive' }).feasibleWeightLb).toBe(120);
    expect(resolveFeasibleLoad({ theoreticalWeightLb: 118, equipmentProfile: profile, readinessBias: 'neutral' }).feasibleWeightLb).toBe(120);
    expect(resolveFeasibleLoad({ theoreticalWeightLb: 48, equipmentProfile: profile, setPurpose: 'warmup' }).feasibleWeightLb).toBe(45);
    expect(resolveFeasibleLoad({ theoreticalWeightLb: 48, equipmentProfile: profile, setPurpose: 'recovery' }).feasibleWeightLb).toBe(45);
  });

  it('resolves Smith machine loads with a 25 lb bar', () => {
    const profile = createSmithMachineProfile();
    const low = resolveFeasibleLoad({ theoreticalWeightLb: 17, equipmentProfile: profile, setPurpose: 'warmup' });
    const ninetyFive = resolveFeasibleLoad({ theoreticalWeightLb: 95, equipmentProfile: profile });

    expect(low.feasibleWeightLb).toBe(25);
    expect(low.isEmptyBar).toBe(true);
    expect(low.reason).toBe('below_minimum_bar_weight');
    expect(ninetyFive.feasibleWeightLb).toBe(95);
    expect(ninetyFive.perSideLoadLb).toBe(35);
    expect(ninetyFive.plateBreakdown?.platesPerSideLb).toEqual([25, 10]);
  });

  it('rounds dumbbell loads per hand without doubling', () => {
    const profile = createDumbbellProfile();

    const neutral = resolveDumbbellFeasibleLoad({ theoreticalWeightLb: 42, equipmentProfile: { ...profile, roundingPreference: 'nearest' } });
    const conservative = resolveDumbbellFeasibleLoad({
      theoreticalWeightLb: 42,
      equipmentProfile: { ...profile, roundingPreference: 'conservative' },
    });
    const progressive = resolveDumbbellFeasibleLoad({
      theoreticalWeightLb: 42,
      equipmentProfile: { ...profile, roundingPreference: 'progressive' },
    });

    expect(neutral.feasibleWeightLb).toBe(40);
    expect(conservative.feasibleWeightLb).toBe(40);
    expect(progressive.feasibleWeightLb).toBe(45);
    expect(progressive.perHandLoadLb).toBe(45);
    expect(progressive.displayWeightLb).toBe(45);
    expect(progressive.reason).toBe('rounded_to_dumbbell_increment');
    expect(formatFeasibleLoadSummary(progressive)).toBe('45 lb per hand');
  });

  it('uses selectorized machine options and increment fallback', () => {
    const withOptions = {
      ...createSelectorizedMachineProfile(),
      machineWeightOptionsLb: [15, 30, 45, 60, 75, 90],
    };

    expect(resolveSelectorizedMachineFeasibleLoad({ theoreticalWeightLb: 45, equipmentProfile: withOptions }).feasibleWeightLb).toBe(45);
    expect(
      resolveSelectorizedMachineFeasibleLoad({
        theoreticalWeightLb: 52,
        equipmentProfile: { ...withOptions, roundingPreference: 'nearest' },
      }).feasibleWeightLb,
    ).toBe(45);
    expect(
      resolveSelectorizedMachineFeasibleLoad({
        theoreticalWeightLb: 52,
        equipmentProfile: { ...withOptions, roundingPreference: 'progressive' },
      }).feasibleWeightLb,
    ).toBe(60);
    expect(
      resolveSelectorizedMachineFeasibleLoad({
        theoreticalWeightLb: 52,
        equipmentProfile: { ...createSelectorizedMachineProfile(), machineIncrementLb: 10 },
      }).feasibleWeightLb,
    ).toBe(50);
  });

  it('supports plate-loaded base weight and added-load display when base is unknown', () => {
    const withBase = {
      ...createPlateLoadedMachineProfile(true),
      baseMachineWeightLb: 100,
    };
    const withUnknownBase = {
      ...createPlateLoadedMachineProfile(false),
      displayMode: 'per_side_plates' as const,
    };

    const included = resolvePlateLoadedMachineFeasibleLoad({ theoreticalWeightLb: 190, equipmentProfile: withBase });
    const notIncluded = resolvePlateLoadedMachineFeasibleLoad({ theoreticalWeightLb: 90, equipmentProfile: withUnknownBase });

    expect(included.feasibleWeightLb).toBe(190);
    expect(included.displayWeightLb).toBe(190);
    expect(included.baseWeightIncluded).toBe(true);
    expect(included.baseWeightLb).toBe(100);
    expect(included.perSideLoadLb).toBe(45);
    expect(included.plateBreakdown?.platesPerSideLb).toEqual([45]);
    expect(included.reason).toBe('base_machine_weight_included');

    expect(notIncluded.feasibleWeightLb).toBe(90);
    expect(notIncluded.displayWeightLb).toBe(90);
    expect(notIncluded.baseWeightIncluded).toBe(false);
    expect(notIncluded.perSideLoadLb).toBe(45);
    expect(notIncluded.warnings).toContain('base_machine_weight_not_included');
    expect(notIncluded.reason).toBe('base_machine_weight_not_included');
  });

  it('handles incomplete profiles gracefully and never mutates inputs', () => {
    const profile = {
      id: 'custom',
      name: 'Custom',
      equipmentKind: 'unknown' as const,
      displayMode: 'total_weight' as const,
      includeBaseWeight: false,
      roundingPreference: 'nearest' as const,
      availablePlatesLb: [45, 2.5, 10, 25, 5],
    };
    const before = JSON.stringify(profile);

    const resolved = resolveFeasibleLoad({ theoreticalWeightLb: 77, equipmentProfile: profile });

    expect(resolved.feasibleWeightLb).toBe(77);
    expect(resolved.reason).toBe('incomplete_equipment_profile');
    expect(resolved.warnings).toContain('incomplete_equipment_profile');
    expect(resolved.sourceOfTruthChanged).toBe(false);
    expect(JSON.stringify(profile)).toBe(before);
  });

  it('builds stable readable plate breakdowns', () => {
    const profile = createOlympicBarbellProfile();

    expect(buildPlateBreakdown(135, profile).platesPerSideLb).toEqual([45]);
    expect(buildPlateBreakdown(115, profile).platesPerSideLb).toEqual([25, 10]);
    expect(buildPlateBreakdown(90, profile).platesPerSideLb).toEqual([10, 10, 2.5]);
    expect(buildPlateBreakdown(140, profile).platesPerSideLb).toEqual([45, 2.5]);
  });

  it('chooses candidates by rounding preference readiness and set purpose', () => {
    const candidates = [45, 50, 55];

    expect(chooseFeasibleCandidate(52, candidates, 'conservative')).toBe(50);
    expect(chooseFeasibleCandidate(52, candidates, 'progressive')).toBe(55);
    expect(chooseFeasibleCandidate(52, candidates, 'nearest')).toBe(50);
    expect(chooseFeasibleCandidate(52, candidates, 'readiness_based', 'progressive', 'top_set')).toBe(55);
    expect(chooseFeasibleCandidate(52, candidates, 'readiness_based', 'neutral', 'warmup')).toBe(50);
    expect(chooseFeasibleCandidate(20, candidates, 'conservative')).toBe(45);
  });

  it('returns default profiles by equipment kind', () => {
    expect(getDefaultEquipmentProfile('barbell').defaultBarWeightLb).toBe(45);
    expect(getDefaultEquipmentProfile('smith_machine').defaultBarWeightLb).toBe(25);
    expect(getDefaultEquipmentProfile('dumbbell').dumbbellIncrementLb).toBe(5);
    expect(getDefaultEquipmentProfile('selectorized_machine').displayMode).toBe('machine_stack');
    expect(getDefaultEquipmentProfile('plate_loaded_machine').equipmentKind).toBe('plate_loaded_machine');
    expect(getDefaultEquipmentProfile('bodyweight').displayMode).toBe('bodyweight_adjusted');
  });
});
