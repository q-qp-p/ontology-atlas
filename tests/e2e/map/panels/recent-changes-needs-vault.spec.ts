import { expect, test } from '@playwright/test';

import { waitForAnimationsDone } from '../../settle';

/**
 * On the sample, recent changes is 0 because the fixture dates are not real, so the dialog must
 * offer the next action (why plus where, `surfaces.md`). Modality, centring, focus and Esc need
 * a rendered screen.
 */

/* One page load walks the whole contract rather than paying the map's load per property. */
test('recent changes: the path from the sample to a folder opens and closes as a modal', async ({ page }) => {
  await page.setViewportSize({ width: 1512, height: 900 });
  // The page's scripts have loaded (so the chip answers a press) and its toolbar is at rest.
  await page.goto('/ko/topology/?guides=off', { waitUntil: 'networkidle' });
  const chip = page.getByTestId('topology-spotlight-toggle');
  await expect(chip).toBeVisible();
  await waitForAnimationsDone(page.locator('body'));

  // On the sample it presses — it is not blocked as disabled.
  await expect(chip).toBeEnabled();
  const before = page.url();

  await chip.click();
  const dialog = page.getByTestId('recent-changes-needs-vault-dialog');
  await expect(dialog).toBeVisible();
  // Both the why and the where must be present — one alone is either an apology or an order.
  await expect(dialog).toContainText('폴더');
  await expect(page.getByTestId('recent-changes-needs-vault-open')).toBeVisible();
  // Opening it moves focus to the next action.
  await expect(page.getByTestId('recent-changes-needs-vault-open')).toBeFocused();
  // It does not switch the lens on: a lens with nothing to highlight would be left on.
  expect(page.url(), '`?recent=` must not be appended').toBe(before);

  // `design.md`: a modal must **prove** a dim/scrim or blocked interaction.
  const scrim = page.getByTestId('recent-changes-needs-vault-scrim');
  await expect(scrim).toBeVisible();
  const alpha = await scrim.evaluate((el) => {
    const m = /rgba?\(([^)]+)\)/.exec(getComputedStyle(el).backgroundColor);
    const parts = m ? m[1].split(',').map(Number) : [];
    return parts.length > 3 ? parts[3] : 1;
  });
  expect(alpha, 'a transparent scrim makes it a floating card, not a modal').toBeGreaterThan(0.2);

  // Escape and a press on the scrim both close it.
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await chip.click();
  await expect(dialog).toBeVisible();
  // Press the scrim's edge, not the card.
  await page.mouse.click(40, 40);
  await expect(dialog).toBeHidden();
});
