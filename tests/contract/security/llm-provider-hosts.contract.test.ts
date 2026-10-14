// Named vendors' destinations — blocks drift between Rust (which sends) and the web
// (which words the screen).
//
// The screen names the host "where this request goes" **before** the user presses
// [check connection]. A sentence that differs from the real destination is not a typo
// but a false security claim (trust charter ⑥ — we say only what we can prove).
//
// The source of truth is the check URL in `llm/verify.rs`, which cannot be
// imported into the same process. So this uses the same pattern as the audit log:
// **both sides read the same fixture.** On the Rust side
// `the_hosts_match_the_shared_fixture_the_screen_promises` proves "the host I
// actually call == this fixture", and this test proves "this fixture == the host the
// screen promises".
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  SECRET_PROVIDERS,
  SECRET_PROVIDER_HOSTS,
} from '@/shared/lib/llm-connection/tauri-secrets';

const FIXTURE = join(__dirname, '../../fixtures/llm-provider-hosts.json');

const fixture = JSON.parse(readFileSync(FIXTURE, 'utf-8')) as {
  hosts: Record<string, string>;
};

describe('named vendor destination contract (Rust transport to web wording)', () => {
  it('the hosts the screen promises equal the hosts Rust really calls', () => {
    expect(SECRET_PROVIDER_HOSTS).toEqual(fixture.hosts);
  });

  it('every allowed vendor states its destination, so no vendor sends silently', () => {
    expect([...SECRET_PROVIDERS].sort()).toEqual(Object.keys(fixture.hosts).sort());
  });

  it('named vendors are frozen at 3', () => {
    // A fourth is added only when both hold: it cannot be absorbed through Bearer
    // compatibility, and there is evidence of demand. Full rationale: the PROVIDERS
    // comment in `src-tauri/src/secrets.rs`.
    expect(SECRET_PROVIDERS).toHaveLength(3);
  });
});
