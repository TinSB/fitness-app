import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { createDefaultEquipmentProfileDraft, validateEquipmentProfileDraft } from '../src/engines/equipmentProfileDraft';
import { EquipmentProfileEditor } from '../src/ui/EquipmentProfileEditor';

const visibleText = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

describe('EquipmentProfileEditor', () => {
  it('renders Chinese-first fields and default explanations', () => {
    const markup = renderToStaticMarkup(createElement(EquipmentProfileEditor, {
      draft: createDefaultEquipmentProfileDraft('barbell'),
    }));
    const text = visibleText(markup);

    expect(text).toContain('器械档案草稿');
    expect(text).toContain('器械类型');
    expect(text).toContain('显示方式');
    expect(text).toContain('杠铃/杆重 lb');
    expect(text).toContain('Olympic bar 默认 45 lb');
    expect(text).toContain('Smith machine 默认 25 lb');
    expect(text).toContain('默认可用杠铃片：2.5 / 5 / 10 / 25 / 45 lb');
  });

  it('renders dumbbell selectorized and plate-loaded owner guidance', () => {
    const dumbbell = visibleText(renderToStaticMarkup(createElement(EquipmentProfileEditor, {
      draft: createDefaultEquipmentProfileDraft('dumbbell'),
    })));
    const selectorized = visibleText(renderToStaticMarkup(createElement(EquipmentProfileEditor, {
      draft: createDefaultEquipmentProfileDraft('selectorized_machine'),
    })));
    const plateLoaded = visibleText(renderToStaticMarkup(createElement(EquipmentProfileEditor, {
      draft: {
        ...createDefaultEquipmentProfileDraft('plate_loaded_machine'),
        includeBaseWeight: true,
      },
    })));

    expect(dumbbell).toContain('哑铃按每只手记录');
    expect(selectorized).toContain('固定器械和绳索重量栈使用机器自己的选项或递增');
    expect(selectorized).toContain('machine_stack_options_missing');
    expect(plateLoaded).toContain('base_weight_unknown');
  });

  it('renders unknown custom warning and does not mutate input draft', () => {
    const draft = createDefaultEquipmentProfileDraft('unknown');
    const before = JSON.stringify(draft);

    const text = visibleText(renderToStaticMarkup(createElement(EquipmentProfileEditor, { draft })));

    expect(text).toContain('unknown_custom_profile_needs_configuration');
    expect(JSON.stringify(draft)).toBe(before);
  });

  it('does not call callbacks on render', () => {
    const onDraftChange = vi.fn();
    const onRequestApply = vi.fn();

    renderToStaticMarkup(createElement(EquipmentProfileEditor, {
      draft: createDefaultEquipmentProfileDraft('barbell'),
      onDraftChange,
      onRequestApply,
    }));

    expect(onDraftChange).not.toHaveBeenCalled();
    expect(onRequestApply).not.toHaveBeenCalled();
  });

  it('can render supplied validation without recalculating visible outcome', () => {
    const draft = {
      ...createDefaultEquipmentProfileDraft('plate_loaded_machine'),
      includeBaseWeight: true,
    };
    const validation = validateEquipmentProfileDraft(draft);
    const text = visibleText(renderToStaticMarkup(createElement(EquipmentProfileEditor, { draft, validation })));

    expect(text).toContain('base_weight_unknown');
    expect(text).toContain('持久保存需后续任务授权');
  });
});
