import { describe, expect, it } from 'vitest';

import { agentDisplayName } from './agent-display-name';

describe('agentDisplayName', () => {
  it.each([
    ['codex-mcp-client', 'Codex'],
    ['codex-acp', 'Codex'],
    ['claude-code', 'Claude Code'],
    ['claude-acp', 'Claude Agent'],
    ['ontology-atlas-cli', 'Atlas CLI'],
  ])('turns internal id %s into product name %s', (raw, expected) => {
    expect(agentDisplayName(raw)).toBe(expected);
  });

  it('keeps the name an unknown agent announced for itself', () => {
    expect(agentDisplayName('my-review-agent')).toBe('my-review-agent');
  });

  it('never invents a name for an empty one', () => {
    expect(agentDisplayName(null)).toBeNull();
    expect(agentDisplayName('   ')).toBeNull();
  });
});
