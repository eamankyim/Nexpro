import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { navigateToMenuItem, navigateToSubMenuItem, waitForPageLoad } from './helpers/navigation';
import { elementExists } from './helpers/common';

/**
 * Full end-to-end flow test
 * Tests the entire application in order of sidebar navigation
 */
test.describe('Full Application Flow', () => {
  test.beforeAll(async ({ browser }) => {
    // Setup: Login once
    const page = await browser.newPage();
    await login(page);
    await page.close();
  });

  test('should navigate through all main sections', async ({ page }) => {
    await login(page);
    await waitForPageLoad(page);

    // 1. Dashboard
    await navigateToMenuItem(page, 'Dashboard');
    expect(page.url()).toContain('/dashboard');
    await waitForPageLoad(page);

    // 2. Jobs
    await navigateToMenuItem(page, 'Jobs');
    expect(page.url()).toContain('/jobs');
    await waitForPageLoad(page);

    // 3. Leads
    await navigateToMenuItem(page, 'Leads');
    expect(page.url()).toContain('/leads');
    await waitForPageLoad(page);

    // 4. Customers
    await navigateToMenuItem(page, 'Customers');
    expect(page.url()).toContain('/customers');
    await waitForPageLoad(page);

    // 5. Sales & Operations -> Vendors
    await navigateToSubMenuItem(page, 'Sales & Operations', 'Vendors');
    expect(page.url()).toContain('/vendors');
    await waitForPageLoad(page);

    // 6. Financial -> Quotes
    await navigateToSubMenuItem(page, 'Financial', 'Quotes');
    expect(page.url()).toContain('/quotes');
    await waitForPageLoad(page);

    // 7. Financial -> Invoices
    await navigateToSubMenuItem(page, 'Financial', 'Invoices');
    expect(page.url()).toContain('/invoices');
    await waitForPageLoad(page);

    // 8. Financial -> Expenses
    await navigateToSubMenuItem(page, 'Financial', 'Expenses');
    expect(page.url()).toContain('/expenses');
    await waitForPageLoad(page);

    // 9. Financial -> Pricing
    await navigateToSubMenuItem(page, 'Financial', 'Pricing');
    expect(page.url()).toContain('/pricing');
    await waitForPageLoad(page);

    // 10. Financial -> Payroll
    await navigateToSubMenuItem(page, 'Financial', 'Payroll');
    expect(page.url()).toContain('/payroll');
    await waitForPageLoad(page);

    // 11. Financial -> Accounting
    await navigateToSubMenuItem(page, 'Financial', 'Accounting');
    expect(page.url()).toContain('/accounting');
    await waitForPageLoad(page);

    // 12. Resources -> Inventory
    await navigateToSubMenuItem(page, 'Resources', 'Inventory');
    expect(page.url()).toContain('/inventory');
    await waitForPageLoad(page);

    // 13. Resources -> Employees
    await navigateToSubMenuItem(page, 'Resources', 'Employees');
    expect(page.url()).toContain('/employees');
    await waitForPageLoad(page);

    // 14. Reports
    await navigateToMenuItem(page, 'Reports');
    expect(page.url()).toContain('/reports');
    await waitForPageLoad(page);

    // 15. Settings
    await navigateToMenuItem(page, 'Settings');
    expect(page.url()).toContain('/settings');
    await waitForPageLoad(page);
  });

  test('should verify all pages load without errors', async ({ page }) => {
    await login(page);
    
    const pages = [
      { name: 'Dashboard', route: '/dashboard' },
      { name: 'Jobs', route: '/jobs' },
      { name: 'Leads', route: '/leads' },
      { name: 'Customers', route: '/customers' },
      { name: 'Vendors', route: '/vendors' },
      { name: 'Quotes', route: '/quotes' },
      { name: 'Invoices', route: '/invoices' },
      { name: 'Expenses', route: '/expenses' },
      { name: 'Pricing', route: '/pricing' },
      { name: 'Payroll', route: '/payroll' },
      { name: 'Accounting', route: '/accounting' },
      { name: 'Inventory', route: '/inventory' },
      { name: 'Employees', route: '/employees' },
      { name: 'Reports', route: '/reports' },
      { name: 'Settings', route: '/settings' },
    ];

    for (const { name, route } of pages) {
      await page.goto(route);
      await waitForPageLoad(page);
      
      // Check for error messages
      const errorExists = await elementExists(page, '.ant-alert-error, [class*="error"]');
      expect(errorExists).toBeFalsy();
      
      // Check that page loaded
      expect(page.url()).toContain(route);
    }
  });
});
