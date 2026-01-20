// Global test setup
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Mock environment variables for tests
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-secret';
process.env.PORT = '3006'; // Different port for tests

// Global test utilities
global.testHelpers = {
  createMockPoc: (overrides = {}) => ({
    pocId: 'test-poc-123',
    title: 'Test POC',
    text: 'Test content',
    schemaType: 'ARTICLE',
    contentType: 'READ',
    chunks: [],
    ...overrides
  }),
  
  createMockChunk: (overrides = {}) => ({
    chunker: 'DEFAULT-1024T',
    assessments: [],
    ...overrides
  }),
  
  createMockAssessment: (overrides = {}) => ({
    method: 'basic-heuristics',
    qualityScore: 0.75,
    assessmentCost: 0,
    updatedAt: new Date(),
    qualityAssessments: [],
    ...overrides
  })
};

// Suppress console during tests unless explicitly needed
if (!process.env.DEBUG_TESTS) {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };
}
