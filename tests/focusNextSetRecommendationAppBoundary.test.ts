import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('Focus next-set recommendation App boundary', () => {
  it('keeps the Focus next-set recommendation as ephemeral App UI state', () => {
    const app = read('src/App.tsx');

    expect(app).toContain('useState<FocusNextSetRecommendation | null>');
    expect(app).toContain('nextSetRecommendation={focusNextSetRecommendation}');
    expect(app).toContain('onApplyNextSetRecommendation={applyNextSetRecommendation}');
    expect(app).toContain('nextRecommendation = result.nextSetRecommendation ?? null');
    expect(app).toContain('setFocusNextSetRecommendation(nextRecommendation)');
    expect(app).not.toContain('saveData(focusNextSetRecommendation');
    expect(app).not.toContain('writeUiThemePreference(focusNextSetRecommendation');
    expect(app).not.toContain('localStorage.setItem');
  });

  it('does not add recommendation state to persisted session or AppData surfaces', () => {
    const model = read('src/models/training-model.ts');
    const schema = read('src/models/training-data.schema.json');
    const persistence = read('src/storage/persistence.ts');

    expect(model).not.toContain('nextSetRecommendation');
    expect(schema).not.toContain('nextSetRecommendation');
    expect(persistence).not.toContain('nextSetRecommendation');
  });
});
