import assert from 'node:assert/strict';
import test from 'node:test';

import {
  auditSkills,
  classifyReferences,
  distinctiveTerms,
  parseSkill,
} from './audit-claude-skills.mjs';

/**
 * Locks in that the audit counts what is really loaded and separates conditional references from
 * defects: a wrong denominator makes a wrong conclusion.
 */

const SKILL = (name, description, body = '') =>
  `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}`;

test('parseSkill extracts the two values that decide activation', () => {
  const parsed = parseSkill(SKILL('pdf', 'Extract text from PDF files', 'body here'));
  assert.equal(parsed.name, 'pdf');
  assert.equal(parsed.description, 'Extract text from PDF files');
  assert.match(parsed.body, /body here/);
});

test('parseSkill folds a multi-line description into one line', () => {
  const raw = '---\nname: x\ndescription: |-\n  first line\n  second line\n---\n\nbody';
  const parsed = parseSkill(raw);
  assert.match(parsed.description, /first line/);
  assert.match(parsed.description, /second line/);
});

test('parseSkill returns null without frontmatter, since it is not a skill', () => {
  assert.equal(parseSkill('# just markdown\n'), null);
});

test('distinctiveTerms drops words that appear in every skill', () => {
  const terms = distinctiveTerms('Use this skill when the user wants to create a PDF invoice');
  assert.ok(terms.includes('pdf'), 'pdf must remain');
  assert.ok(terms.includes('invoice'), 'invoice must remain');
  for (const generic of ['use', 'this', 'skill', 'when', 'user', 'wants', 'create']) {
    assert.ok(!terms.includes(generic), `"${generic}" must be dropped; otherwise every pair looks overlapping`);
  }
});

test('classifyReferences separates own-folder references from conditional ones', () => {
  const { bundled, conditional } = classifyReferences(
    'Read references/spec.md and scripts/run.py. If the project has src/tokens.js or docs/design.md, read those too.',
  );
  assert.deepEqual(bundled.sort(), ['references/spec.md', 'scripts/run.py']);
  assert.ok(conditional.includes('src/tokens.js'));
  assert.ok(conditional.includes('docs/design.md'));
});

test('auditSkills flags same-name skills with different descriptions as a risk', () => {
  const skills = [
    { name: 'dup', description: 'Build frontend interfaces', body: '', file: '/a/SKILL.md', terms: ['frontend'] },
    { name: 'dup', description: 'Guidance for visual design', body: '', file: '/b/SKILL.md', terms: ['visual'] },
    { name: 'same', description: 'identical text', body: '', file: '/c/SKILL.md', terms: ['identical'] },
    { name: 'same', description: 'identical text', body: '', file: '/d/SKILL.md', terms: ['identical'] },
  ];
  const report = auditSkills(skills, { exists: () => true });
  assert.equal(report.total, 4);
  assert.equal(report.uniqueNames, 2);
  const dup = report.duplicates.find((d) => d.name === 'dup');
  const same = report.duplicates.find((d) => d.name === 'same');
  assert.equal(dup.descriptionsDiffer, true, 'different descriptions make activation conditions compete, so it must be flagged');
  assert.equal(same.descriptionsDiffer, false, 'identical descriptions are just a copy');
});

test('auditSkills finds differently named pairs whose triggers overlap', () => {
  const skills = [
    { name: 'a', description: '', body: '', file: '/a', terms: ['invoice', 'pdf', 'export', 'ledger'] },
    { name: 'b', description: '', body: '', file: '/b', terms: ['invoice', 'pdf', 'export', 'receipt'] },
    { name: 'c', description: '', body: '', file: '/c', terms: ['kubernetes', 'cluster', 'pods'] },
  ];
  const report = auditSkills(skills, { exists: () => true });
  const found = report.overlaps.find((o) => (o.a === 'a' && o.b === 'b') || (o.a === 'b' && o.b === 'a'));
  assert.ok(found, 'a↔b shares three words, so it must be caught');
  assert.ok(found.score > 0.4, `overlap score is low: ${found?.score}`);
  assert.ok(
    !report.overlaps.some((o) => o.a === 'c' || o.b === 'c'),
    'c shares nothing and must not be caught; otherwise this instrument calls anything overlapping',
  );
});

test('auditSkills does not count a same-name pair twice as an overlap', () => {
  const skills = [
    { name: 'twin', description: '', body: '', file: '/a', terms: ['alpha', 'beta', 'gamma'] },
    { name: 'twin', description: '', body: '', file: '/b', terms: ['alpha', 'beta', 'gamma'] },
  ];
  const report = auditSkills(skills, { exists: () => true });
  assert.equal(report.overlaps.length, 0, 'name collisions are counted in (1); counting them again in (2) pollutes the ranking');
});

/**
 * The core this test protects — **conditional references are not counted as
 * defects.** If this collapses, the noise of "700 things to fix" returns.
 */
test('auditSkills counts only missing own-folder references as defects, not missing conditional ones', () => {
  const skills = [
    {
      name: 'x',
      description: '',
      body: 'Read references/have.md and references/gone.md. If present, read src/maybe.js.',
      file: '/skills/x/SKILL.md',
      terms: [],
    },
  ];
  const report = auditSkills(skills, {
    exists: (p) => p.endsWith('references/have.md'),
  });
  assert.equal(report.references.bundledTotal, 2);
  assert.equal(report.references.bundledMissing.length, 1);
  assert.equal(report.references.bundledMissing[0].ref, 'references/gone.md');
  assert.equal(report.references.conditionalTotal, 1);
  assert.equal(report.references.conditionalMissing, 1, 'conditional ones are counted, but separately');
  assert.ok(
    !report.references.bundledMissing.some((m) => m.ref.includes('maybe')),
    'conditional references must not mix into the defect list',
  );
});

test('the instrument is alive: a fully clean bundle reports nothing', () => {
  const skills = [
    { name: 'one', description: '', body: 'references/a.md', file: '/s/one/SKILL.md', terms: ['alpha'] },
    { name: 'two', description: '', body: 'references/b.md', file: '/s/two/SKILL.md', terms: ['bravo'] },
  ];
  const report = auditSkills(skills, { exists: () => true });
  assert.equal(report.duplicates.length, 0);
  assert.equal(report.overlaps.length, 0);
  assert.equal(report.references.bundledMissing.length, 0);
});

test('installedPluginRoots returns only the installPath the canonical file points to', async () => {
  const { installedPluginRoots } = await import('./audit-claude-skills.mjs');
  const roots = installedPluginRoots('/home', () => ({
    version: 2,
    plugins: {
      'a@m': [{ installPath: '/home/.claude/plugins/cache/a/1.0.0' }],
      'b@m': [{ installPath: '/home/.claude/plugins/cache/b/2.0.0' }, { installPath: '/home/.claude/plugins/cache/b/2.0.0' }],
      'c@m': [{ notAPath: true }],
    },
  }));
  assert.deepEqual(roots, [
    '/home/.claude/plugins/cache/a/1.0.0',
    '/home/.claude/plugins/cache/b/2.0.0',
  ]);
});

test('installedPluginRoots returns an empty list when the canonical file is unreadable, since "could not count" beats an inflated number', async () => {
  const { installedPluginRoots } = await import('./audit-claude-skills.mjs');
  assert.deepEqual(
    installedPluginRoots('/home', () => {
      throw new Error('no manifest');
    }),
    [],
  );
});

/**
 * A reference found at the repository root is not a defect — without this check all 7
 * of our skills were reported as broken references, and all 7 existed.
 */
test('auditSkills does not count a reference found at the repository root as broken', async () => {
  const { auditSkills } = await import('./audit-claude-skills.mjs');
  const skills = [
    {
      name: 'x',
      description: '',
      body: 'Run scripts/at-repo.mjs and scripts/nowhere.mjs.',
      file: '/skills/x/SKILL.md',
      terms: [],
    },
  ];
  const report = auditSkills(skills, {
    repoRoot: '/repo',
    exists: (p) => p === '/repo/scripts/at-repo.mjs',
  });
  assert.equal(report.references.bundledTotal, 2);
  assert.equal(report.references.repoRelative, 1, 'references found at the repository root are counted separately');
  assert.deepEqual(
    report.references.bundledMissing.map((m) => m.ref),
    ['scripts/nowhere.mjs'],
    'only what exists nowhere is a defect',
  );
});
