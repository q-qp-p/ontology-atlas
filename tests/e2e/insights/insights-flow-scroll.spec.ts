import { expect, test } from '@playwright/test';

test('analysis cards reflow when a side conversation leaves a narrow content column', async ({ page }) => {
  await page.setViewportSize({ width: 1040, height: 720 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const tab of ['composition', 'connections', 'boundaries', 'freshness']) {
    await page.goto(`/ko/ontology/insights/?tab=${tab}&guides=off`);
    await page.locator('[role="tabpanel"]').waitFor();
    await page.evaluate(() => {
      const main = document.querySelector('main')!;
      const column = main.parentElement!;
      column.style.flex = 'none';
      column.style.width = '546px';
    });
    await expect.poll(async () => page.evaluate(() => {
      const main = document.querySelector('main')!;
      const grids = [...main.querySelectorAll('[data-testid="analysis-layout"]')];
      return grids.length > 0 && grids.every((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length === 1);
    }), { message: `${tab} should stack inside the narrower Analysis column` }).toBe(true);
  }
});
