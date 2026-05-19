import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('navigation naming', () => {
  const navigationSource = readFileSync(resolve(process.cwd(), 'src/uiOs/uiOsNavigation.ts'), 'utf8');
  const readme = readFileSync(resolve(process.cwd(), 'README.md'), 'utf8');

  it('uses UI-OS labels as primary navigation concepts', () => {
    for (const expected of ["id: 'history'", "id: 'progress'", "id: 'settings'", "label: '历史'", "label: '进步'", "label: '设置'"]) {
      expect(navigationSource).toContain(expected);
    }
    expect(navigationSource).not.toContain("id: 'record'");
    expect(navigationSource).not.toContain("id: 'profile'");
    expect(navigationSource).not.toContain("label: '记录'");
    expect(navigationSource).not.toContain("label: '我的'");
  });

  it('does not keep old README primary-entry wording', () => {
    expect(readme).not.toContain('打开“进度”页');
    expect(readme).not.toContain('ProgressView / PlanView');
    expect(readme).not.toContain('Progress / Plan');
    expect(readme).not.toContain('进度页');
  });
});
