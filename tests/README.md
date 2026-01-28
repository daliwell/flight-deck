# Flight Deck - Test Suite

## Overview

**Note:** This test suite is currently outdated and needs to be rewritten for the Flight Deck badge printing application. The existing tests are for the previous Semantic Chunker application.

## Current Status

⚠️ **Tests Disabled**: Pre-commit hooks are currently disabled as the test suite needs to be updated.

The application has been completely refactored from a content chunking application to a conference badge printing application. All tests need to be rewritten to cover:

- Event/course fetching from Concord GraphQL API
- Attendee data retrieval from CAN GraphQL API
- IndexedDB local storage functionality
- Google OAuth authentication with domain restriction
- Badge printing workflow
- Frontend event selection and attendee management

## Planned Test Structure

```
tests/
├── setup.js                               # Global test configuration
├── unit/                                  # Unit tests
│   ├── services/
│   │   ├── concordApi.test.js            # Concord API client tests
│   │   └── canApi.test.js                # CAN API client tests
│   └── middleware/
│       └── auth.test.js                   # Authentication middleware
├── integration/                           # Integration tests
│   ├── event-loading.test.js             # Event fetching and grouping
│   └── attendee-sync.test.js             # Attendee synchronization
├── api/                                   # API endpoint tests
│   ├── courses.test.js                   # Course API endpoints
│   ├── attendees.test.js                 # Attendee API endpoints
│   └── auth.test.js                      # Authentication routes
├── frontend/                              # Frontend tests
│   ├── event-selection.test.js           # Event selection UI
│   ├── attendee-display.test.js          # Attendee list and search
│   └── indexeddb.test.js                 # Local storage
└── e2e/                                   # End-to-end tests
    ├── event-workflow.test.js            # Complete event selection flow
    └── badge-printing.test.js            # Badge printing workflow
```

## Running Tests (Currently Disabled)

```bash
# These will fail until tests are rewritten
npm test                    # Run all tests
npm run test:unit          # Run unit tests
npm run test:integration   # Run integration tests
npm run test:api           # Run API tests
npm run test:frontend      # Run frontend tests
npm run test:e2e           # Run end-to-end tests
```

## TODO

- [ ] Remove old Semantic Chunker tests
- [ ] Set up test fixtures for Concord and CAN API mocking
- [ ] Write unit tests for GraphQL API clients
- [ ] Write integration tests for event/attendee data flow
- [ ] Write API endpoint tests with authentication
- [ ] Write frontend tests for IndexedDB and UI components
- [ ] Write E2E tests for complete workflows
- [ ] Re-enable pre-commit hooks
- [ ] Set up CI/CD with automated testing

## Test Data Requirements

When writing new tests, you'll need:
- Mock Concord API responses (courses/events)
- Mock CAN API responses (privateAttendees)
- Test Google OAuth tokens
- Sample event and attendee data
- IndexedDB test fixtures
- **Critical Paths**: >90% (assessment data saving, chunk creation, modal operations)
- **Unit Tests**: >85%
- **Integration Tests**: >75%

## 🎯 Pre-Implementation Verification

Before adding the Assessment Details Modal:

```bash
# 1. Run full test suite
./run-tests.sh all

# 2. Verify coverage
./run-tests.sh coverage
open coverage/lcov-report/index.html

# 3. Manual testing
# See ASSESSMENT_MODAL_TESTS.md for detailed checklist
```

## ✅ Key Test Areas

### Database Operations
- ✅ Assessment data saves with nested structure
- ✅ `findOneAndUpdate` prevents version conflicts
- ✅ Individual chunk assessments in `chunks[].assessments[].qualityAssessments[]`
- ✅ AI costs accumulate correctly

### Modal Operations
- ✅ Chunk View Modal opens/closes
- ✅ POC View Modal opens/closes
- ✅ Assessment Method Modal works
- ✅ Progress tracking during assessment

### Assessment Workflow
- ✅ Basic heuristics assessment
- ✅ AI advanced assessment
- ✅ Progress updates via SSE
- ✅ Data persistence

### UI Components
- ✅ POC selection (single & multi)
- ✅ Filtering by schema/content type
- ✅ Search functionality
- ✅ Copy to clipboard
- ✅ Toast notifications

## 🔧 Development Workflow

### Watch Mode (During Development)
```bash
./run-tests.sh watch
```

### Test Specific Feature
```bash
npm test -- -t "Assessment"
npm test -- tests/frontend/SemanticChunkerApp.test.js
```

### Debug Tests
```bash
DEBUG_TESTS=1 npm test
```

## 📝 Writing New Tests

### Example Test Structure
```javascript
describe('Feature Name', () => {
  beforeEach(() => {
    // Setup
  });

  test('should do something', () => {
    // Arrange
    const input = 'test';
    
    // Act
    const result = functionUnderTest(input);
    
    // Assert
    expect(result).toBe('expected');
  });
});
```

### Test Helpers
```javascript
// Available globally from tests/setup.js
const mockPoc = global.testHelpers.createMockPoc();
const mockChunk = global.testHelpers.createMockChunk();
const mockAssessment = global.testHelpers.createMockAssessment();
```

## 🔄 CI/CD Integration

### Pre-commit Hook (Automatic)

Pre-commit hooks are **automatically installed** when you run `npm install`, thanks to Husky.

The hook runs fast tests (unit + frontend) before each commit:
```bash
# Tests run automatically on commit
git commit -m "your message"
```

**What runs:**
- Unit tests (`npm run test:unit`)
- Frontend tests (`npm run test:frontend`)

**Skip if needed** (not recommended):
```bash
git commit -m "message" --no-verify
```

**Troubleshooting:**
If hooks aren't working:
```bash
# Re-install hooks
npm install
# Or manually initialize
npx husky install
```

### GitHub Actions (Example)
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm run test:ci
```

## 📚 Documentation

- **[TESTING.md](TESTING.md)** - Comprehensive testing guide
- **[ASSESSMENT_MODAL_TESTS.md](ASSESSMENT_MODAL_TESTS.md)** - Modal-specific test checklist
- **[jest.config.js](jest.config.js)** - Jest configuration
- **[run-tests.sh](run-tests.sh)** - Test runner script

## 🐛 Troubleshooting

### Tests Won't Run
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### E2E Tests Fail
```bash
# Ensure server is running
npm start &
sleep 5
./run-tests.sh e2e
```

### Slow Tests
```bash
# Run only fast tests
npm run test:unit
npm run test:frontend
```

## 🎉 Success Criteria

Before deploying changes:

- ✅ All tests pass
- ✅ Coverage >80%
- ✅ No console errors
- ✅ E2E tests pass
- ✅ Manual checklist complete

## 📞 Support

- Check test output for specific errors
- Review test files for examples
- See documentation in TESTING.md
- Enable debug mode: `DEBUG_TESTS=1 npm test`

---

**Ready to add the Assessment Details Modal?** ✨

Follow the test checklist in [ASSESSMENT_MODAL_TESTS.md](ASSESSMENT_MODAL_TESTS.md) to ensure no existing functionality breaks!
