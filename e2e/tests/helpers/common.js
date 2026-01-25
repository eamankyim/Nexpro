/**
 * Common test helpers
 */

/**
 * Wait for element to be visible and interactable
 * @param {import('@playwright/test').Page} page
 * @param {string} selector - CSS selector or text
 * @param {number} timeout - Timeout in milliseconds
 */
export async function waitForElement(page, selector, timeout = 10000) {
  await page.waitForSelector(selector, { state: 'visible', timeout });
}

/**
 * Click a button by text
 * @param {import('@playwright/test').Page} page
 * @param {string} buttonText - Button text
 */
export async function clickButton(page, buttonText) {
  const button = page.locator(`button:has-text("${buttonText}")`).first();
  await button.waitFor({ state: 'visible', timeout: 10000 });
  await button.click();
  await page.waitForTimeout(500);
}

/**
 * Fill a form field
 * @param {import('@playwright/test').Page} page
 * @param {string} label - Field label
 * @param {string} value - Value to fill
 */
export async function fillField(page, label, value) {
  const field = page.locator(`label:has-text("${label}")`).locator('..').locator('input, textarea, select').first();
  await field.waitFor({ state: 'visible', timeout: 10000 });
  await field.fill(value);
}

/**
 * Select dropdown option
 * @param {import('@playwright/test').Page} page
 * @param {string} label - Field label
 * @param {string} option - Option text to select
 */
export async function selectOption(page, label, option) {
  const dropdown = page.locator(`label:has-text("${label}")`).locator('..').locator('.ant-select').first();
  await dropdown.click();
  await page.waitForTimeout(300);
  
  const optionLocator = page.locator(`.ant-select-item:has-text("${option}")`).first();
  await optionLocator.click();
  await page.waitForTimeout(300);
}

/**
 * Check if element exists
 * @param {import('@playwright/test').Page} page
 * @param {string} selector - CSS selector
 * @returns {Promise<boolean>}
 */
export async function elementExists(page, selector) {
  try {
    await page.waitForSelector(selector, { timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Take a screenshot with a descriptive name
 * @param {import('@playwright/test').Page} page
 * @param {string} name - Screenshot name
 */
export async function takeScreenshot(page, name) {
  await page.screenshot({ path: `screenshots/${name}.png`, fullPage: true });
}
