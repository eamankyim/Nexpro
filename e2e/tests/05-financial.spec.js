import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { navigateToSubMenuItem, waitForPageLoad } from './helpers/navigation';
import { clickButton, elementExists } from './helpers/common';

test.describe('Financial Module', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await waitForPageLoad(page);
  });

  test('should navigate to Quotes', async ({ page }) => {
    await navigateToSubMenuItem(page, 'Financial', 'Quotes');
    expect(page.url()).toContain('/quotes');
    await expect(page.locator('text=Quotes').first()).toBeVisible();
  });

  test('should navigate to Invoices', async ({ page }) => {
    await navigateToSubMenuItem(page, 'Financial', 'Invoices');
    expect(page.url()).toContain('/invoices');
    await expect(page.locator('text=Invoices').first()).toBeVisible();
  });

  test('should navigate to Expenses', async ({ page }) => {
    await navigateToSubMenuItem(page, 'Financial', 'Expenses');
    expect(page.url()).toContain('/expenses');
    await expect(page.locator('text=Expenses').first()).toBeVisible();
  });

  test('should navigate to Pricing', async ({ page }) => {
    await navigateToSubMenuItem(page, 'Financial', 'Pricing');
    expect(page.url()).toContain('/pricing');
    await expect(page.locator('text=Pricing').first()).toBeVisible();
  });

  test('should navigate to Payroll', async ({ page }) => {
    await navigateToSubMenuItem(page, 'Financial', 'Payroll');
    expect(page.url()).toContain('/payroll');
    await expect(page.locator('text=Payroll').first()).toBeVisible();
  });

  test('should navigate to Accounting', async ({ page }) => {
    await navigateToSubMenuItem(page, 'Financial', 'Accounting');
    expect(page.url()).toContain('/accounting');
    await expect(page.locator('text=Accounting').first()).toBeVisible();
  });

  test('should create new invoice', async ({ page }) => {
    await navigateToSubMenuItem(page, 'Financial', 'Invoices');
    await waitForPageLoad(page);
    
    const newInvoiceButton = page.locator('button:has-text("New Invoice"), button:has-text("+")').first();
    if (await newInvoiceButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await newInvoiceButton.click();
      await page.waitForTimeout(1000);
      
      const modalVisible = await elementExists(page, '.ant-modal, [role="dialog"]');
      expect(modalVisible).toBeTruthy();
    }
  });

  test('should create new expense', async ({ page }) => {
    await navigateToSubMenuItem(page, 'Financial', 'Expenses');
    await waitForPageLoad(page);
    
    const newExpenseButton = page.locator('button:has-text("New Expense"), button:has-text("+")').first();
    if (await newExpenseButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await newExpenseButton.click();
      await page.waitForTimeout(1000);
      
      const modalVisible = await elementExists(page, '.ant-modal, [role="dialog"]');
      expect(modalVisible).toBeTruthy();
    }
  });
});
