# Testing Documentation

## Overview

This document describes the comprehensive testing strategy for the Semantic Chunker application.

## Setup

### First Time Setup

When you clone the repository and run `npm install`, pre-commit hooks are **automatically installed**:

```bash
git clone <repo-url>
cd semantic-chunker
npm install  # Automatically sets up pre-commit hooks via Husky
```

The pre-commit hook will run unit and frontend tests before every commit.

### Manual Hook Installation

If hooks aren't working:
```bash
npx husky install
```

## Test Structure

```
tests/
├── setup.js                    # Global test setup and utilities
├── unit/                       # Unit tests for individual components
│   └── models/                 # Model validation tests
│       └── ChunkAuditPoc.test.js
├── integration/                # Integration tests for services
│   └── chunker-services.test.js
├── api/                        # API endpoint tests
│   └── routes.test.js
├── frontend/                   # Frontend unit tests
│   └── SemanticChunkerApp.test.js
└── e2e/                        # End-to-end tests
    └── assessment-workflow.test.js
```

## Test Categories

### 1. Unit Tests (`tests/unit/`)

Tests individual components in isolation:

- **Model Validation**: Schema validation, field requirements, data types
- **Utility Functions**: Helper functions, formatters, validators
- **Business Logic**: Calculation methods, data transformations

**Run**: `npm run test:unit` or `./run-tests.sh unit`

### 2. Integration Tests (`tests/integration/`)

Tests interactions between multiple components:

- **Chunker Services**: Text chunking, image detection, caption handling
- **Assessment Logic**: Quality scoring, issue detection
- **Database Operations**: Complex queries, nested updates

**Run**: `npm run test:integration` or `./run-tests.sh integration`

### 3. API Tests (`tests/api/`)

Tests REST API endpoints:

- **GET /api/pocs**: POC listing, filtering, pagination
- **GET /api/pocs/:pocId**: Single POC retrieval
- **POST /api/assess-chunk-quality**: Assessment creation
- **POST /api/create-chunks**: Chunk generation
- **Error Handling**: 404s, validation errors, server errors

**Run**: `npm run test:api` or `./run-tests.sh api`

### 4. Frontend Tests (`tests/frontend/`)

Tests client-side JavaScript:

- **POC Selection**: Multi-select, select all, deselect
- **Filtering**: Schema type, content type, search
- **Modal Operations**: Open, close, navigation
- **UI Updates**: Dynamic content, state management
- **Event Handlers**: Click, change, submit events

**Run**: `npm run test:frontend` or `./run-tests.sh frontend`

### 5. End-to-End Tests (`tests/e2e/`)

Tests complete user workflows with Puppeteer:

- **Assessment Workflow**: Select POC → Choose method → Run assessment → View results
- **Chunk Viewing**: Click assessment → View chunks → Check scores
- **Filtering**: Apply filters → Verify results
- **Error Scenarios**: Network failures, invalid data

**Run**: `npm run test:e2e` or `./run-tests.sh e2e`

**Note for ARM Mac Users**: E2E tests use Puppeteer which launches Chrome for browser automation. If you're running x64 Node on an ARM Mac (check with `node -p process.arch`), Chrome will be translated through Rosetta, causing significant performance degradation. For optimal e2e test performance, install ARM-native Node:

```bash
# Check current architecture
node -p process.arch

# If x64, install ARM version
nvm install v20 --arch=arm64
nvm use v20
```

E2E tests are intentionally excluded from pre-commit hooks due to their longer execution time and environment requirements.

## Running Tests

### Quick Start

```bash
# Install test dependencies
npm install --save-dev jest jest-environment-jsdom puppeteer supertest mongodb-memory-server

# Run all tests
npm test

# Or use the test runner script
chmod +x run-tests.sh
./run-tests.sh all
```

### Specific Test Suites

```bash
# Unit tests only
./run-tests.sh unit

# Integration tests
./run-tests.sh integration

# API tests
./run-tests.sh api

# Frontend tests
./run-tests.sh frontend

# E2E tests (requires server running)
./run-tests.sh e2e
```

### Coverage Report

```bash
./run-tests.sh coverage
```

Generates coverage report in `coverage/` directory. View with:
```bash
open coverage/lcov-report/index.html
```

### Watch Mode

```bash
./run-tests.sh watch
```

Automatically re-runs tests when files change.

## Writing New Tests

### Test Template

```javascript
describe('Feature Name', () => {
  beforeEach(() => {
    // Setup before each test
  });

  afterEach(() => {
    // Cleanup after each test
  });

  test('should do something specific', () => {
    // Arrange
    const input = 'test';
    
    // Act
    const result = functionUnderTest(input);
    
    // Assert
    expect(result).toBe('expected');
  });
});
```

### Best Practices

1. **Descriptive Names**: Test names should clearly describe what they test
2. **Arrange-Act-Assert**: Follow the AAA pattern
3. **One Assertion**: Each test should verify one specific behavior
4. **Independent Tests**: Tests should not depend on each other
5. **Mock External Dependencies**: Use mocks for database, API calls, etc.
6. **Clean Up**: Always clean up resources in `afterEach` or `afterAll`

## Test Helpers

Global test helpers are available in all tests (from `tests/setup.js`):

```javascript
// Create mock POC
const mockPoc = global.testHelpers.createMockPoc({
  pocId: 'custom-id',
  title: 'Custom Title'
});

// Create mock chunk
const mockChunk = global.testHelpers.createMockChunk({
  chunker: 'CUSTOM-CHUNKER'
});

// Create mock assessment
const mockAssessment = global.testHelpers.createMockAssessment({
  qualityScore: 0.9
});
```

## Continuous Integration

### GitHub Actions Example

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm test -- --coverage
      - uses: codecov/codecov-action@v2
```

## Coverage Goals

- **Overall Coverage**: > 80%
- **Critical Paths**: > 90%
  - Assessment data saving
  - Chunk creation
  - Modal operations
- **Unit Tests**: > 85%
- **Integration Tests**: > 75%

## Debugging Tests

### Run Single Test File

```bash
npm test -- tests/unit/models/ChunkAuditPoc.test.js
```

### Run Specific Test

```bash
npm test -- -t "should validate qualityScore range"
```

### Debug Mode

```bash
DEBUG_TESTS=1 npm test
```

This enables console.log output during tests.

### Puppeteer Debug

```javascript
// In test file, set headless: false
browser = await puppeteer.launch({
  headless: false,
  slowMo: 100 // Slow down by 100ms
});
```

## Known Issues and Limitations

1. **Database Tests**: Some tests require MongoDB connection
2. **E2E Tests**: Require application server to be running
3. **AI Tests**: Mock Azure OpenAI to avoid costs
4. **Timing Issues**: E2E tests may need increased timeouts on slow machines

## Future Improvements

- [ ] Add visual regression testing
- [ ] Implement mutation testing
- [ ] Add performance benchmarks
- [ ] Create load testing suite
- [ ] Add accessibility testing

## Resources

- [Jest Documentation](https://jestjs.io/)
- [Puppeteer Documentation](https://pptr.dev/)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Testing Best Practices](https://testingjavascript.com/)
