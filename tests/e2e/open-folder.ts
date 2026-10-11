import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';

/**
 * Waits until the vault is actually open: a Library route entered before opening finishes
 * bounces to the first-run gateway. Opening lands on the map, whose heading is the signal.
 * Only walks that fail without this wait use it; extra stops on the map break other walks.
 */
export async function openFolderFromFirstRun(page: Page, locale: string = 'en') {
  await page.goto(`/${locale}/docs/`);
  const door = page.getByTestId('first-run-open');
  await expect(door, 'waiting for the open-folder door').toBeVisible();
  await door.click();
  await expect(
    page.getByRole('heading', { name: (JSON.parse(readFileSync(`messages/${locale}.json`, 'utf8')) as { navRail: { map: string } }).navRail.map, level: 1 }),
    'the folder is open once the map arrives; entering the Library before this bounces to the gateway',
  ).toBeVisible({ timeout: 30_000 });
}
