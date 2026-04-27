import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('main navigation structure', () => {
  const appSource = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');
  const navBlock = appSource.slice(appSource.indexOf('const navItems'), appSource.indexOf('] as const;', appSource.indexOf('const navItems')));

  it('uses the real training workflow navigation', () => {
    for (const label of ['今日', '训练', '记录', '计划', '我的']) {
      expect(navBlock).toContain(`label: '${label}'`);
    }
  });

  it('does not keep screening or progress as primary tabs', () => {
    expect(navBlock).not.toContain("id: 'assessment'");
    expect(navBlock).not.toContain("label: '筛查'");
    expect(navBlock).not.toContain("id: 'progress'");
    expect(navBlock).not.toContain("label: '进度'");
  });

  it('routes record and profile to their page components', () => {
    expect(appSource).toContain("activeTab === 'record'");
    expect(appSource).toContain('<RecordView');
    expect(appSource).toContain("activeTab === 'profile'");
    expect(appSource).toContain('<ProfileView');
    expect(appSource).toContain('<AssessmentView');
  });
});
