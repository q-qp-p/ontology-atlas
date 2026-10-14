import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildCompactAgentBrief } from './agent-brief-compact.mjs';

const project = { slug: 'project', frontmatter: { kind: 'project', title: 'Operations' }, body: 'Local operations.' };
const capability = (slug, body, title = 'Archive Catalog') => ({
  slug: `capabilities/${slug}`, frontmatter: { kind: 'capability', title }, body,
});
const literalBlocks = {
  fence: (text) => `\`\`\`md\n${text}\n\`\`\``,
  tilde: (text) => `~~~~md\n${text}\n~~~\n~~~~`,
  comment: (text) => `<!--\n${text}\n-->`,
  html: (text) => `<pre>\n${text}\n</pre>`,
  indentation: (text) => text.split('\n').map((line) => `    ${line}`).join('\n'),
  quote: (text) => text.split('\n').map((line) => `> ${line}`).join('\n'),
};

function select(candidates, task = 'Rotate encryption keys.') {
  const docs = [project, ...candidates];
  return buildCompactAgentBrief({
    brief: { projectSlug: 'project', meaningRepair: { workflow: [], stopWhen: ['source_not_current'] } },
    artifact: { nodes: docs.map((doc) => ({ slug: doc.slug, ...doc.frontmatter })), edges: [] },
    docs, task,
  });
}

describe('authored capability claims', () => {
  it('does not select a capability from literal Includes or legacy fields', () => {
    for (const [name, wrap] of Object.entries(literalBlocks)) {
      for (const body of [
        `## Definition\n\nMaintains archive indexes.\n\n## Includes\n\n${wrap('Rotate encryption keys.')}`,
        wrap('## Includes\n\nRotate encryption keys.'),
        `## Inclusions / Exclusions\n\n${wrap('- Included: Rotate encryption keys.')}`,
      ]) {
        const result = select([capability('catalog', body)]);
        assert.equal(result.focus.capability, null, `${name}: ${body}`);
        assert.equal(result.focus.refusal.reason, 'no_match');
        assert.equal(result.focus.taskNavigation.primary, null);
        assert.equal(result.safety.automaticWrite, false);
      }
    }
    const real = select([capability('catalog', '## Includes\n\nRotate encryption keys.')]);
    assert.equal(real.focus.capability?.slug, 'capabilities/catalog');
  });

  it('does not create or erase a task boundary from a literal Excludes block', () => {
    for (const [name, wrap] of Object.entries(literalBlocks)) {
      const body = `## Includes\n\nRotate encryption keys.\n\n## Excludes\n\n${wrap('Rotate encryption keys. Send mail.')}`;
      const result = select([capability('catalog', body)], 'Rotate encryption keys. Do not send mail.');
      assert.equal(result.focus.capability?.slug, 'capabilities/catalog', name);
      const exclusion = capability('catalog', `## Includes\n\nRotate encryption keys. Send mail.\n\n## Excludes\n\n${wrap('Send mail.')}`);
      const refused = select([exclusion], 'Rotate encryption keys. Do not send mail.');
      assert.equal(refused.focus.capability, null, name);
      assert.equal(refused.focus.refusal.reason, 'boundary_conflict');
    }
  });

  it('chooses the genuine owner in either order and still refuses a genuine tie', () => {
    const example = capability('catalog', '## Includes\n\n<!--\nRotate encryption keys.\n-->');
    const owner = capability('key-maintenance', '## Includes\n\nRotate encryption keys.', 'Key Maintenance');
    for (const candidates of [[example, owner], [owner, example]]) {
      const result = select(candidates);
      assert.equal(result.focus.capability?.slug, owner.slug);
      assert.equal(result.focus.refusal, undefined);
    }
    const tie = select([owner, { ...owner, slug: 'capabilities/other-maintenance' }]);
    assert.equal(tie.focus.capability, null);
    assert.equal(tie.focus.refusal.reason, 'ambiguous');
  });

  it('uses authored opening prose without falling back to a literal-only body', () => {
    for (const wrap of Object.values(literalBlocks)) {
      const candidate = capability('catalog', wrap('Rotate encryption keys.'), 'Encryption Catalog');
      assert.equal(select([candidate]).focus.capability, null);
      const real = select([{ ...candidate, body: `${candidate.body}\n\nRotate encryption keys.` }]);
      assert.equal(real.focus.capability?.slug, candidate.slug);
    }
    const structured = capability('catalog', '## Includes\n\n```md\nRotate encryption keys.\n```\n\n## Uncertainty\n\nEncryption has not been inspected.', 'Encryption Catalog');
    assert.equal(select([structured]).focus.capability, null);
  });

  it('keeps authored legacy continuations and nested exclusions effective', () => {
    const body = '## Inclusions / Exclusions\n\n- **Included**: Rotate encryption keys\n  after approval.\n  - Excluded: Send mail.\n- Excluded: Delete backups.\n';
    const candidate = capability('catalog', body);
    const result = select([candidate], 'Rotate encryption keys after approval. Do not send mail.');
    assert.equal(result.focus.capability?.slug, candidate.slug);
    assert.equal(select([candidate], 'Delete backups.').focus.capability, null);
  });

  it('does not describe the selected capability using a hidden Definition example', () => {
    const candidate = capability('key-maintenance', '## Definition\n\n<!--\nDelete every backup.\n-->\n\nRotate encryption keys after approval.\n\n## Includes\n\nRotate encryption keys.', 'Key Maintenance');
    const result = select([candidate]);
    assert.equal(result.focus.capability?.slug, candidate.slug);
    assert.ok(result.focus.capability.statement.includes('after approval'));
    assert.ok(!result.focus.capability.statement.includes('Delete every backup'));
  });

  it('retains normalized headings, localized claims and deeply nested authored prose', () => {
    const local = capability('catalog', '## Ｉｎｃｌｕｄｅｓ\n\n- 암호화 키를 교체합니다.\n\n## Excludes\n\n- 메일 발송.', '자료 목록');
    assert.equal(select([local], '암호화 키를 교체합니다.').focus.capability?.slug, local.slug);
    const nested = '*a '.repeat(3000) + 'Rotate encryption keys.' + ' a*'.repeat(3000);
    const deep = capability('catalog', `## Includes\n\n${nested}`);
    assert.equal(select([deep]).focus.capability?.slug, deep.slug);
    assert.equal(select([]).focus.capability, null);
  });

  it('carries every selected formatted-heading condition into the handoff', () => {
    const condition = 'Rotate encryption keys only after a human approves each rotation.';
    for (const heading of ['## **Includes**', '## Includes ##', '   ## Includes', 'Includes\n---', '## Ｉｎｃｌｕｄｅｓ']) {
      const candidate = capability('catalog', `${heading}\n\n${condition}\n\n## Excludes\n\nSend mail.`);
      const result = select([candidate]);
      assert.equal(result.focus.capability?.slug, candidate.slug, heading);
      assert.ok(result.focus.qualifiers.units.some((unit) => unit.section === 'Includes' && unit.text === condition), heading);
      assert.ok(result.handoffPrompt.includes(JSON.stringify(condition)), heading);
    }
  });
});
