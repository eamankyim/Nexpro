/**
 * Authentication helpers for E2E tests
 */

/**
 * Login to the application
 * @param {import('@playwright/test').Page} page
 * @param {string} email - User email
 * @param {string} password - User password
 */
export async function login(page, email = 'nexprotesting@gmail.com', password = '111111@1A') {
  await page.goto('/login', { waitUntil: 'networkidle', timeout: 30000 });
  
  // Wait for email input (using placeholder selector)
  const emailInput = page.locator('input[placeholder="you@company.com"]');
  await emailInput.waitFor({ state: 'visible', timeout: 15000 });
  await emailInput.fill(email);
  
  // Fill in password
  const passwordInput = page.locator('input[type="password"][placeholder="Enter password"]');
  await passwordInput.waitFor({ state: 'visible', timeout: 10000 });
  await passwordInput.fill(password);
  
  // Click submit
  const submitButton = page.locator('button[type="submit"]').first();
  await submitButton.waitFor({ state: 'visible', timeout: 10000 });
  
  // Wait for navigation to dashboard
  await Promise.all([
    page.waitForURL('**/dashboard', { timeout: 30000 }),
    submitButton.click()
  ]);
  
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
}

/**
 * Logout from the application
 * @param {import('@playwright/test').Page} page
 */
export async function logout(page) {
  // Click on user menu (usually in header)
  const userMenu = page.locator('[data-testid="user-menu"], .ant-dropdown-trigger').last();
  if (await userMenu.isVisible()) {
    await userMenu.click();
    await page.waitForTimeout(500);
    
    // Click logout
    const logoutButton = page.locator('text=Logout').last();
    await logoutButton.click();
    
    // Wait for redirect to login
    await page.waitForURL('**/login', { timeout: 10000 });
  }
}

/**
 * Check if user is logged in
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<boolean>}
 */
export async function isLoggedIn(page) {
  try {
    // Check if we're on dashboard or if user menu is visible
    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      return false;
    }
    
    // Check for user menu or dashboard elements
    const userMenu = page.locator('[data-testid="user-menu"], .ant-avatar').first();
    return await userMenu.isVisible({ timeout: 2000 });
  } catch {
    return false;
  }
}
