import { describe, expect, it } from 'vitest';

import { matchSlashCommands, readSlashCommands, slashQuery } from './slash-commands';

describe('reading the command list', () => {
  it('reads only what arrived', () => {
    expect(
      readSlashCommands({
        sessionUpdate: 'available_commands_update',
        availableCommands: [
          { name: 'init', description: '이 폴더를 훑어요' },
          { name: 'clear' },
        ],
      }),
    ).toEqual([
      { name: 'init', description: '이 폴더를 훑어요' },
      { name: 'clear', description: '' },
    ]);
  });

  it('returns an empty list when nothing arrives, inventing no missing feature', () => {
    expect(readSlashCommands({})).toEqual([]);
    expect(readSlashCommands(null)).toEqual([]);
    expect(readSlashCommands({ availableCommands: 'nope' })).toEqual([]);
  });

  it('drops only the malformed entries and keeps the rest', () => {
    const out = readSlashCommands({
      availableCommands: [{ name: '  ' }, null, 7, { name: 'ok' }],
    });
    expect(out.map((c) => c.name)).toEqual(['ok']);
  });

  it('uses a name once when it arrives twice', () => {
    const out = readSlashCommands({
      availableCommands: [{ name: 'a', description: '첫째' }, { name: 'a', description: '둘째' }],
    });
    expect(out).toEqual([{ name: 'a', description: '첫째' }]);
  });
});

describe('whether the compose box is choosing a command', () => {
  it('is choosing when it starts with a slash', () => {
    expect(slashQuery('/')).toBe('');
    expect(slashQuery('/on')).toBe('on');
  });

  it('has passed the choosing stage once whitespace appears, since arguments are already being typed', () => {
    expect(slashQuery('/skill 인자')).toBeNull();
    expect(slashQuery('/ ')).toBeNull();
  });

  it('is not choosing for ordinary speech', () => {
    expect(slashQuery('안녕')).toBeNull();
    expect(slashQuery('a/b')).toBeNull();
    expect(slashQuery('')).toBeNull();
  });
});

describe('filtering', () => {
  const commands = [
    { name: 'ontology-sync', description: '' },
    { name: 'ontology-bootstrap', description: '' },
    { name: 'clear', description: '' },
  ];

  it('shows everything when the query is empty', () => {
    expect(matchSlashCommands(commands, '')).toHaveLength(3);
  });

  it('matches anywhere in the name, with no reason to match only the first letters', () => {
    expect(matchSlashCommands(commands, 'boot').map((c) => c.name)).toEqual(['ontology-bootstrap']);
    expect(matchSlashCommands(commands, 'ONTOLOGY')).toHaveLength(2);
  });

  it('returns an empty list when nothing matches', () => {
    expect(matchSlashCommands(commands, 'zzz')).toEqual([]);
  });
});
