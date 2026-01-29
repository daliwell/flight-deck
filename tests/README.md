# Flight Deck Test Suite

## Overview

Flight Deck uses Jest for testing with multiple test categories:

- **Unit Tests**: Test individual functions and modules in isolation
- **API Tests**: Test API endpoints and route handlers
- **Integration Tests**: Test interactions between services
- **Frontend Tests**: Test browser-side JavaScript
- **E2E Tests**: End-to-end workflow tests (future)

## Running Tests

```bash
# Run all tests with coverage
npm test

# Run specific test suites
npm run test:unit         # Unit tests only
npm run test:api          # API endpoint tests
npm run test:integration  # Integration tests
npm run test:frontend     # Frontend tests
npm run test:e2e          # End-to-end tests

# Watch mode for development
npm run test:watch

# CI mode (for GitHub Actions)
npm run test:ci
```

## Test Structure

```
tests/
├── setup.js                    # Test configuration
├── unit/                       # Unit tests
│   ├── canApi.test.js         # CAN API service
│   ├── concordApi.test.js     # Concord API service
│   └── auth.middleware.test.js # Auth middleware
├── api/                        # API endpoint tests
│   ├── health.test.js         # Health check endpoint
│   └── auth.routes.test.js    # Auth routes
├── integration/                # Integration tests
│   └── api-integration.test.js # Full API workflows
├── frontend/                   # Frontend tests
│   └── app.test.js            # Main app functionality
└── e2e/                        # End-to-end tests (future)
```

## Test Environment

Tests use `.env.test` for environment variables. Key settings:

- `NODE_ENV=test`
- `SKIP_AUTH=true` (bypasses OAuth in tests)
- Test API tokens (non-functional)
- Test database connection (if needed)

## Pre-Commit Hook

The pre-commit hook runs:
- Unit tests (`npm run test:unit`)
- API tests (`npm run test:api`)

Integration tests are skipped as they require live API connections.

## Writing New Tests

### Unit Test Example

```javascript
describe('MyService', () => {
  it('should do something', () => {
    const result = myService.doSomething();
    expect(result).toBe(expected);
  });
});
```

### API Test Example

```javascript
const request = require('supertest');

describe('GET /api/endpoint', () => {
  it('should return 200', async () => {
    const response = await request(app).get('/api/endpoint');
    expect(response.status).toBe(200);
  });
});
```

## Mocking

### Mocking External APIs

```javascript
jest.mock('../../src/services/canApi');
canApi.getAttendees.mockResolvedValue([...]);
```

### Mocking Authentication

```javascript
req.isAuthenticated = jest.fn().mockReturnValue(true);
req.user = { email: 'test@sandsmedia.com', domain: 'sandsmedia.com' };
```

## Coverage

Test coverage reports are generated in the `coverage/` directory:

- `coverage/lcov-report/index.html` - HTML coverage report
- `coverage/lcov.info` - LCOV format for CI tools

Minimum coverage targets:
- Overall: 80%
- Critical paths (auth, API): 90%

## CI/CD Integration

Tests run automatically on:
- Pre-commit (unit + API tests)
- GitHub Actions (full test suite)
- Before production deployment

## Future Improvements

- [ ] Add E2E tests with Puppeteer
- [ ] Add printer driver integration tests
- [ ] Add load testing for API endpoints
- [ ] Add visual regression testing
- [ ] Increase coverage to 90%+
