import { stripLocalePrefix } from '@/shared/lib/navigation/nav-destination';

/**
 * Active-tab matching: `matchPrefixes` with startsWith first, then an exact match with or without a
 * trailing slash.
 */
export function isBottomTabActive(
  pathname: string,
  href: string,
  matchPrefixes: ReadonlyArray<string>,
): boolean {
  const normalized = stripLocalePrefix(pathname);
  if (matchPrefixes.some((p) => normalized.startsWith(p))) return true;
  return normalized === href || normalized === href.replace(/\/$/, '');
}

export function shouldHideBottomTabBar(pathname: string, _hasLoadedVault: boolean): boolean {
  const normalized = stripLocalePrefix(pathname).replace(/\/$/, '') || '/';
  // `/download` is the one standalone page with its own header nav. Keep the bar on `/` regardless
  // of vault state: below `lg` nothing else covers navigation for first-run visitors.
  if (normalized === '/download') return true;
  return false;
}

