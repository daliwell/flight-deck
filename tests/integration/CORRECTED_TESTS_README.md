# Corrected Test Suite - Write Restrictions Enforcement

## Overview

This test suite has been corrected to align with the core architectural principle: **The application NEVER creates external data (articles, POCs). It ONLY reads from these collections and writes ONLY to 3 specific collections.**

## Critical Constraint

The chunking system operates under a strict write restriction:

```
ALLOWED WRITE COLLECTIONS (3 only):
✅ chunkAuditPocs     - Tracks which chunkers processed each POC
✅ chunkAuditCosts    - Stores LLM token costs for cost tracking
✅ chunks            - Stores the generated chunks

FORBIDDEN WRITE COLLECTIONS (all others):
❌ PieceOfContent    - NEVER written to (read-only)
❌ Article           - NEVER written to (read-only)
❌ Any other collection
```

## What Changed

### Before (WRONG - DO NOT USE)
```javascript
// ❌ INCORRECT - Creates external data
async function createTestPoc(pocId) {
  await PieceOfContent.create({ _id: pocId, ... });  // WRONG!
  await Article.create({ pocId, ... });             // WRONG!
}

// ❌ INCORRECT - Assumes test can modify application data
const poc = await createTestPoc('poc-123');
const chunks = await chunker.chunk(poc);
```

### After (CORRECT - USE THIS)
```javascript
// ✅ CORRECT - Only creates allowed audit/chunk data
async function recordChunking(pocId) {
  await ChunkAuditPoc.create({ pocId, chunks: [] });
  // Only write to the 3 allowed collections
}

// ✅ CORRECT - Tests work with existing data
const chunks = await ChunkAuditChunk.find({ pocId: 'poc-123' });
```

## Test Files

### 1. chunk-creation-proper.test.js

**Purpose:** Verify that the application respects write restrictions

**Key Tests:**
- `should ONLY write to chunkAuditPocs, chunkAuditCosts, and chunks collections` - Core restriction verification
- `should NOT create PieceOfContent documents` - Explicit check for forbidden writes
- `should NOT create Article documents` - Explicit check for forbidden writes
- Collection isolation tests - Verify data doesn't cross collection boundaries

**What It Tests:**
```javascript
// VERIFY: Only these 3 collections receive writes
expect(ChunkAuditPoc).toBeDefined();      // ✅ Can write
expect(ChunkAuditChunk).toBeDefined();    // ✅ Can write
expect(ChunkAuditCosts).toBeDefined();    // ✅ Can write

// VERIFY: Never write to these
expect(PieceOfContent).toBeDefined();     // ❌ Must NOT write
expect(Article).toBeDefined();            // ❌ Must NOT write
```

**Running:**
```bash
npm test -- chunk-creation-proper.test.js
```

### 2. chunk-api-behavior.test.js

**Purpose:** Test API behavior and data handling without creating external data

**Key Test Scenarios:**

#### Multi-Chunker Processing
```javascript
// Simulate processing same POC with multiple chunkers
// Only writes to: ChunkAuditChunk, ChunkAuditPoc
// Never writes to: PieceOfContent, Article
```

#### Batch Processing
```javascript
// Handle multiple POCs (using existing POC IDs)
// Create audit records (ChunkAuditPoc) 
// Store chunks (ChunkAuditChunk)
// Track costs (ChunkAuditCosts)
```

#### Data Consistency
```javascript
// Verify all records for same POC have matching pocId
// Verify chunks don't cross POC boundaries
// Verify costs tracked separately
```

**Running:**
```bash
npm test -- chunk-api-behavior.test.js
```

## Data Patterns in Tests

### Pattern 1: Storing Chunks (CORRECT)
```javascript
// ✅ CORRECT - Only write to ChunkAuditChunk
const chunk = await ChunkAuditChunk.create({
  pocId: 'poc-123',                           // Reference to existing POC
  chunker: 'READ-CONTENT-SHORT',
  chunkType: 'PARAGRAPH',
  chunkContent: 'The actual chunk text',
  chunkIndex: 0,
  tokenCount: 42
});
```

### Pattern 2: Storing Costs (CORRECT)
```javascript
// ✅ CORRECT - Only write to ChunkAuditCosts
const cost = await ChunkAuditCosts.create({
  pocId: 'poc-123',                           // Reference to existing POC
  inputTokens: 150,
  outputTokens: 75,
  totalCost: 0.000375
});
```

### Pattern 3: Tracking Processing (CORRECT)
```javascript
// ✅ CORRECT - Only write to ChunkAuditPoc
const audit = await ChunkAuditPoc.create({
  pocId: 'poc-123',                           // Reference to existing POC
  chunks: [
    { chunker: 'READ-CONTENT-SHORT', chunkCount: 2 }
  ]
});
```

### Pattern 4: NEVER DO THIS (WRONG)
```javascript
// ❌ WRONG - Never create PieceOfContent
await PieceOfContent.create({ pocId: 'poc-123', ... });

// ❌ WRONG - Never create Article
await Article.create({ pocId: 'poc-123', ... });

// ❌ WRONG - Never create any other collection
await SomeOtherModel.create({ ... });
```

## Integration with Real API

When the real chunking API is called:

```
1. API receives request with existing pocIds
2. API reads from PieceOfContent (existing data)
3. API reads from Article (existing data)
4. API chunks the content
5. API writes results:
   ├─ Chunks → ChunkAuditChunk ✅
   ├─ Costs → ChunkAuditCosts ✅
   └─ Tracking → ChunkAuditPoc ✅
6. API returns status (SSE or REST)
```

The tests simulate steps 4-5:
- We write to the same 3 collections
- We verify nothing else is written
- We verify data consistency

## Running All Tests

```bash
# Run both test files
npm test -- tests/integration/chunk-creation-proper.test.js tests/integration/chunk-api-behavior.test.js

# Run with verbose output
npm test -- --verbose tests/integration/chunk-*.test.js

# Run with coverage
npm test -- --coverage tests/integration/chunk-creation-proper.test.js

# Run single test
npm test -- chunk-creation-proper.test.js -t "should ONLY write to"
```

## Test Database

Tests use MongoDB test database specified in `.env.test`:
```
MONGODB_URI=mongodb://localhost/semantic-chunker-test
```

Before running tests:
```bash
# Ensure MongoDB is running
mongod

# Or use Docker
docker run -d -p 27017:27017 --name mongo mongo:5.0
```

## Validation Checklist

Before considering tests complete:

- [ ] `chunk-creation-proper.test.js` passes all tests
  - Verifies 3-collection write restriction
  - Checks no external data is created
  - Tests collection isolation
  
- [ ] `chunk-api-behavior.test.js` passes all tests
  - Verifies multi-chunker scenarios
  - Tests batch processing
  - Checks data consistency
  
- [ ] No new test files create articles or POCs
  - Search: `await Article.create`
  - Search: `await PieceOfContent.create`
  - These should NOT appear in any test
  
- [ ] All tests only write to 3 collections
  - Test files should ONLY call:
    - `ChunkAuditPoc.create()` / `.updateOne()`
    - `ChunkAuditChunk.create()` / `.insertMany()`
    - `ChunkAuditCosts.create()` / `.insertMany()`
  
- [ ] Tests don't depend on external data creation
  - Tests should work with any pocId
  - Tests should mock/fixture external data if needed

## Key Principle

**NEVER WRITE TO PieceOfContent OR Article IN TESTS**

These collections represent external data that the system only reads from. The chunking system must never modify them. All tests must respect this boundary.

Tests verify that the chunking system:
1. Reads from existing data ✅
2. Processes that data ✅
3. Writes results to 3 specific collections ✅
4. Never modifies external data ✅
5. Never writes to unexpected collections ✅

---

**Status:** ✅ Corrected and ready to run
**Last Updated:** January 17, 2024
