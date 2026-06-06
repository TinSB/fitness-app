import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LEGACY_DOC_GUARD_TESTS } from './legacyDocGuardTests';
import { repoRoot } from './runtimeBoundaryTestHelpers';

const root = repoRoot();
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

const canonicalDocs = [
  'docs/DOCS_MANIFEST.md',
  'docs/IRONPATH_MASTER_TECHNICAL_ARCHITECTURE.md',
  'docs/IRONPATH_iOS_SYSTEM_LOGIC.md',
  'docs/IRONPATH_iOS_DECISION_CIRCUIT.html',
  'docs/IRONPATH_REBUILD_00_IRONRULES_AND_CLOUD.md',
  'docs/CLOUD_DECISIONS_ARCHIVE.md',
  'COMMERCIALIZATION_ROADMAP.md',
  'CHANGELOG.md',
] as const;

const referenceDocs = [
  'docs/IRONPATH_PRODUCT_OVERVIEW_CN.md',
  'docs/US_MARKET_CONSUMER_ANALYSIS.md',
  'docs/DIET_COMPANION_APP_V2_DESIGN.md',
  'docs/DIET_COMPANION_COPY_DESIGN.md',
  'docs/DIET_COMPANION_DESIGN_SYSTEM.md',
  'docs/DIET_COMPANION_UI_DESIGN.md',
  'docs/LARDER_ICON_EXPRESSION_GUIDE.md',
  'docs/BLENDER_CLAY_BUILD_BRIEF.md',
  'docs/BLENDER_CLAY_FIX_BRIEF.md',
  'docs/BLENDER_CLAY_REFINE_BRIEF.md',
  'docs/competitor-food-visual-spectrum.html',
  'docs/diet-companion-AB-directions.html',
  'docs/diet-companion-C-fused.html',
  'docs/diet-companion-aura-calorie-final.html',
  'docs/diet-companion-aura-calorie-variants.html',
  'docs/diet-companion-aura-luminous.html',
  'docs/diet-companion-aura-orb.html',
  'docs/diet-companion-full-set.html',
  'docs/diet-companion-highend-direction.html',
  'docs/diet-companion-premium-direction.html',
  'docs/diet-companion-system-prototype.html',
  'docs/diet-companion-ui-kit.html',
  'docs/diet-companion-ui-prototype.html',
  'docs/larder-clay-foodset.html',
  'docs/larder-food-visual-layering.html',
  'docs/larder-ironpath-link.html',
] as const;

const repoMetaDocs = [
  'README.md',
  'AGENTS.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
] as const;
const agentDocs = [
  'docs/agents/domain.md',
  'docs/agents/issue-tracker.md',
  'docs/agents/triage-labels.md',
] as const;
const allowedDocsTreeFiles = new Set(
  [...canonicalDocs, ...referenceDocs, ...agentDocs].filter((path) => path.startsWith('docs/')),
);

const allowedRootMarkdown = new Set([
  ...canonicalDocs.filter((path) => !path.startsWith('docs/')),
  ...repoMetaDocs,
]);

const collectFiles = (directory: string): string[] =>
  readdirSync(resolve(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const child = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return collectFiles(child);
    return child;
  });

const existingDocFiles = new Set(
  [
    ...collectFiles('docs').filter((path) => path.endsWith('.md') || path.endsWith('.html')),
    ...readdirSync(root).filter((path) => path.endsWith('.md')),
  ].sort(),
);
const aliasedExistingDocReferences = new Set(['DOCS_MANIFEST.md']);

const activeTestFiles = collectFiles('tests')
  .filter((path) => path.endsWith('.test.ts'))
  .filter((path) => !LEGACY_DOC_GUARD_TESTS.includes(path as (typeof LEGACY_DOC_GUARD_TESTS)[number]));
const testDocumentationFiles = collectFiles('tests').filter((path) => path.endsWith('.md'));
const activeDocReferenceFiles = [...activeTestFiles, ...testDocumentationFiles];

const docLiteralPattern =
  /(?:['"`])?((?:docs\/[^\s'"`)]+\.(?:md|html))|(?:[A-Z][A-Z0-9_]+\.md))(?:['"`])?/g;

describe('living documentation system', () => {
  it('keeps the manifest-registered canonical and reference docs present', () => {
    const manifest = read('docs/DOCS_MANIFEST.md');

    for (const path of canonicalDocs) {
      expect(existingDocFiles.has(path), `${path} should exist`).toBe(true);
      const manifestToken =
        path === 'docs/DOCS_MANIFEST.md'
          ? 'DOCS_MANIFEST'
          : path === 'docs/IRONPATH_iOS_DECISION_CIRCUIT.html'
            ? 'IRONPATH_iOS_DECISION_CIRCUIT.html'
            : path;
      expect(manifest, `DOCS_MANIFEST should name ${manifestToken}`).toContain(manifestToken);
    }

    for (const path of referenceDocs) {
      expect(existingDocFiles.has(path), `${path} should exist`).toBe(true);
    }

    for (const token of [
      'docs/IRONPATH_PRODUCT_OVERVIEW_CN.md',
      'docs/US_MARKET_CONSUMER_ANALYSIS.md',
      'docs/DIET_COMPANION_*.md',
      'docs/diet-companion-*.html',
      'docs/larder-*.html',
      'docs/LARDER_ICON_EXPRESSION_GUIDE.md',
      'docs/BLENDER_CLAY_*.md',
      'docs/competitor-food-visual-spectrum.html',
    ]) {
      expect(manifest).toContain(token);
    }
  });

  it('keeps the docs tree limited to the manifest-approved living docs', () => {
    const docsTreeFiles = collectFiles('docs')
      .filter((path) => path.endsWith('.md') || path.endsWith('.html'))
      .sort();

    expect(docsTreeFiles).toEqual([...allowedDocsTreeFiles].sort());
  });

  it('keeps root markdown limited to canonical docs and repo metadata', () => {
    const rootMarkdown = readdirSync(root).filter((path) => path.endsWith('.md')).sort();

    expect(rootMarkdown).toEqual([...allowedRootMarkdown].sort());
  });

  it('keeps the master architecture as the highest-level engineering contract', () => {
    const master = read('docs/IRONPATH_MASTER_TECHNICAL_ARCHITECTURE.md');

    expect(master).toContain('canonical, highest-level engineering contract');
    expect(master).toContain('local-first');
    expect(master).toContain('Foundation `FileManager` only');
    expect(master).toContain('CleanTrainingDecisionInput');
    expect(master).toContain('buildCleanAppDataView');
    for (const forbidden of [
      'CloudKit',
      'Supabase',
      'URLSession',
      'WebView',
      'UserDefaults',
      'SQLite',
      'CoreData',
      'SwiftData',
    ]) {
      expect(master).toContain(forbidden);
    }
    expect(master).toContain('package.json');
    expect(master).toContain('lockfile');
    expect(master).toContain('project.pbxproj');
    expect(master).toContain('branch/PR');
  });

  it('keeps the iOS system logic doc as the current implementation map', () => {
    const systemLogic = read('docs/IRONPATH_iOS_SYSTEM_LOGIC.md');

    for (const token of [
      'DOCS_MANIFEST.md',
      'buildCleanAppDataView',
      'CleanTrainingDecisionInput',
      'CanonicalSessionWriter',
      'DataHealth gate',
      'HealthKit',
      'Widget',
      'local-first',
      'Supabase',
    ]) {
      expect(systemLogic).toContain(token);
    }
  });

  it('keeps cloud decisions and commercialization planning in the canonical docs', () => {
    const rebuild = read('docs/IRONPATH_REBUILD_00_IRONRULES_AND_CLOUD.md');
    const cloudArchive = read('docs/CLOUD_DECISIONS_ARCHIVE.md');
    const roadmap = read('COMMERCIALIZATION_ROADMAP.md');
    const changelog = read('CHANGELOG.md');

    expect(rebuild).toContain('local-first');
    expect(rebuild).toContain('Supabase');
    expect(cloudArchive).toContain('Supabase');
    expect(cloudArchive).toContain('RLS');
    expect(cloudArchive).toContain('CRDT');
    expect(roadmap).toContain('Supabase');
    expect(roadmap).toContain('HealthKit');
    expect(changelog).toContain('living-doc system');
    expect(changelog).toContain('Cleaned up 457 stale docs');
  });

  it('prevents active tests and test docs from requiring deleted legacy docs', () => {
    const missingReferences: string[] = [];

    for (const file of activeDocReferenceFiles) {
      const source = read(file);
      for (const match of source.matchAll(docLiteralPattern)) {
        const reference = match[1];
        if (reference.includes('${')) continue;
        if (reference.includes('*')) continue;
        if (reference.startsWith('.')) continue;
        if (aliasedExistingDocReferences.has(reference)) continue;
        if ((reference.endsWith('.md') || reference.endsWith('.html')) && !existingDocFiles.has(reference)) {
          missingReferences.push(`${file} -> ${reference}`);
        }
      }
    }

    expect(missingReferences).toEqual([]);
  });
});
