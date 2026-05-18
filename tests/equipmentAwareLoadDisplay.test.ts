import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { buildEquipmentAwareRecommendationDisplay } from '../src/engines/equipmentAwareRecommendationDisplay';
import { createPlateLoadedMachineProfile } from '../src/engines/equipmentAwareLoadModel';
import { EquipmentAwareLoadDisplay } from '../src/ui/EquipmentAwareLoadDisplay';

describe('EquipmentAwareLoadDisplay', () => {
  it('renders primary and secondary labels', () => {
    const displayResult = buildEquipmentAwareRecommendationDisplay({
      exerciseName: 'Bench Press',
      theoreticalWeightLb: 135,
      setPurpose: 'working',
    });

    const markup = renderToStaticMarkup(createElement(EquipmentAwareLoadDisplay, { displayResult }));

    expect(markup).toContain('135 lb total');
    expect(markup).toContain('每边 45 lb');
    expect(markup).toContain('data-equipment-aware-load-display="presentational"');
  });

  it('renders plate breakdown and details when requested', () => {
    const displayResult = buildEquipmentAwareRecommendationDisplay({
      exerciseName: 'Bench Press',
      theoreticalWeightLb: 115,
      setPurpose: 'working',
      showTheoreticalDetail: true,
    });

    const markup = renderToStaticMarkup(createElement(EquipmentAwareLoadDisplay, { displayResult, showDetails: true }));

    expect(markup).toContain('每边 25 + 10');
    expect(markup).toContain('杆重 45 lb 已计入');
    expect(markup).toContain('已按准备度和可装载重量调整');
  });

  it('hides details unless requested', () => {
    const displayResult = buildEquipmentAwareRecommendationDisplay({
      exerciseName: 'Bench Press',
      theoreticalWeightLb: 17,
      setPurpose: 'warmup',
      showTheoreticalDetail: true,
    });

    const markup = renderToStaticMarkup(createElement(EquipmentAwareLoadDisplay, { displayResult }));

    expect(markup).toContain('空杆 45 lb');
    expect(markup).not.toContain('理论计算：17 lb');
  });

  it('renders warning copy', () => {
    const displayResult = buildEquipmentAwareRecommendationDisplay({
      exerciseName: 'Leg Press',
      theoreticalWeightLb: 90,
      setPurpose: 'working',
      equipmentProfile: {
        ...createPlateLoadedMachineProfile(false),
        displayMode: 'per_side_plates',
      },
    });

    const markup = renderToStaticMarkup(createElement(EquipmentAwareLoadDisplay, { displayResult, showDetails: true }));

    expect(markup).toContain('器械自重未计入 / base weight not included');
    expect(markup).toContain('器械自重未计入，仅显示已加重量');
  });

  it('does not call callbacks on render', () => {
    const onOpenEquipmentProfile = vi.fn();
    const displayResult = buildEquipmentAwareRecommendationDisplay({
      exerciseName: 'Custom Tempo Lift',
      theoreticalWeightLb: 77,
      setPurpose: 'working',
    });

    const markup = renderToStaticMarkup(createElement(EquipmentAwareLoadDisplay, { displayResult, onOpenEquipmentProfile }));

    expect(markup).toContain('配置器械档案');
    expect(onOpenEquipmentProfile).not.toHaveBeenCalled();
  });
});
