import { describe, expect, it } from 'vitest';

import { GIT_DOWNLOAD_URL, gitInstallGuide , gitHostPlatformFrom} from './git-install-guide';

/**
 * Install commands run **in the user's terminal**, so a typo fails somewhere we
 * never see — it reaches none of our logs. These strings are pinned here.
 */
describe('gitInstallGuide', () => {
  it('gives a first-choice command for all three platforms', () => {
    for (const platform of ['macos', 'windows', 'linux'] as const) {
      const guide = gitInstallGuide(platform);
      expect(guide.platform).toBe(platform);
      expect(guide.primary.command, `${platform} primary`).toBeTruthy();
    }
  });

  it('the first choice is a path that needs no extra tool', () => {
    // Requiring brew first would add a step on macOS; Command Line Tools is Apple's
    // own path. On Windows, winget ships with the OS.
    expect(gitInstallGuide('macos').primary.command).toBe('xcode-select --install');
    expect(gitInstallGuide('windows').primary.command).toBe('winget install --id Git.Git -e');
  });

  it('brew appears only as an alternative on macOS (not the first choice)', () => {
    const macos = gitInstallGuide('macos');
    expect(macos.primary.command).not.toContain('brew');
    expect(macos.alternatives.some((a) => a.command === 'brew install git')).toBe(true);
  });

  it('every platform has the official download escape hatch', () => {
    for (const platform of ['macos', 'windows', 'linux'] as const) {
      const hrefs = gitInstallGuide(platform).alternatives.map((a) => a.href);
      expect(hrefs, `${platform} fallback`).toContain(GIT_DOWNLOAD_URL);
    }
  });

  it('a link-only option has a null command (nothing to paste)', () => {
    const download = gitInstallGuide('linux').alternatives.find((a) => a.href === GIT_DOWNLOAD_URL);
    expect(download?.command).toBeNull();
  });

  it('an unknown value falls back to macOS, which beats a blank screen', () => {
    expect(gitInstallGuide('freebsd' as never).platform).toBe('macos');
  });
});

describe('gitHostPlatformFrom', () => {
  it.each([
    ['MacIntel', 'macos'],
    ['darwin', 'macos'],
    ['iPhone', 'macos'],
    ['Win32', 'windows'],
    ['Windows NT 10.0', 'windows'],
    ['Linux x86_64', 'linux'],
  ])('%s → %s', (input, expected) => {
    expect(gitHostPlatformFrom(input)).toBe(expected);
  });

  it('an unrecognized platform falls back to linux, and the download link is in all three guides', () => {
    expect(gitHostPlatformFrom('')).toBe('linux');
    expect(gitHostPlatformFrom('SomethingNew')).toBe('linux');
    const guide = gitInstallGuide(gitHostPlatformFrom(''));
    expect(guide.alternatives.some((o) => o.href), 'no download link').toBe(true);
  });
});
