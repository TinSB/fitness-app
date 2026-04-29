import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

const collectSourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return collectSourceFiles(full);
    return /\.(ts|tsx)$/.test(entry) ? [full] : [];
  });

const sourceFiles = () => collectSourceFiles(resolve(root, 'src'));

describe('native dialog guard', () => {
  it('does not use browser-native alert or confirm APIs in source', () => {
    const offenders = sourceFiles()
      .filter((file) => {
        const source = readFileSync(file, 'utf8');
        return (
          source.includes('window.alert') ||
          source.includes('window.confirm') ||
          source.includes('globalThis.alert') ||
          source.includes('globalThis.confirm') ||
          /(^|[^A-Za-z0-9_.])alert\s*\(/.test(source) ||
          /(^|[^A-Za-z0-9_.])confirm\s*\(\s*['"`]/.test(source)
        );
      })
      .map((file) => relative(root, file));

    expect(offenders).toEqual([]);
  });

  it('keeps confirmation and feedback on product UI components', () => {
    const app = readFileSync(resolve(root, 'src/App.tsx'), 'utf8');
    const focus = readFileSync(resolve(root, 'src/features/TrainingFocusView.tsx'), 'utf8');
    const record = readFileSync(resolve(root, 'src/features/RecordView.tsx'), 'utf8');
    const profile = readFileSync(resolve(root, 'src/features/ProfileView.tsx'), 'utf8');
    const health = readFileSync(resolve(root, 'src/features/HealthDataPanel.tsx'), 'utf8');

    expect(app).toContain('useConfirmDialog');
    expect(app).toContain('showAppToast');
    expect(focus).toContain('ConfirmDialog');
    expect(focus).toContain('<Toast');
    expect(record).toContain('ConfirmDialog');
    expect(profile).toContain('ConfirmDialog');
    expect(health).toContain('ConfirmDialog');
  });
});
