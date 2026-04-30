import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('PlanView information architecture', () => {
  const source = readFileSync('src/features/PlanView.tsx', 'utf8');

  it('keeps exactly four primary Plan blocks', () => {
    const primaryBlocks = [...source.matchAll(/data-plan-primary-section="([^"]+)"/g)].map((match) => match[1]);

    expect(primaryBlocks).toEqual(['current-plan', 'weekly-schedule', 'coach-inbox', 'adjustment-drafts']);
    expect(source).toContain('title="当前计划"');
    expect(source).toContain('title="本周安排"');
    expect(source).toContain('title="待处理建议"');
    expect(source).toContain('title="调整草案"');
    expect(source).not.toContain('title="当前模板"');
  });

  it('uses one weekly schedule section instead of duplicate day/template sections', () => {
    expect(source).toContain('title="本周安排"');
    expect(source).not.toContain('title="本周训练日"');
    expect(source).not.toContain('title="训练日模板"');
  });

  it('opens training day details through the existing Drawer surface', () => {
    expect(source).toContain('setScheduleDetailTemplate(template)');
    expect(source).toContain('title="训练日详情"');
    expect(source).toContain('detailTemplate.exercises.map');
  });

  it('keeps the weekly schedule card as a summary by default', () => {
    expect(source).toContain('day.primaryExercises.slice(0, 4)');
    expect(source).toContain('查看详情');
    expect(source).not.toContain('当前查看的训练日');
  });

  it('keeps public UI docs aligned with the final Plan sections', () => {
    const docs = ['README.md', 'UI_BLUEPRINT.md', 'UI_VISUAL_ACCEPTANCE.md'].map((file) => readFileSync(file, 'utf8')).join('\n');

    expect(docs).toContain('当前计划');
    expect(docs).toContain('本周安排');
    expect(docs).toContain('待处理建议');
    expect(docs).toContain('调整草案');
    expect(docs).not.toContain('ProgressView');
    expect(docs).not.toContain('Progress / Plan');
    expect(docs).not.toContain('进度页');
    expect(docs).not.toContain('训练日模板和周期');
    expect(docs).not.toContain('当前模板状态');
  });
});
