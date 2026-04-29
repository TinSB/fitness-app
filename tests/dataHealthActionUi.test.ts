import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('data health action UI', () => {
  it('renders actionable DataHealth issues as ActionButton on ProfileView', () => {
    const source = read('src/features/ProfileView.tsx');

    expect(source).toContain('onDataHealthAction');
    expect(source).toContain('issue.action.label');
    expect(source).toContain('<ActionButton type="button" size="sm"');
  });

  it('does not render a fake button for action type none', () => {
    const source = read('src/features/ProfileView.tsx');

    expect(source).toContain("issue.action.type !== 'none'");
  });

  it('keeps default three issue display and folded details', () => {
    const presenter = read('src/presenters/dataHealthPresenter.ts');
    const profile = read('src/features/ProfileView.tsx');

    expect(presenter).toContain('primaryIssues: issues.slice(0, 3)');
    expect(profile).toContain('查看全部问题');
    expect(profile).toContain('查看详情');
  });
});
