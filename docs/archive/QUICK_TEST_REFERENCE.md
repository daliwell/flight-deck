# Quick Test Reference Guide

## Quick Commands

### Run Everything
```bash
# All chunk creation tests
npm run test:integration -- tests/integration/chunk-*.test.js

# Or quick script
bash tests/run-chunk-tests.sh all
```

### Test Single Scenario
```bash
# Single POC chunking (1 test)
npm test -- chunk-creation.test.js -t "should chunk a single POC with READ-CONTENT-SHORT"

# Batch sync (test 5 POCs)
npm test -- chunk-creation.test.js -t "should chunk 5 POCs synchronously"

# Background job (150 POCs)
npm test -- chunk-creation.test.js -t "should return job ID for large batch"

# Cost appears in response
npm test -- chunk-creation.test.js -t "should return zero cost for non-LLM"

# Progress tracking
npm test -- chunk-creation.test.js -t "should track progress for single POC"
```

### By Category
```bash
# All single POC tests
npm test -- chunk-creation.test.js -t "Single POC"

# All batch sync tests
npm test -- chunk-creation.test.js -t "Synchronous"

# All batch async tests
npm test -- chunk-creation.test.js -t "Asynchronous"

# All cost tests
npm test -- chunk-cost-tracking.test.js

# All progress tests
npm test -- chunk-progress.test.js

# All error tests
npm test -- chunk-creation.test.js -t "Error"

# All chunker type tests
npm test -- chunk-creation.test.js -t "Different Chunker"
```

## Scenarios Covered

### 1. Single POC from Button Click
```bash
npm test -- chunk-creation.test.js -t "Single POC"
```
Tests:
- ✅ POC loads correctly
- ✅ Chunks created (various chunker types)
- ✅ Saved to database
- ✅ ChunkAuditPoc updated
- ✅ Response includes cost (zero for non-LLM)
- ✅ Progress events emitted

**Expected time**: 5-10 seconds

---

### 2. Few POCs in Batch Mode (Sync)
```bash
npm test -- chunk-creation.test.js -t "Batch.*Synchronous"
```
Tests:
- ✅ 5 POCs processed together
- ✅ All chunks saved
- ✅ Statistics aggregated
- ✅ No background job ID
- ✅ Costs aggregated and returned
- ✅ Progress tracked across POCs

**Expected time**: 10-15 seconds

---

### 3. 100+ POCs in Batch Mode (Async)
```bash
npm test -- chunk-creation.test.js -t "Batch.*Asynchronous"
```
Tests:
- ✅ 150 POCs queued for background processing
- ✅ Job ID returned immediately
- ✅ Job status can be polled
- ✅ Processing completes eventually
- ✅ All chunks saved
- ✅ Costs tracked for large batch

**Expected time**: 3-5 minutes

---

### 4. Cost Appears in Response
```bash
npm test -- chunk-creation.test.js -t "Cost"
npm test -- chunk-cost-tracking.test.js
```
Tests:
- ✅ Zero cost for non-LLM chunker
- ✅ Cost present for LLM chunker
- ✅ Input/output tokens tracked separately
- ✅ Saved to ChunkAuditCosts collection
- ✅ Per-POC breakdown included
- ✅ Aggregated in batch response

**Expected time**: 10-20 seconds

---

### 5. Progress During Single POC
```bash
npm test -- chunk-progress.test.js -t "Single POC"
```
Tests:
- ✅ Progress events emitted
- ✅ Chunk-level progress tracked
- ✅ LLM progress shown separately
- ✅ Completion event sent
- ✅ Message content accurate
- ✅ Progress percentage correct

**Expected time**: 2-5 seconds

---

### 6. Progress During Multiple POCs
```bash
npm test -- chunk-progress.test.js -t "Batch"
```
Tests:
- ✅ Multiple POCs tracked
- ✅ Event ordering correct
- ✅ LLM events before embedding events
- ✅ Session isolation
- ✅ Concurrent sessions supported
- ✅ Data fields complete

**Expected time**: 2-5 seconds

---

## Test Matrix

| Test | Single | Batch(Sync) | Batch(Async) | Cost | Progress |
|------|--------|-----------|-------------|------|----------|
| `READ-CONTENT-SHORT` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `READ-CONTENT-PARA` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `READ-CONTENT-SHORT-LLM` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `READ-CONTENT-PARA-LLM` | ✅ | ✅ | ✅ | ✅ | ✅ |
| Chunks saved | ✅ | ✅ | ✅ | - | - |
| Costs returned | ✅ | ✅ | ✅ | ✅ | - |
| Progress tracked | ✅ | ✅ | ✅ | - | ✅ |
| Errors handled | ✅ | ✅ | - | - | - |

## Key Test Assertions

### Single POC Tests
```javascript
✅ response.body.success === true
✅ response.body.results.successful.length === 1
✅ response.body.results.successful[0].chunkCount > 0
✅ response.body.costs.totalCost >= 0
✅ chunks_saved_to_db > 0
✅ ChunkAuditPoc.chunks contains chunker type
```

### Batch Sync Tests
```javascript
✅ response.body.success === true
✅ response.body.results.successful.length === 5
✅ response.body.jobId === undefined (no background job)
✅ response.body.results.totalChunks > 0
✅ all_chunks_in_database === true
```

### Batch Async Tests
```javascript
✅ response.body.jobId !== undefined
✅ response.body.status === 'queued'
✅ job_eventually_completes === true
✅ processed_pocs > 0
✅ costs_aggregated === true
```

### Cost Tests
```javascript
✅ non_llm_cost === 0
✅ llm_cost >= 0
✅ costs_saved_to_db === true
✅ per_poc_breakdown_present === true
✅ cost_calculation_accurate === true
```

### Progress Tests
```javascript
✅ events_emitted > 0
✅ events_in_order === true
✅ llm_events_before_chunk_events === true
✅ completion_event_sent === true
✅ event_data_complete === true
```

## Environment Setup

Create `.env.test`:
```env
MONGODB_URI=mongodb://localhost/semantic-chunker-test
NODE_ENV=test
SESSION_SECRET=test-secret
PORT=3002
AZURE_OPENAI_API_KEY=sk-...
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_INPUT_TOKEN_COST=0.0000015
AZURE_OUTPUT_TOKEN_COST=0.000004
```

Start MongoDB:
```bash
mongod
```

Install dependencies:
```bash
npm install --save-dev jest supertest
```

## Running Tests

### All Tests
```bash
npm run test:integration -- tests/integration/chunk-*.test.js
```

### Specific Category
```bash
npm run test:integration -- chunk-creation.test.js
npm run test:integration -- chunk-cost-tracking.test.js
npm run test:integration -- chunk-progress.test.js
```

### By Name Pattern
```bash
npm test -- --testNamePattern="Single POC"
npm test -- --testNamePattern="Cost"
npm test -- --testNamePattern="Progress"
```

### With Coverage
```bash
npm test -- --coverage tests/integration/chunk-*.test.js
```

### Watch Mode
```bash
npm test -- --watch chunk-creation.test.js
```

## Expected Results

### All Tests Pass
```
PASS  tests/integration/chunk-creation.test.js
PASS  tests/integration/chunk-cost-tracking.test.js
PASS  tests/integration/chunk-progress.test.js

Tests:       71 passed, 71 total
Time:        ~7-10 minutes
```

### Single Test Pass
```
PASS  tests/integration/chunk-creation.test.js
  Single POC Chunking
    ✓ should chunk a single POC with READ-CONTENT-SHORT (250ms)
    ✓ should chunk a single POC with READ-CONTENT-PARA (280ms)
    ...
```

## Troubleshooting

### Tests Timeout
- Check MongoDB is running: `mongod`
- Increase timeout: Add `jest.setTimeout(60000)` in test
- Check database performance

### Connection Refused
- Verify MongoDB: `mongo --eval "db.version()"`
- Check connection string in `.env.test`
- Clear stale connections

### Memory Issues
- Run fewer tests at once: `--maxWorkers=2`
- Clear database: `mongod --drop`

### LLM Tests Fail
- Check Azure OpenAI keys in `.env.test`
- Verify API endpoint is accessible
- Check quota limits

## Test Data

Tests auto-create:
- **POCs**: Realistic article-like content (3-20 paragraphs)
- **Special chunks**: Images, tables, code (for LLM testing)
- **Batch sizes**: 1, 5, 150 POCs

All data is cleaned up after tests run.

## Performance Notes

| Operation | Time |
|-----------|------|
| Single POC chunk | 1-3s |
| 5 POC batch (sync) | 10-15s |
| 150 POC batch (async) | 3-5 min |
| LLM per chunk | 3-5s (parallelized 3x) |
| Cost calculation | ~100ms |
| Progress event | <10ms |

## Coverage

**71 total tests** across:
- ✅ 4 chunker types
- ✅ 3 batch modes (single, sync, async)
- ✅ 13 scenarios
- ✅ Cost tracking (6 suites, 16 tests)
- ✅ Progress tracking (6 suites, 22 tests)
- ✅ Error handling (4 tests)

---

**Last Updated**: January 17, 2026
**Status**: ✅ Ready for use
