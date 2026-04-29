import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('profile data health UI', () => {
  it('uses productized data health view model on My page', () => {
    const source = read('src/features/ProfileView.tsx');

    expect(source).toContain('buildDataHealthViewModel');
    expect(source).toContain('数据健康良好');
    expect(source).toContain('未发现会影响训练统计的问题。');
    expect(source).toContain('查看全部问题');
    expect(source).toContain('查看详情');
    expect(source).toContain('technicalDetails');
  });

  it('keeps Record data health entry aligned with the same presenter', () => {
    const source = read('src/features/RecordView.tsx');

    expect(source).toContain('buildDataHealthViewModel');
    expect(source).toContain('primaryIssues');
    expect(source).toContain('secondaryIssues');
    expect(source).toContain('查看全部问题');
  });

  it('keeps engineering terms out of default Profile copy', () => {
    const source = read('src/features/ProfileView.tsx');
    const defaultCopySource = source
      .replace(/<pre[\s\S]*?<\/pre>/g, '')
      .replace(/technicalDetails/g, '');

    expect(defaultCopySource).not.toMatch(/synthetic replacement id|summary cache mismatch|actualExerciseId missing/);
  });
});
