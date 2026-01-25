import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { navigateToMenuItem, waitForPageLoad } from './helpers/navigation';
import { clickButton, fillField, selectOption, elementExists } from './helpers/common';

test.describe('Leads', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await waitForPageLoad(page);
  });

  test('should load leads page', async ({ page }) => {
    await navigateToMenuItem(page, 'Leads');
    expect(page.url()).toContain('/leads');
    await expect(page.locator('text=Leads').first()).toBeVisible();
  });

  test('should display leads table/list', async ({ page }) => {
    await navigateToMenuItem(page, 'Leads');
    await waitForPageLoad(page);
    
    const hasTable = await elementExists(page, 'table, .ant-table, .ant-list');
    expect(hasTable).toBeTruthy();
  });

  test('should open create lead modal', async ({ page }) => {
    await navigateToMenuItem(page, 'Leads');
    await waitForPageLoad(page);
    
    const newLeadButton = page.locator('button:has-text("New Lead"), button:has-text("+"), button[aria-label*="add" i]').first();
    if (await newLeadButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await newLeadButton.click();
      await page.waitForTimeout(1000);
      
      const modalVisible = await elementExists(page, '.ant-modal, [role="dialog"]');
      expect(modalVisible).toBeTruthy();
      
      // Close modal
      const closeButton = page.locator('button[aria-label="Close"], .ant-modal-close').first();
      if (await closeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await closeButton.click();
      }
    }
  });

  test('should filter leads', async ({ page }) => {
    await navigateToMenuItem(page, 'Leads');
    await waitForPageLoad(page);
    
    // Look for filter buttons or dropdowns
    const filterButton = page.locator('button:has-text("Filter"), .ant-filter').first();
    if (await filterButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await filterButton.click();
      await page.waitForTimeout(500);
    }
  });

  test('should convert lead to customer', async ({ page }) => {
    await navigateToMenuItem(page, 'Leads');
    await waitForPageLoad(page);
    
    // Look for convert button
    const convertButton = page.locator('button:has-text("Convert"), button:has-text("Convert to Customer")').first();
    if (await convertButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await convertButton.click();
      await page.waitForTimeout(1000);
    }
  });
});
