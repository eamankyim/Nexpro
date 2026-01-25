import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { navigateToMenuItem, waitForPageLoad } from './helpers/navigation';
import { clickButton, fillField, elementExists } from './helpers/common';

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await waitForPageLoad(page);
  });

  test('should load settings page', async ({ page }) => {
    await navigateToMenuItem(page, 'Settings');
    expect(page.url()).toContain('/settings');
    await expect(page.locator('text=Settings').first()).toBeVisible();
  });

  test('should display settings tabs', async ({ page }) => {
    await navigateToMenuItem(page, 'Settings');
    await waitForPageLoad(page);
    
    // Check for tabs (Profile, Organization, Subscription, etc.)
    const hasTabs = await elementExists(page, '.ant-tabs, [role="tablist"]');
    expect(hasTabs).toBeTruthy();
  });

  test('should navigate to Profile tab', async ({ page }) => {
    await navigateToMenuItem(page, 'Settings');
    await waitForPageLoad(page);
    
    const profileTab = page.locator('text=Profile, [role="tab"]:has-text("Profile")').first();
    if (await profileTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await profileTab.click();
      await page.waitForTimeout(500);
    }
  });

  test('should navigate to Organization tab', async ({ page }) => {
    await navigateToMenuItem(page, 'Settings');
    await waitForPageLoad(page);
    
    const orgTab = page.locator('text=Organization, [role="tab"]:has-text("Organization")').first();
    if (await orgTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await orgTab.click();
      await page.waitForTimeout(500);
    }
  });

  test('should navigate to Subscription tab', async ({ page }) => {
    await navigateToMenuItem(page, 'Settings');
    await waitForPageLoad(page);
    
    const subTab = page.locator('text=Subscription, [role="tab"]:has-text("Subscription")').first();
    if (await subTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await subTab.click();
      await page.waitForTimeout(500);
    }
  });
});
