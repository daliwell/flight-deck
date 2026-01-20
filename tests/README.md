# Semantic Chunker - Comprehensive Test Suite

## 📋 Overview

This test suite ensures the reliability and stability of the Semantic Chunker application before and after adding new features like the Assessment Details Modal.

## 🚀 Quick Start

```bash
# Install test dependencies
npm install

# Run all tests
npm test

# Or use the test runner
./run-tests.sh all
```

## 📁 Test Structure

```
tests/
├── setup.js                               # Global test configuration
├── unit/                                  # Unit tests
│   └── models/
│       └── ChunkAuditPoc.test.js         # Model validation
├── integration/                           # Integration tests
│   └── chunker-services.test.js          # Service interactions
├── api/                                   # API endpoint tests
│   └── routes.test.js                    # REST API testing
├── frontend/                              # Frontend tests
│   └── SemanticChunkerApp.test.js        # UI component testing
└── e2e/                                   # End-to-end tests
    └── assessment-workflow.test.js       # Complete user workflows
```

## 🧪 Test Categories

| Category | Purpose | Command | Speed |
|----------|---------|---------|-------|
| Unit | Test individual components | `npm run test:unit` | ⚡ Fast |
| Integration | Test component interactions | `npm run test:integration` | 🐢 Medium |
| API | Test REST endpoints | `npm run test:api` | 🐢 Medium |
| Frontend | Test UI components | `npm run test:frontend` | ⚡ Fast |
| E2E | Test complete workflows | `npm run test:e2e` | 🐌 Slow |

## 📊 Coverage Goals

- **Overall**: >80%
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
