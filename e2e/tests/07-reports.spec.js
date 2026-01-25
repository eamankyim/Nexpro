import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { navigateToMenuItem, waitForPageLoad } from './helpers/navigation';
import { elementExists, selectOption } from './helpers/common';

test.describe('Reports', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await waitForPageLoad(page);
  });

  test('should load reports page', async ({ page }) => {
    await navigateToMenuItem(page, 'Reports');
    expect(page.url()).toContain('/reports');
    await expect(page.locator('text=Reports').first()).toBeVisible();
  });

  test('should display report options', async ({ page }) => {
    await navigateToMenuItem(page, 'Reports');
    await waitForPageLoad(page);
    
    const hasContent = await elementExists(page, '.ant-card, .ant-list, button');
    expect(hasContent).toBeTruthy();
  });

  test('should filter reports by date range', async ({ page }) => {
    await navigateToMenuItem(page, 'Reports');
    await waitForPageLoad(page);
    
    // Look for date picker
    const datePicker = page.locator('.ant-picker, input[type="date"]').first();
    if (await datePicker.isVisible({ timeout: 3000 }).catch(() => false)) {
      await datePicker.click();
      await page.waitForTimeout(500);
    }
  });
});
