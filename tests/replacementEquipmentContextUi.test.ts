import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ReplacementEquipmentChips, replacementEquipmentChips, toggleReplacementEquipmentTag } from '../src/features/TrainingFocusView';
import type { ExerciseEquipmentTag } from '../src/data/exerciseLibrary';

const visibleText = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

describe('replacement equipment context UI helpers', () => {
  it('exposes the temporary crowded-gym chips with Chinese labels', () => {
    expect(replacementEquipmentChips).toEqual([
      { tag: 'dumbbell', label: '哑铃区' },
      { tag: 'cable', label: '绳索区' },
      { tag: 'rack', label: '深蹲架' },
      { tag: 'barbell', label: '杠铃' },
      { tag: 'smith', label: '史密斯' },
      { tag: 'machine', label: '固定器械' },
    ]);
  });

  it('supports multi-select toggling without mutating the previous selection', () => {
    const initial: ExerciseEquipmentTag[] = ['dumbbell'];
    const added = toggleReplacementEquipmentTag(initial, 'cable');
    const removed = toggleReplacementEquipmentTag(added, 'dumbbell');

    expect(initial).toEqual(['dumbbell']);
    expect(added).toEqual(['dumbbell', 'cable']);
    expect(removed).toEqual(['cable']);
  });

  it('renders touch-sized chips and does not expose raw equipment tags', () => {
    const html = renderToStaticMarkup(React.createElement(ReplacementEquipmentChips, { selected: ['dumbbell', 'rack'], onToggle: () => undefined }));
    const text = visibleText(html);

    expect(text).toContain('器械被占用？');
    expect(text).toContain('只调整本次替代排序。');
    expect(text).toContain('哑铃区');
    expect(text).toContain('绳索区');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('min-h-10');
    expect(text).not.toMatch(/\b(dumbbell|cable|rack|barbell|smith|machine|undefined|null)\b/);
  });
});
