import { describe, expect, it } from 'vitest';

import type { AcpEvent } from '../use-acp-session';
import {
  buildAcpPresentationTrace,
  presentationRelationKey,
  presentationRelationKeysForGraphEdge,
} from './presentation-trace';

const knownSlugs = new Set([
  'ontology-atlas',
  'domains/agent-integration',
  'capabilities/mcp-server',
]);

function read(
  id: string,
  slug: string,
  overrides: Partial<Extract<AcpEvent, { kind: 'tool' }>> = {},
): Extract<AcpEvent, { kind: 'tool' }> {
  return {
    kind: 'tool',
    id,
    title: 'mcp__atlas-vault__get_concept',
    toolKind: 'read',
    status: 'completed',
    rawInput: { slug, body: 'full' },
    ...overrides,
  };
}

function sourceHiddenTurn(answer: string): AcpEvent[] {
  return [
    { kind: 'user', id: 'u-1', text: '이 온톨로지의 DNA를 설명해줘.' },
    read('read-project', 'ontology-atlas'),
    read('read-domain', 'domains/agent-integration'),
    read('read-capability', 'capabilities/mcp-server'),
    { kind: 'agent', id: 'a-1', text: answer },
  ];
}

function codexRead(
  id: string,
  slugs: string[],
): Extract<AcpEvent, { kind: 'tool' }> {
  return {
    kind: 'tool',
    id,
    title: 'mcp.ontology-atlas.get_concepts',
    toolKind: 'execute',
    status: 'completed',
    rawInput: {
      server: 'ontology-atlas',
      tool: 'get_concepts',
      arguments: { slugs, body: 'full' },
    },
  };
}

const citedAnswer = [
  '### 왜 존재하나요?',
  'ontology-atlas 는 코드베이스의 제품 의미를 사람이 판단하도록 돕습니다.',
  '',
  '### 누가 책임지나요?',
  'domains/agent-integration 이 에이전트 연결 경계를 책임집니다.',
  '',
  '### 어떻게 구현되나요?',
  'capabilities/mcp-server 가 그 능력을 제공합니다. 영향의 완전성은 아직 unknown 입니다.',
].join('\n');
const presentationRequest = '이 온톨로지의 DNA를 설명해줘.';

function buildTrace(
  overrides: Partial<Parameters<typeof buildAcpPresentationTrace>[0]> = {},
) {
  return buildAcpPresentationTrace({
    intent: 'business-flow',
    expectedUserText: presentationRequest,
    sessionStatus: 'ready',
    events: sourceHiddenTurn(citedAnswer),
    knownSlugs,
    knownRelations: new Set(),
    ...overrides,
  });
}

describe('ACP ontology DNA presentation trace', () => {
  it('turns a completed source-hidden turn into scenes where citations and real read tool ids are bound', () => {
    const result = buildTrace();

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    expect(result.scenes).toHaveLength(3);
    expect(result.scenes.map((scene) => scene.focus)).toEqual([
      { slug: 'ontology-atlas', toolCallId: 'read-project' },
      { slug: 'domains/agent-integration', toolCallId: 'read-domain' },
      { slug: 'capabilities/mcp-server', toolCallId: 'read-capability' },
    ]);
    expect(result.scenes[2].qualification).toBe('limited');
    expect(result.sourceHidden).toEqual({
      proven: true,
      atlasReadCalls: 3,
      fullBodyConcepts: 3,
      toolDiscoveryCalls: 0,
      nonAtlasSourceCalls: 0,
    });
  });

  it('reads a verified dotted MCP envelope from Codex ACP as a source-hidden read too', () => {
    const result = buildTrace({
      events: [
        { kind: 'user', id: 'u-1', text: presentationRequest },
        codexRead('codex-batch', [...knownSlugs]),
        { kind: 'agent', id: 'a-1', text: citedAnswer },
      ],
    });

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    expect(result.sourceHidden).toMatchObject({
      atlasReadCalls: 1,
      fullBodyConcepts: 3,
      nonAtlasSourceCalls: 0,
    });
    expect(result.scenes.every((scene) => scene.focus.toolCallId === 'codex-batch')).toBe(true);
  });

  it('does not trust the execution row when the dotted title and the raw envelope server/tool differ', () => {
    const mismatched = codexRead('codex-batch', [...knownSlugs]);
    mismatched.rawInput = {
      server: 'other',
      tool: 'get_concepts',
      arguments: { slugs: [...knownSlugs], body: 'full' },
    };

    expect(buildTrace({
      events: [
        { kind: 'user', id: 'u-1', text: presentationRequest },
        mismatched,
        { kind: 'agent', id: 'a-1', text: citedAnswer },
      ],
    })).toMatchObject({
      status: 'blocked',
      reason: 'source_hidden_unproven',
    });
  });

  it('does not promote to a source-hidden presentation if an ordinary file tool mixes in even once', () => {
    const events = sourceHiddenTurn(citedAnswer);
    events.splice(2, 0, {
      kind: 'tool',
      id: 'source-read',
      title: 'Read src/secret.ts',
      toolKind: 'read',
      status: 'completed',
      rawInput: { file_path: 'src/secret.ts' },
    });

    expect(buildTrace({ events })).toMatchObject({
      status: 'blocked',
      reason: 'source_hidden_unproven',
    });
  });

  it('allows ToolSearch that looks for MCP tools but does not count it as scene citation evidence', () => {
    const events = sourceHiddenTurn(citedAnswer);
    events.splice(1, 0, {
      kind: 'tool',
      id: 'tool-search',
      title: 'ToolSearch',
      toolKind: 'search',
      status: 'completed',
      rawInput: { query: 'ontology atlas get concept' },
    });

    const result = buildTrace({ events });

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    expect(result.sourceHidden).toEqual({
      proven: true,
      atlasReadCalls: 3,
      fullBodyConcepts: 3,
      toolDiscoveryCalls: 1,
      nonAtlasSourceCalls: 0,
    });
  });

  it('keeps source-hidden through a failed Atlas read but does not use its result as citation evidence', () => {
    const events = sourceHiddenTurn(citedAnswer);
    events.splice(1, 0, read('failed-batch', 'ontology-atlas', { status: 'failed' }));

    const result = buildTrace({ events });

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    expect(result.sourceHidden.atlasReadCalls).toBe(4);
    expect(result.scenes[0].focus.toolCallId).toBe('read-project');
  });

  it('blocks it as not a focused presentation when full-body reads exceed 12', () => {
    const manySlugs = new Set(Array.from({ length: 13 }, (_, index) => `capabilities/c${index + 1}`));
    const events: AcpEvent[] = [
      { kind: 'user', id: 'u-1', text: '발표해줘' },
      ...[...manySlugs].map((slug, index) => read(`read-${index + 1}`, slug)),
      {
        kind: 'agent',
        id: 'a-1',
        text: [
          '### 1',
          'capabilities/c1 설명.',
          '',
          '### 2',
          'capabilities/c2 설명.',
          '',
          '### 3',
          'capabilities/c3 설명.',
        ].join('\n'),
      },
    ];

    expect(buildAcpPresentationTrace({
      intent: 'business-flow',
      expectedUserText: '발표해줘',
      sessionStatus: 'ready',
      events,
      knownSlugs: manySlugs,
      knownRelations: new Set(),
    })).toMatchObject({
      status: 'blocked',
      reason: 'full_body_read_budget_exceeded',
      target: '13',
    });
  });

  it('blocks citing a slug whose full body was not read in the current turn', () => {
    const events = sourceHiddenTurn(citedAnswer).filter((event) => event.id !== 'read-domain');

    expect(buildTrace({ events })).toMatchObject({
      status: 'blocked',
      reason: 'citation_not_read',
      target: 'domains/agent-integration',
    });
  });

  it('does not promote a neighbor mentioned beside a full-body anchor to a read-evidence chip', () => {
    const extraKnown = new Set([...knownSlugs, 'capabilities/unread-neighbor']);
    const answer = citedAnswer.replace(
      'ontology-atlas 는 코드베이스의 제품 의미를 사람이 판단하도록 돕습니다.',
      'ontology-atlas 는 코드베이스의 제품 의미를 사람이 판단하도록 돕고 capabilities/unread-neighbor 를 이웃으로 둡니다.',
    );
    const result = buildTrace({
      events: sourceHiddenTurn(answer),
      knownSlugs: extraKnown,
    });

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    expect(result.scenes[0].citations).toEqual(['ontology-atlas']);
  });

  it('blocks the whole presentation instead of silently dropping a scene without citations', () => {
    const answer = citedAnswer.replace(
      'domains/agent-integration 이 에이전트 연결 경계를 책임집니다.',
      '에이전트 연결 경계를 책임지는 영역이 있습니다.',
    );

    expect(buildTrace({ events: sourceHiddenTurn(answer) })).toMatchObject({
      status: 'blocked',
      reason: 'scene_uncited',
    });
  });

  it('does not promote the chat preamble before the first ### to a scene and validates only the explicit scenes', () => {
    const result = buildTrace({
      events: sourceHiddenTurn(`온톨로지만 읽고 정리했습니다.\n\n${citedAnswer}`),
    });

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    expect(result.scenes).toHaveLength(3);
    expect(result.scenes[0].title).toBe('왜 존재하나요?');
  });

  it('does not make a scene when a nonexistent typed relation is put in the sentence', () => {
    const relationClaim = citedAnswer.replace(
      'capabilities/mcp-server 가 그 능력을 제공합니다. 영향의 완전성은 아직 unknown 입니다.',
      'domains/agent-integration --depends_on--> capabilities/mcp-server 로 이어집니다.',
    );

    expect(buildTrace({ events: sourceHiddenTurn(relationClaim) })).toMatchObject({
      status: 'blocked',
      reason: 'relation_not_in_graph',
    });

    const allowed = buildTrace({
      events: sourceHiddenTurn(relationClaim),
      knownRelations: new Set([
        presentationRelationKey(
          'domains/agent-integration',
          'capabilities/mcp-server',
          'depends_on',
        ),
      ]),
    });
    expect(allowed.status).toBe('ready');
  });

  it('restores only the authoring relation the target kind proves from contains in the screen graph', () => {
    expect(presentationRelationKeysForGraphEdge({
      from: 'domains/agent-integration',
      to: 'capabilities/mcp-server',
      type: 'contains',
      toKind: 'capability',
    })).toEqual([
      presentationRelationKey(
        'domains/agent-integration',
        'capabilities/mcp-server',
        'contains',
      ),
      presentationRelationKey(
        'domains/agent-integration',
        'capabilities/mcp-server',
        'capabilities',
      ),
    ]);
    expect(presentationRelationKeysForGraphEdge({
      from: 'ontology-atlas',
      to: 'domains/agent-integration',
      type: 'contains',
      toKind: 'domain',
    })).toEqual([
      presentationRelationKey('ontology-atlas', 'domains/agent-integration', 'contains'),
    ]);
  });

  it('passes real scene validation for a capabilities authoring relation restored by kind', () => {
    const relationClaim = citedAnswer.replace(
      'capabilities/mcp-server 가 그 능력을 제공합니다. 영향의 완전성은 아직 unknown 입니다.',
      'domains/agent-integration --capabilities--> capabilities/mcp-server 로 이어집니다. 영향의 완전성은 아직 unknown 입니다.',
    );
    const knownRelations = new Set(presentationRelationKeysForGraphEdge({
      from: 'domains/agent-integration',
      to: 'capabilities/mcp-server',
      type: 'contains',
      toKind: 'capability',
    }));

    expect(buildTrace({
      events: sourceHiddenTurn(relationClaim),
      knownRelations,
    }).status).toBe('ready');
  });

  it('makes nothing when the turn has not ended or the intent is not a presentation', () => {
    expect(buildTrace({ sessionStatus: 'thinking' })).toMatchObject({
      status: 'blocked',
      reason: 'turn_incomplete',
    });

    expect(buildTrace({ intent: null })).toMatchObject({
      status: 'blocked',
      reason: 'intent_inactive',
    });
  });

  it('does not inherit the presentation intent in another user turn continued from the same URL', () => {
    expect(buildTrace({
      events: [
        ...sourceHiddenTurn(citedAnswer),
        { kind: 'user', id: 'u-2', text: '두 번째 장면을 더 설명해줘.' },
        read('follow-up-read', 'domains/agent-integration'),
        { kind: 'agent', id: 'a-2', text: citedAnswer },
      ],
    })).toMatchObject({ status: 'blocked', reason: 'intent_inactive' });
  });
});
