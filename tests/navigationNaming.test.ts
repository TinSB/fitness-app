import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('navigation naming', () => {
  const appSource = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');
  const i18nSource = readFileSync(resolve(process.cwd(), 'src/i18n/zh-CN.ts'), 'utf8');
  const readme = readFileSync(resolve(process.cwd(), 'README.md'), 'utf8');
  const navBlock = appSource.slice(appSource.indexOf('const navItems'), appSource.indexOf('] as const;', appSource.indexOf('const navItems')));

  it('uses record/profile as primary navigation concepts', () => {
    expect(navBlock).toContain("id: 'record'");
    expect(navBlock).toContain("id: 'profile'");
    expect(i18nSource).toContain("record: '记录'");
    expect(i18nSource).toContain("profile: '我的'");
    expect(i18nSource).not.toContain("progress: '进度'");
    expect(i18nSource).not.toContain("assessment: '筛查'");
  });

  it('does not keep old README primary-entry wording', () => {
    expect(readme).not.toContain('打开“进度”页');
    expect(readme).not.toContain('ProgressView / PlanView');
  });
});
