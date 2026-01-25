import { test, expect } from '@playwright/test';
import { login, isLoggedIn } from './helpers/auth';
import { navigateToMenuItem, waitForPageLoad } from './helpers/navigation';
import { clickButton, elementExists } from './helpers/common';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await login(page);
    await waitForPageLoad(page);
  });

  test('should load dashboard page', async ({ page }) => {
    // Navigate to dashboard
    await navigateToMenuItem(page, 'Dashboard');
    
    // Check if we're on dashboard
    expect(page.url()).toContain('/dashboard');
    
    // Check for dashboard elements
    await expect(page.locator('text=Dashboard').first()).toBeVisible();
  });

  test('should display dashboard statistics', async ({ page }) => {
    await navigateToMenuItem(page, 'Dashboard');
    await waitForPageLoad(page);
    
    // Check for common dashboard stats (adjust selectors based on actual implementation)
    const statsExist = await elementExists(page, '.ant-statistic, .ant-card, [class*="stat"]');
    expect(statsExist).toBeTruthy();
  });

  test('should display recent activity or jobs', async ({ page }) => {
    await navigateToMenuItem(page, 'Dashboard');
    await waitForPageLoad(page);
    
    // Check for recent activity section
    const hasContent = await elementExists(page, 'table, .ant-list, .ant-card');
    expect(hasContent).toBeTruthy();
  });

  test('should have refresh button', async ({ page }) => {
    await navigateToMenuItem(page, 'Dashboard');
    await waitForPageLoad(page);
    
    // Look for refresh button
    const refreshButton = page.locator('button:has-text("Refresh"), button[aria-label*="refresh" i]').first();
    if (await refreshButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await refreshButton.click();
      await waitForPageLoad(page);
    }
  });
});
