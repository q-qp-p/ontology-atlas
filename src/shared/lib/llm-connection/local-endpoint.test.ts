import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearLocalEndpoint,
  countChatCapableModels,
  hostOfBaseUrl,
  isEmbeddingOnlyModel,
  isLocalEndpointReady,
  parseOpenAiModelList,
  readLocalEndpoint,
  readLocalVerdict,
  writeLocalEndpoint,
} from './local-endpoint';
import type { LlmVerifyResult } from './tauri-secrets';

function verifyResult(overrides: Partial<LlmVerifyResult>): LlmVerifyResult {
  return {
    provider: 'local',
    ok: false,
    denied: false,
    httpStatus: null,
    message: null,
    durationMs: 12,
    loggedAt: '2026-08-01T00:00:00.000Z',
    body: null,
    ...overrides,
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('installed model list', () => {
  it('takes only the names from an OpenAI-compatible list', () => {
    const body = JSON.stringify({
      object: 'list',
      data: [
        { id: 'qwen3:8b', object: 'model', owned_by: 'library' },
        { id: 'gemma4:12b', object: 'model', owned_by: 'library' },
      ],
    });
    expect(parseOpenAiModelList(body)).toEqual(['gemma4:12b', 'qwen3:8b']);
  });

  it('does not guess embedding-only models by name and drop them', () => {
    // The OpenAI-compatible list does not carry that fact. Dropping them would make
    // the screen deny something the user's runner actually has; if an unusable model
    // is picked, relaying the runner's own error is the honest answer.
    const body = JSON.stringify({
      data: [{ id: 'nomic-embed-text:latest' }, { id: 'qwen3:8b' }],
    });
    expect(parseOpenAiModelList(body)).toContain('nomic-embed-text:latest');
  });

  it('an embedding-only model cannot become number 1 (alphabetical order loses to usefulness)', () => {
    // Alphabetical order would select an embedding-only model first and save it as connected.
    const body = JSON.stringify({
      data: [
        { id: 'qwen3:8b' },
        { id: 'embeddinggemma:latest' },
        { id: 'nomic-embed-text:latest' },
        { id: 'gemma3:12b' },
        { id: 'bge-m3:latest' },
        { id: 'all-minilm:latest' },
        { id: 'llama3.2:3b' },
      ],
    });
    const models = parseOpenAiModelList(body);
    // The first three are the chat-capable ones, alphabetical among themselves as before.
    expect(models.slice(0, 3)).toEqual(['gemma3:12b', 'llama3.2:3b', 'qwen3:8b']);
    // The four embedding models move down but **do not disappear** — ranking is not hiding.
    expect(models.slice(3)).toEqual([
      'all-minilm:latest',
      'bge-m3:latest',
      'embeddinggemma:latest',
      'nomic-embed-text:latest',
    ]);
  });

  it('a broken or empty body is an empty list, not an exception', () => {
    expect(parseOpenAiModelList('')).toEqual([]);
    expect(parseOpenAiModelList('not json')).toEqual([]);
    expect(parseOpenAiModelList('{"data":"nope"}')).toEqual([]);
    expect(parseOpenAiModelList('{"data":[{"noid":1}]}')).toEqual([]);
  });
});

describe('embedding-only detection', () => {
  it('treats a name containing embed as an embedding model', () => {
    for (const name of [
      'embeddinggemma:latest',
      'nomic-embed-text:latest',
      'mxbai-embed-large',
      'snowflake-arctic-embed2:568m',
      'granite-embedding:278m',
      'qwen3-embedding:8b',
      'text-embedding-3-small',
    ]) {
      expect(isEmbeddingOnlyModel(name), name).toBe(true);
    }
  });

  it('also detects known families that lack the word embed', () => {
    for (const name of [
      'bge-m3:latest',
      'gte-large',
      'e5-mistral-7b-instruct',
      'all-minilm:22m',
      'paraphrase-multilingual:latest',
    ]) {
      expect(isEmbeddingOnlyModel(name), name).toBe(true);
    }
  });

  it('does not mistake a chat model for an embedding model', () => {
    for (const name of [
      'qwen3:8b',
      'gemma3:12b',
      'llama3.2:3b',
      'deepseek-r1:14b',
      'mistral-small:latest',
      'gpt-oss:20b',
      'phi4:latest',
    ]) {
      expect(isEmbeddingOnlyModel(name), name).toBe(false);
    }
  });

  it('the chat-capable count excludes only models confirmed as embedding', () => {
    expect(
      countChatCapableModels([
        'qwen3:8b',
        'embeddinggemma:latest',
        'bge-m3:latest',
        'gemma3:12b',
      ]),
    ).toBe(2);
  });
});

describe('failure reasons are told apart', () => {
  it('with no status code the runner is off or the port differs', () => {
    // Collapsing this into "we couldn't check" leaves the user unable to tell
    // whether to start the runner or fix the address.
    const verdict = readLocalVerdict(
      verifyResult({ httpStatus: null, message: '그 주소에서 응답이 없어요' }),
    );
    expect(verdict.reason).toBe('unreachable');
  });

  it('a 404 means connected but not an OpenAI-compatible address', () => {
    const verdict = readLocalVerdict(verifyResult({ httpStatus: 404 }));
    expect(verdict.reason).toBe('not-compatible');
  });

  it('a 200 with an empty list means no model is installed', () => {
    const verdict = readLocalVerdict(
      verifyResult({ ok: true, httpStatus: 200, body: '{"data":[]}' }),
    );
    expect(verdict.reason).toBe('no-models');
    expect(verdict.models).toEqual([]);
  });

  it('a 200 with a list passes, and the choices come along', () => {
    const verdict = readLocalVerdict(
      verifyResult({ ok: true, httpStatus: 200, body: '{"data":[{"id":"qwen3:8b"}]}' }),
    );
    expect(verdict.reason).toBe('ok');
    expect(verdict.models).toEqual(['qwen3:8b']);
  });
});

describe('settings storage', () => {
  it('an address without a model is not yet usable', () => {
    // Sent as is, the first round trip dies with "model is required" and the user
    // has no idea what they left out.
    expect(isLocalEndpointReady({ baseUrl: 'http://localhost:11434', model: '' })).toBe(false);
    expect(isLocalEndpointReady({ baseUrl: '', model: 'qwen3:8b' })).toBe(false);
    expect(isLocalEndpointReady({ baseUrl: 'http://localhost:11434', model: 'qwen3:8b' })).toBe(
      true,
    );
  });

  it('a full round of write, read and clear', () => {
    writeLocalEndpoint({ baseUrl: 'http://localhost:1234/v1 ', model: ' qwen3:8b ' });
    expect(readLocalEndpoint()).toEqual({
      baseUrl: 'http://localhost:1234/v1',
      model: 'qwen3:8b',
    });
    clearLocalEndpoint();
    expect(readLocalEndpoint().model).toBe('');
  });

  it('a broken value only needs to look the same as a missing one', () => {
    window.localStorage.setItem('ontology-atlas:local-endpoint', '{{{');
    expect(readLocalEndpoint().model).toBe('');
    expect(readLocalEndpoint().baseUrl).toBe('http://localhost:11434');
  });
});

describe('destination host', () => {
  it('the port is part of the fact, in the same syntax as the value kept in the audit line', () => {
    expect(hostOfBaseUrl('http://localhost:11434')).toBe('localhost:11434');
    expect(hostOfBaseUrl('http://localhost:1234/v1')).toBe('localhost:1234');
    expect(hostOfBaseUrl('https://box.example.com:8080/v1')).toBe('box.example.com:8080');
  });
});
