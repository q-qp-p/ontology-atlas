import { describe, expect, it } from 'vitest';

import type { AcpEvent, PendingPermission } from '../use-acp-session';
import { deriveAcpTurnActivity, deriveAcpTurnToolActivity } from './acp-turn-activity';

const known = new Set(['capabilities/reviewed-ontology-writing']);

describe('deriveAcpTurnActivity', () => {
  it('extracts the goal and target from a waiting verification tool', () => {
    const events: AcpEvent[] = [
      { kind: 'user', id: 'u1', text: '관계 편집 흐름을 확인해줘' },
      {
        kind: 'tool',
        id: 't1',
        title: 'validate_vault',
        toolKind: 'read',
        status: 'pending',
        rawInput: { slug: 'capabilities/reviewed-ontology-writing' },
      },
    ];
    expect(deriveAcpTurnActivity('thinking', events, null, known)).toEqual({
      state: 'verifying',
      summary: '관계 편집 흐름을 확인해줘',
      ontologySlug: 'capabilities/reviewed-ontology-writing',
      toolName: 'validate_vault',
    });
  });

  it('says blocked when waiting for permission from a person', () => {
    const pending = {
      request: {
        title: null,
        toolCallId: 'tool-relation',
        toolName: 'mcp__atlas-vault__add_relation',
        toolKind: 'write',
        filePath: null,
        rawInput: { from: 'capabilities/reviewed-ontology-writing' },
        reviewKind: 'ontology-write',
        options: [],
      },
      resolve: () => undefined,
    } satisfies PendingPermission;
    expect(
      deriveAcpTurnActivity(
        'thinking',
        [{ kind: 'user', id: 'u1', text: '관계를 추가해줘' }],
        pending,
        known,
      ),
    ).toMatchObject({ state: 'blocked', summary: '관계를 추가해줘' });
  });

  it('creates no activity when nobody has the turn', () => {
    expect(deriveAcpTurnActivity('ready', [], null, known)).toBeNull();
  });

  it('passes only real waiting tools and permission waits as a structured snapshot', () => {
    const pendingTool: AcpEvent[] = [{
      kind: 'tool',
      id: 'read-source',
      title: 'read_source',
      toolKind: 'read',
      status: 'pending',
      rawInput: { path: 'sources/plan.txt' },
    }];
    expect(deriveAcpTurnToolActivity('thinking', pendingTool, null)).toEqual({
      id: 'read-source',
      toolKind: 'read',
      status: 'pending',
      rawInput: { path: 'sources/plan.txt' },
      pendingPermission: false,
    });
    expect(deriveAcpTurnToolActivity('ready', pendingTool, null)).toBeNull();
  });

  it('does not revive a cancelled tool of the previous turn after a new person turn', () => {
    const events: AcpEvent[] = [
      { kind: 'user', id: 'u1', text: '첫 번째 요청' },
      {
        kind: 'tool',
        id: 'old-read',
        title: 'Read old',
        toolKind: 'read',
        status: 'pending',
        rawInput: { path: 'sources/old.md' },
      },
      { kind: 'tool', id: 'old-read-finished', title: 'Read old', toolKind: 'read', status: 'cancelled' },
      { kind: 'user', id: 'u2', text: '두 번째 요청' },
    ];
    expect(deriveAcpTurnToolActivity('thinking', events, null)).toBeNull();
  });
});
