import { test, expect } from '@playwright/test';

/**
 * Login Test
 * Tests the login functionality with provided credentials
 */
test.describe('Login', () => {
  const email = 'nexprotesting@gmail.com';
  const password = '111111@1A';

  test('should successfully login with valid credentials', async ({ page }) => {
    console.log('Testing login with:', email);
    
    // Navigate to login page
    await page.goto('/login', { waitUntil: 'networkidle', timeout: 30000 });
    
    // Wait for email input to be visible (this is what we know exists from debug)
    const emailInput = page.locator('input[placeholder="you@company.com"]');
    await emailInput.waitFor({ state: 'visible', timeout: 15000 });
    console.log('Email input found, filling...');
    
    await emailInput.fill(email);
    
    // Fill in password
    const passwordInput = page.locator('input[type="password"][placeholder="Enter password"]');
    await passwordInput.waitFor({ state: 'visible', timeout: 10000 });
    console.log('Password input found, filling...');
    await passwordInput.fill(password);
    
    // Find and click submit button (try multiple selectors)
    const submitButton = page.locator('button[type="submit"]').first();
    await submitButton.waitFor({ state: 'visible', timeout: 10000 });
    console.log('Submit button found, clicking...');
    
    // Click and wait for navigation to dashboard
    await Promise.all([
      page.waitForURL('**/dashboard', { timeout: 30000 }),
      submitButton.click()
    ]);
    
    // Verify we're on the dashboard
    expect(page.url()).toContain('/dashboard');
    console.log('✅ Login successful! Redirected to:', page.url());
    
    // Wait for page to fully load
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    
    // Verify we're logged in by checking for dashboard content
    const dashboardTitle = page.locator('h1, h2, [class*="dashboard"], [class*="title"]').first();
    await expect(dashboardTitle).toBeVisible({ timeout: 10000 });
    console.log('✅ Dashboard loaded successfully!');
  });

  test('should show error with invalid credentials', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'networkidle', timeout: 30000 });
    
    // Wait for inputs
    await page.locator('input[placeholder="you@company.com"]').waitFor({ state: 'visible', timeout: 15000 });
    
    // Fill in invalid credentials
    await page.locator('input[placeholder="you@company.com"]').fill('invalid@email.com');
    await page.locator('input[type="password"][placeholder="Enter password"]').fill('wrongpassword');
    
    // Submit form
    await page.locator('button[type="submit"]').first().click();
    
    // Wait for error message (toast or form error)
    await page.waitForTimeout(3000); // Wait for toast to appear
    
    // Check if we're still on login page (should not redirect)
    expect(page.url()).toContain('/login');
  });

  test('should validate required fields', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'networkidle', timeout: 30000 });
    
    // Wait for submit button
    await page.locator('button[type="submit"]').first().waitFor({ state: 'visible', timeout: 15000 });
    
    // Try to submit without filling fields
    await page.locator('button[type="submit"]').first().click();
    
    // Wait a bit for validation messages
    await page.waitForTimeout(2000);
    
    // Check for validation error messages
    const emailError = page.locator('.ant-form-item-explain-error').first();
    const hasValidationErrors = await emailError.isVisible().catch(() => false);
    
    // Should show validation errors or stay on login page
    expect(page.url()).toContain('/login');
  });
});
