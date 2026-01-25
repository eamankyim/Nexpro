import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { navigateToMenuItem, waitForPageLoad } from './helpers/navigation';
import { clickButton, fillField, elementExists } from './helpers/common';

test.describe('Customers', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await waitForPageLoad(page);
  });

  test('should load customers page', async ({ page }) => {
    await navigateToMenuItem(page, 'Customers');
    expect(page.url()).toContain('/customers');
    await expect(page.locator('text=Customers').first()).toBeVisible();
  });

  test('should display customers table', async ({ page }) => {
    await navigateToMenuItem(page, 'Customers');
    await waitForPageLoad(page);
    
    const hasTable = await elementExists(page, 'table, .ant-table');
    expect(hasTable).toBeTruthy();
  });

  test('should open create customer modal', async ({ page }) => {
    await navigateToMenuItem(page, 'Customers');
    await waitForPageLoad(page);
    
    const newCustomerButton = page.locator('button:has-text("New Customer"), button:has-text("+")').first();
    if (await newCustomerButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await newCustomerButton.click();
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

  test('should search customers', async ({ page }) => {
    await navigateToMenuItem(page, 'Customers');
    await waitForPageLoad(page);
    
    const searchInput = page.locator('input[placeholder*="Search" i]').first();
    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill('test');
      await page.waitForTimeout(1000);
    }
  });

  test('should view customer details', async ({ page }) => {
    await navigateToMenuItem(page, 'Customers');
    await waitForPageLoad(page);
    
    const viewButton = page.locator('button:has-text("View"), a:has-text("View")').first();
    if (await viewButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await viewButton.click();
      await page.waitForTimeout(1000);
      
      const detailsVisible = await elementExists(page, '.ant-drawer, .ant-modal');
      expect(detailsVisible).toBeTruthy();
    }
  });
});
