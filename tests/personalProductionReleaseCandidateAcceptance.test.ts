import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('personal production release candidate acceptance', () => {
  const doc = () => readSource('docs/PERSONAL_PRODUCTION_RELEASE_CANDIDATE_ACCEPTANCE.md');

  it('uses checkboxes for required acceptance areas', () => {
    const content = doc();

    for (const expected of [
      '- [ ] localStorage baseline verified.',
      '- [ ] Emergency local mode verified.',
      '- [ ] Supabase project manual verification passed.',
      '- [ ] Auth callback manual verification passed.',
      '- [ ] Service role not in browser.',
      '- [ ] RLS/ownership manual review passed.',
      '- [ ] Cloud pull rehearsal passed.',
      '- [ ] Cloud push rehearsal passed.',
      '- [ ] Conflict manual resolution verified.',
      '- [ ] Rollback / kill switch rehearsal passed.',
      '- [ ] Emergency local restore rehearsal passed.',
      '- [ ] Accepted browser mutation routes remain exactly seven.',
      '- [ ] Package drift check passed.',
      '- [ ] Dist token scan clean.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('blocks default sync deployment upload SaaS and real test data', () => {
    const content = doc();

    for (const expected of [
      '- [ ] Confirm no default cloud sync.',
      '- [ ] Confirm no background sync.',
      '- [ ] Confirm no production deployment auto-start.',
      '- [ ] Confirm no external monitoring upload.',
      '- [ ] Confirm this is not public SaaS.',
      '- [ ] No real personal training data in automated tests.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('defines final go no-go gates', () => {
    const content = doc();

    for (const expected of [
      'GO only if every checklist item above is complete.',
      'NO-GO if service role appears in browser-safe config.',
      'NO-GO if any cloud pull would overwrite local data without manual confirmation.',
      'NO-GO if any cloud push can run without dry run, owner check, backup check, schema validation, and manual confirmation.',
      'NO-GO if localStorage fallback or emergency local mode is unavailable.',
    ]) {
      expect(content).toContain(expected);
    }
  });
});
