/**
 * Jest Test Setup
 * 
 * This file runs before each test file.
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';
process.env.JWT_EXPIRE = '1h';

// Mock console methods during tests to reduce noise
// Uncomment if you want to suppress console output
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
//   error: jest.fn(),
// };

// Increase timeout for slow operations
jest.setTimeout(30000);

// Clean up after all tests
afterAll(async () => {
  // Add cleanup logic if needed
});
