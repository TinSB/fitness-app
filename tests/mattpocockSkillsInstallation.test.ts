import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const approvedSkills = [
  'diagnose',
  'grill-with-docs',
  'handoff',
  'improve-codebase-architecture',
  'setup-matt-pocock-skills',
  'tdd',
  'to-issues',
  'to-prd',
  'zoom-out',
].sort();

const skippedSkills = [
  'caveman',
  'grill-me',
  'prototype',
  'triage',
  'write-a-skill',
];

describe('mattpocock skills installation', () => {
  it('installs only the approved IronPath skills', () => {
    const skillsRoot = join('.agents', 'skills');
    expect(existsSync(skillsRoot)).toBe(true);

    const installed = readdirSync(skillsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    expect(installed).toEqual(approvedSkills);

    for (const skill of approvedSkills) {
      expect(existsSync(join(skillsRoot, skill, 'SKILL.md'))).toBe(true);
    }

    for (const skill of skippedSkills) {
      expect(existsSync(join(skillsRoot, skill))).toBe(false);
    }
  });

  it('locks only the approved skills', () => {
    const lock = JSON.parse(readFileSync('skills-lock.json', 'utf8')) as {
      skills: Record<string, unknown>;
    };

    expect(Object.keys(lock.skills).sort()).toEqual(approvedSkills);
  });

  it('documents setup choices and runtime boundaries', () => {
    const doc = readFileSync('docs/MATTPOCOCK_SKILLS_INSTALLATION.md', 'utf8');

    for (const required of [
      'Issue tracker: GitHub Issues',
      'Triage labels: use existing labels where available',
      'Docs location: `docs/`',
      'ADR location: `docs/adr/`',
      'Existing docs were not moved or overwritten',
      'does not change app runtime behavior',
      'does not change app runtime behavior, training logic, warmup logic, source-of-truth behavior, persistence behavior, AppData schema, routes, cloud behavior, package dependencies, package scripts, or lockfiles',
      'UI-OS 10A - Real Gym Use Acceptance & Bug Intake V1 remains the recommended next product task and was not started',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('adds the setup files consumed by the skills', () => {
    expect(readFileSync('AGENTS.md', 'utf8')).toContain('## Agent skills');
    expect(readFileSync('docs/agents/issue-tracker.md', 'utf8')).toContain('GitHub Issues');
    expect(readFileSync('docs/agents/triage-labels.md', 'utf8')).toContain('question');
    expect(readFileSync('docs/agents/domain.md', 'utf8')).toContain('single-context');
  });
});
