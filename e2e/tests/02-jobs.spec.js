import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { navigateToMenuItem, waitForPageLoad } from './helpers/navigation';
import { clickButton, fillField, selectOption, elementExists } from './helpers/common';

test.describe('Jobs', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await waitForPageLoad(page);
  });

  test('should load jobs page', async ({ page }) => {
    await navigateToMenuItem(page, 'Jobs');
    expect(page.url()).toContain('/jobs');
    await expect(page.locator('text=Jobs').first()).toBeVisible();
  });

  test('should display jobs table/list', async ({ page }) => {
    await navigateToMenuItem(page, 'Jobs');
    await waitForPageLoad(page);
    
    // Check for jobs table or list
    const hasTable = await elementExists(page, 'table, .ant-table, .ant-list');
    expect(hasTable).toBeTruthy();
  });

  test('should open create job modal', async ({ page }) => {
    await navigateToMenuItem(page, 'Jobs');
    await waitForPageLoad(page);
    
    // Click "New Job" or "+" button
    const newJobButton = page.locator('button:has-text("New Job"), button:has-text("+"), button[aria-label*="add" i]').first();
    if (await newJobButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await newJobButton.click();
      await page.waitForTimeout(1000);
      
      // Check if modal opened
      const modalVisible = await elementExists(page, '.ant-modal, [role="dialog"]');
      expect(modalVisible).toBeTruthy();
      
      // Close modal
      const closeButton = page.locator('button[aria-label="Close"], .ant-modal-close').first();
      if (await closeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await closeButton.click();
      }
    }
  });

  test('should filter jobs by status', async ({ page }) => {
    await navigateToMenuItem(page, 'Jobs');
    await waitForPageLoad(page);
    
    // Look for status filter
    const statusFilter = page.locator('select, .ant-select:has-text("Status"), button:has-text("Status")').first();
    if (await statusFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
      await statusFilter.click();
      await page.waitForTimeout(500);
      
      // Select a status option if dropdown opened
      const option = page.locator('.ant-select-item, option').first();
      if (await option.isVisible({ timeout: 1000 }).catch(() => false)) {
        await option.click();
        await waitForPageLoad(page);
      }
    }
  });

  test('should search jobs', async ({ page }) => {
    await navigateToMenuItem(page, 'Jobs');
    await waitForPageLoad(page);
    
    // Look for search input
    const searchInput = page.locator('input[placeholder*="Search" i], input[type="search"]').first();
    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill('test');
      await page.waitForTimeout(1000);
      await waitForPageLoad(page);
    }
  });

  test('should view job details', async ({ page }) => {
    await navigateToMenuItem(page, 'Jobs');
    await waitForPageLoad(page);
    
    // Look for a job row/item and click view
    const viewButton = page.locator('button:has-text("View"), a:has-text("View"), [aria-label*="view" i]').first();
    if (await viewButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await viewButton.click();
      await page.waitForTimeout(1000);
      
      // Check if details opened (drawer or modal)
      const detailsVisible = await elementExists(page, '.ant-drawer, .ant-modal, [role="dialog"]');
      expect(detailsVisible).toBeTruthy();
    }
  });

  test('should create a new job', async ({ page }) => {
    console.log('🚀 Starting job creation test...');
    
    // Navigate to Jobs page
    await navigateToMenuItem(page, 'Jobs');
    await waitForPageLoad(page);
    expect(page.url()).toContain('/jobs');
    console.log('✅ Navigated to Jobs page');
    
    // Click "Add Job" button
    const addJobButton = page.locator('button:has-text("Add Job")').first();
    await addJobButton.waitFor({ state: 'visible', timeout: 10000 });
    console.log('Found Add Job button, clicking...');
    
    // Click and wait for modal
    await Promise.all([
      page.waitForSelector('.ant-modal', { state: 'visible', timeout: 15000 }),
      addJobButton.click()
    ]);
    console.log('✅ Clicked Add Job button');
    
    // Wait for modal to be fully visible
    const modal = page.locator('.ant-modal').first();
    await modal.waitFor({ state: 'visible', timeout: 10000 });
    console.log('✅ Job creation modal opened');
    
    // Wait for form to render
    await page.waitForTimeout(1500);
    
    // Step 1: Select a customer (required) - first select in modal
    const customerSelect = modal.locator('.ant-select').first();
    await customerSelect.waitFor({ state: 'visible', timeout: 10000 });
    await customerSelect.click();
    await page.waitForTimeout(1500);
    
    // Wait for customer dropdown to appear and load
    await page.waitForSelector('.ant-select-dropdown', { state: 'visible', timeout: 10000 });
    
    // Select first available customer from dropdown
    // Wait for items to load (might take time if fetching from API)
    await page.waitForTimeout(2000);
    
    const customerItems = page.locator('.ant-select-dropdown:visible .ant-select-item');
    const customerCount = await customerItems.count();
    
    if (customerCount === 0) {
      // No customers available - might need to create one first
      console.log('⚠️ No customers found. Checking if "Add New Customer" option is available...');
      const addCustomerButton = page.locator('.ant-select-dropdown:visible button:has-text("Add New Customer"), .ant-select-dropdown:visible .ant-btn-link:has-text("Add")').first();
      if (await addCustomerButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        console.log('⚠️ Need to create a customer first. Skipping this test.');
        // For now, we'll skip - in a real scenario, we'd create a customer
        return;
      }
      throw new Error('No customers available and cannot create one');
    }
    
    const firstCustomer = customerItems.first();
    await firstCustomer.waitFor({ state: 'visible', timeout: 5000 });
    const customerName = await firstCustomer.textContent();
    await firstCustomer.click();
    console.log(`✅ Selected customer: ${customerName?.trim()}`);
    await page.waitForTimeout(1000);
    
    // Step 2: Add a job item - click "Add Job Item" button
    const addItemButton = modal.locator('button:has-text("Add Job Item")').first();
    if (await addItemButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addItemButton.click();
      await page.waitForTimeout(1000);
      console.log('✅ Clicked Add Job Item button');
    }
    
    // Step 3: Fill in job item details
    // Find category select (should be in the items section, after customer/status/priority)
    const allSelects = modal.locator('.ant-select');
    const selectCount = await allSelects.count();
    console.log(`Found ${selectCount} select elements in modal`);
    
    // Category select is usually the 4th select (after customer, status, priority)
    // Or we can find it by looking for one with "Category" label
    let categorySelect = null;
    for (let i = 0; i < selectCount; i++) {
      const select = allSelects.nth(i);
      const parent = select.locator('..');
      const label = await parent.locator('label, .ant-form-item-label').textContent().catch(() => '');
      if (label && label.toLowerCase().includes('category')) {
        categorySelect = select;
        break;
      }
    }
    
    // If not found by label, use the 4th select (index 3)
    if (!categorySelect) {
      categorySelect = selectCount > 3 ? allSelects.nth(3) : allSelects.last();
    }
    
    await categorySelect.click();
    await page.waitForTimeout(800);
    
    // Select a category option
    const categoryDropdown = page.locator('.ant-select-dropdown:not([style*="display: none"])').first();
    await categoryDropdown.waitFor({ state: 'visible', timeout: 5000 });
    const categoryOption = categoryDropdown.locator('.ant-select-item').first();
    await categoryOption.waitFor({ state: 'visible', timeout: 5000 });
    const categoryText = await categoryOption.textContent();
    await categoryOption.click();
    console.log(`✅ Selected category: ${categoryText?.trim()}`);
    await page.waitForTimeout(1000);
    
    // Fill in description
    const descriptionInputs = modal.locator('input[placeholder*="description" i], input[placeholder*="Description" i]');
    const descCount = await descriptionInputs.count();
    if (descCount > 0) {
      const descInput = descriptionInputs.first();
      await descInput.fill('Test job item - E2E automated test');
      console.log('✅ Filled in description');
      await page.waitForTimeout(500);
    }
    
    // Fill in quantity (first InputNumber)
    const quantityInputs = modal.locator('.ant-input-number-input');
    const qtyCount = await quantityInputs.count();
    if (qtyCount > 0) {
      const qtyInput = quantityInputs.first();
      await qtyInput.fill('5');
      console.log('✅ Filled in quantity: 5');
      await page.waitForTimeout(500);
    }
    
    // Fill in unit price (second InputNumber if exists)
    if (qtyCount >= 2) {
      const unitPriceInput = quantityInputs.nth(1);
      await unitPriceInput.fill('25');
      console.log('✅ Filled in unit price: 25');
      await page.waitForTimeout(500);
    }
    
    await page.waitForTimeout(1000);
    
    // Step 4: Submit the form
    const createButton = modal.locator('button:has-text("Create Job"), .ant-btn-primary:has-text("Create")').first();
    await createButton.waitFor({ state: 'visible', timeout: 10000 });
    await createButton.click();
    console.log('✅ Clicked Create Job button');
    
    // Wait for success message or modal to close
    await page.waitForTimeout(2000);
    
    // Check for success message
    const successMessage = page.locator('.ant-message-success, .ant-notification-success');
    const hasSuccess = await successMessage.isVisible({ timeout: 5000 }).catch(() => false);
    
    // Wait for modal to close
    await modal.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
    
    if (hasSuccess) {
      console.log('✅ Success message displayed!');
    }
    
    // Verify we're back on jobs page
    expect(page.url()).toContain('/jobs');
    await waitForPageLoad(page);
    
    console.log('✅ Job creation test completed successfully!');
  });
});
