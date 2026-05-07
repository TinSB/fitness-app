import assistedPullupFixture from '../fixtures/realDataRegression/legacy-assisted-pullup-session.json';
import incompleteDraftFixture from '../fixtures/realDataRegression/incomplete-draft-sets-session.json';
import pplCycleFixture from '../fixtures/realDataRegression/ppl-cycle-boundary-history.json';
import staleSorenessFixture from '../fixtures/realDataRegression/stale-today-soreness.json';
import duplicatePlanDraftFixture from '../fixtures/realDataRegression/duplicate-plan-draft.json';
import legacyUnitDisplayFixture from '../fixtures/realDataRegression/legacy-unit-display.json';
import type { AppData } from '../../src/models/training-model';
import { sanitizeData } from '../../src/storage/persistence';
import { makeAppData } from '../fixtures';

const fixtures = {
  'legacy-assisted-pullup-session': assistedPullupFixture,
  'incomplete-draft-sets-session': incompleteDraftFixture,
  'ppl-cycle-boundary-history': pplCycleFixture,
  'stale-today-soreness': staleSorenessFixture,
  'duplicate-plan-draft': duplicatePlanDraftFixture,
  'legacy-unit-display': legacyUnitDisplayFixture,
} as const;

export type RealDataFixtureName = keyof typeof fixtures;

export type RealDataFixture<TData = unknown> = {
  fixtureMeta: {
    bug: string;
    privacy: string;
  };
  data: TData;
};

export const loadRealDataFixture = <TData = Partial<AppData>>(name: RealDataFixtureName): RealDataFixture<TData> =>
  fixtures[name] as RealDataFixture<TData>;

export const buildAppDataFromFixture = (
  name: RealDataFixtureName,
  overrides: Partial<AppData> = {},
): AppData => {
  const fixture = loadRealDataFixture<Partial<AppData>>(name);
  return sanitizeData({
    ...makeAppData(),
    ...fixture.data,
    ...overrides,
  });
};
