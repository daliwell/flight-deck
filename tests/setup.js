// Jest setup file for Flight Deck tests
require('dotenv').config({ path: '.env.test' });

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '3006';
process.env.SKIP_AUTH = 'true'; // Skip OAuth in tests
process.env.SESSION_SECRET = 'test-secret-key';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Increase timeout for integration tests
jest.setTimeout(30000);
