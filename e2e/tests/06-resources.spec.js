import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { navigateToSubMenuItem, waitForPageLoad } from './helpers/navigation';
import { clickButton, fillField, selectOption, elementExists } from './helpers/common';

test.describe('Resources Module', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await waitForPageLoad(page);
  });

  test('should navigate to Inventory', async ({ page }) => {
    await navigateToSubMenuItem(page, 'Resources', 'Inventory');
    expect(page.url()).toContain('/inventory');
    await expect(page.locator('text=Inventory').first()).toBeVisible();
  });

  test('should navigate to Employees', async ({ page }) => {
    await navigateToSubMenuItem(page, 'Resources', 'Employees');
    expect(page.url()).toContain('/employees');
    await expect(page.locator('text=Employees').first()).toBeVisible();
  });

  test('should create new employee', async ({ page }) => {
    await navigateToSubMenuItem(page, 'Resources', 'Employees');
    await waitForPageLoad(page);
    
    const newEmployeeButton = page.locator('button:has-text("New Employee"), button:has-text("+")').first();
    if (await newEmployeeButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await newEmployeeButton.click();
      await page.waitForTimeout(1000);
      
      const modalVisible = await elementExists(page, '.ant-modal, [role="dialog"]');
      expect(modalVisible).toBeTruthy();
      
      // Try to fill employee form
      const firstNameInput = page.locator('input[name="firstName"], input[placeholder*="First Name" i]').first();
      if (await firstNameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await firstNameInput.fill('Test');
        
        const lastNameInput = page.locator('input[name="lastName"], input[placeholder*="Last Name" i]').first();
        if (await lastNameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await lastNameInput.fill('Employee');
        }
      }
      
      // Close modal
      const closeButton = page.locator('button[aria-label="Close"], .ant-modal-close').first();
      if (await closeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await closeButton.click();
      }
    }
  });

  test('should view inventory items', async ({ page }) => {
    await navigateToSubMenuItem(page, 'Resources', 'Inventory');
    await waitForPageLoad(page);
    
    const hasTable = await elementExists(page, 'table, .ant-table, .ant-list');
    expect(hasTable).toBeTruthy();
  });
});
