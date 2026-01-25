/**
 * Navigation helpers for E2E tests
 */

/**
 * Navigate to a sidebar menu item
 * @param {import('@playwright/test').Page} page
 * @param {string} menuItem - Menu item text (e.g., 'Dashboard', 'Jobs', 'Leads')
 */
export async function navigateToMenuItem(page, menuItem) {
  // Click on the sidebar menu item
  const menuItemLocator = page.locator(`text=${menuItem}`).first();
  await menuItemLocator.click();
  
  // Wait for navigation
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000); // Give time for page to render
}

/**
 * Navigate to a submenu item
 * @param {import('@playwright/test').Page} page
 * @param {string} parentMenu - Parent menu text (e.g., 'Financial', 'Resources')
 * @param {string} subMenuItem - Submenu item text (e.g., 'Invoices', 'Employees')
 */
export async function navigateToSubMenuItem(page, parentMenu, subMenuItem) {
  // First expand parent menu if needed
  const parentLocator = page.locator(`text=${parentMenu}`).first();
  const isExpanded = await page.locator(`text=${subMenuItem}`).isVisible({ timeout: 1000 }).catch(() => false);
  
  if (!isExpanded) {
    await parentLocator.click();
    await page.waitForTimeout(500);
  }
  
  // Click submenu item
  const subMenuLocator = page.locator(`text=${subMenuItem}`).first();
  await subMenuLocator.click();
  
  // Wait for navigation
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
}

/**
 * Wait for page to be fully loaded
 * @param {import('@playwright/test').Page} page
 */
export async function waitForPageLoad(page) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
}

/**
 * Check if we're on a specific route
 * @param {import('@playwright/test').Page} page
 * @param {string} route - Route path (e.g., '/dashboard', '/jobs')
 */
export async function isOnRoute(page, route) {
  const currentUrl = page.url();
  return currentUrl.includes(route);
}
