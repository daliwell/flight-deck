# Chunk Creation Tests

Comprehensive integration tests for chunk creation functionality across multiple scenarios.

## Test Files

### 1. `chunk-creation.test.js`
Core API integration tests for chunk creation functionality.

**Scenarios Covered:**
- **Single POC Chunking**: Creating chunks from a single POC via API
- **Batch Chunking - Synchronous**: Processing 5 POCs synchronously (< 50 POCs threshold)
- **Batch Chunking - Asynchronous**: Processing 150 POCs in background (> 50 POCs threshold)
- **Cost Tracking**: Verifying cost data flows through responses
- **Progress Tracking**: Validating session-based progress tracking
- **Error Handling**: Graceful handling of invalid inputs
- **Chunker Type Support**: Testing all 4 chunker variants

**Test Suites:**

#### Single POC Chunking
- ✅ Chunks a single POC with READ-CONTENT-SHORT
- ✅ Chunks a single POC with READ-CONTENT-PARA
- ✅ Saves chunks to database for single POC
- ✅ Updates ChunkAuditPoc record after chunking
- ✅ Returns proper chunker type in response
- ✅ Handles invalid POC gracefully

#### Batch Chunking - Synchronous
- ✅ Chunks 5 POCs synchronously
- ✅ Processes all 5 POCs with chunks saved
- ✅ Does not return background job ID for small batch
- ✅ Aggregates statistics for batch

#### Batch Chunking - Asynchronous
- ✅ Returns job ID for large batch (100+ POCs)
- ✅ Queries job status
- ✅ Processes background job eventually

#### Cost Tracking
- ✅ Returns zero cost for non-LLM chunker
- ✅ Tracks cost for LLM chunker
- ✅ Saves LLM costs to database
- ✅ Includes cost details in response

#### Progress Tracking
- ✅ Tracks progress for single POC with sessionId
- ✅ Tracks progress for batch POCs with sessionId
- ✅ Provides completed event after processing

#### Error Handling
- ✅ Handles missing pocIds
- ✅ Handles empty pocIds array
- ✅ Handles invalid chunkerType
- ✅ Handles non-READ content type

#### Different Chunker Types
- ✅ Supports READ-CONTENT-SHORT
- ✅ Supports READ-CONTENT-PARA
- ✅ Supports READ-CONTENT-SHORT-LLM
- ✅ Supports READ-CONTENT-PARA-LLM
- ✅ Produces different chunk counts for different chunkers

---

### 2. `chunk-cost-tracking.test.js`
Specialized tests for LLM cost tracking functionality.

**Scenarios Covered:**
- **Cost Calculation**: Verifying costs are calculated correctly
- **Cost Persistence**: Ensuring costs are saved to database
- **Cost Aggregation**: Summing costs across batches
- **Cost Response Format**: Validating response structure
- **Cost Edge Cases**: Handling unusual scenarios

**Test Suites:**

#### Cost Calculation for LLM Chunkers
- ✅ Includes costs in response for LLM chunker
- ✅ Has zero cost for non-LLM chunker
- ✅ Tracks input tokens separately from output tokens

#### Cost Persistence to Database
- ✅ Saves LLM costs to ChunkAuditCosts collection
- ✅ Includes token counts in database records
- ✅ Calculates cost using configured token prices

#### Cost Aggregation in Batch Mode
- ✅ Sums costs across multiple POCs
- ✅ Includes per-POC cost breakdown in batch response
- ✅ Handles mixed LLM and non-LLM in same batch

#### Cost Response Format
- ✅ Has consistent cost response structure
- ✅ Formats costs with appropriate precision
- ✅ Includes pocId in each cost detail

#### Cost Edge Cases
- ✅ Handles zero-token responses gracefully
- ✅ Handles very large token counts
- ✅ Recovers if cost calculation partially fails

#### Cost Consistency
- ✅ Produces consistent costs for same POC with same chunker

---

### 3. `chunk-progress.test.js`
Specialized tests for progress event tracking during chunking.

**Scenarios Covered:**
- **ProgressTracker Service**: Core progress tracking API
- **Single POC Progress**: Tracking progress for one POC
- **Batch Progress**: Tracking progress across multiple POCs
- **Progress Event Ordering**: Ensuring events arrive in correct order
- **Progress Event Data**: Validating event payload completeness
- **Progress Cleanup**: Handling multiple concurrent sessions

**Test Suites:**

#### ProgressTracker Service
- ✅ Initializes progress tracker with correct total
- ✅ Sends progress events
- ✅ Tracks individual POC progress
- ✅ Tracks chunk-level progress
- ✅ Tracks LLM progress separately
- ✅ Sends completion event

#### Progress Events - Single POC
- ✅ Tracks progress for single POC chunking
- ✅ Emits chunk progress events during processing
- ✅ Emits LLM progress events for LLM chunkers

#### Progress Events - Batch POCs (Sync)
- ✅ Tracks progress across multiple POCs
- ✅ Emits chunk progress for each POC in batch
- ✅ Emits LLM progress for batch with LLM chunker

#### Progress Event Ordering
- ✅ Emits events in correct order for single POC
- ✅ Emits events in correct order for LLM chunker
- ✅ Emits progress at reasonable intervals

#### Progress Event Data Completeness
- ✅ Includes all required fields in progress event
- ✅ Includes progress percentage in chunk-progress events
- ✅ Includes progress metrics in LLM progress events
- ✅ Includes results summary in completed event

#### Progress Cleanup
- ✅ Allows multiple concurrent sessions
- ✅ Isolates events between sessions

---

## Running the Tests

### Prerequisites
```bash
# Install dependencies
npm install --save-dev jest supertest

# Ensure MongoDB is running (test database)
# Set up .env.test file with test database connection
```

### Environment Setup
Create `.env.test` file:
```env
MONGODB_URI=mongodb://localhost/semantic-chunker-test
NODE_ENV=test
SESSION_SECRET=test-secret
PORT=3002
AZURE_OPENAI_API_KEY=your-test-key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_INPUT_TOKEN_COST=0.0000015
AZURE_OUTPUT_TOKEN_COST=0.000004
```

### Run All Tests
```bash
# Run all integration tests
npm test -- tests/integration

# Run specific test file
npm test -- tests/integration/chunk-creation.test.js

# Run tests matching pattern
npm test -- tests/integration --testNamePattern="Single POC"

# Run with coverage
npm test -- --coverage tests/integration
```

### Run Specific Test Suites
```bash
# Chunk creation tests only
npm test -- chunk-creation.test.js

# Cost tracking tests only
npm test -- chunk-cost-tracking.test.js

# Progress tracking tests only
npm test -- chunk-progress.test.js
```

### Run Specific Test Scenarios
```bash
# Single POC tests
npm test -- --testNamePattern="Single POC"

# Batch synchronous tests
npm test -- --testNamePattern="Synchronous.*POC"

# Batch asynchronous tests (background jobs)
npm test -- --testNamePattern="Asynchronous.*POC"

# Cost tests
npm test -- --testNamePattern="Cost"

# Progress tests
npm test -- --testNamePattern="Progress"

# LLM chunker tests
npm test -- --testNamePattern="LLM"
```

---

## Test Coverage

### Functionality Coverage

| Feature | Single POC | Batch (Sync) | Batch (Async) | Cost | Progress |
|---------|-----------|-------------|---------------|------|----------|
| READ-CONTENT-SHORT | ✅ | ✅ | ✅ | ✅ | ✅ |
| READ-CONTENT-PARA | ✅ | ✅ | ✅ | ✅ | ✅ |
| READ-CONTENT-SHORT-LLM | ✅ | ✅ | ✅ | ✅ | ✅ |
| READ-CONTENT-PARA-LLM | ✅ | ✅ | ✅ | ✅ | ✅ |
| Database persistence | ✅ | ✅ | ✅ | ✅ | - |
| Error handling | ✅ | ✅ | ✅ | - | - |
| SSE progress events | ✅ | ✅ | ✅ | - | ✅ |
| Cost calculation | - | - | - | ✅ | - |
| Token tracking | - | - | - | ✅ | - |

### Scenario Coverage

| Scenario | Tests | Focus |
|----------|-------|-------|
| Single POC chunking | 6 | API, database, response format |
| Few POCs batch (sync) | 4 | Synchronous processing, aggregation |
| 100+ POCs batch (async) | 3 | Background jobs, polling, completion |
| Cost - Single | 4 | Calculation, persistence, format |
| Cost - Batch | 3 | Aggregation, breakdown, mixed chunkers |
| Cost - Edge cases | 3 | Zero tokens, large tokens, recovery |
| Progress - Single | 3 | Event emission, chunk-level, LLM-level |
| Progress - Batch | 3 | Multiple POCs, event ordering, intervals |
| Progress - Data | 5 | Event fields, message format, results |
| Error handling | 4 | Validation, graceful failures |
| Chunker types | 5 | All 4 variants, chunk count differences |

---

## Test Data

### Test POC Structure
Each test POC includes:
- **PieceOfContent document**: pocId, title, contentType='READ', schemaType='ARTICLE'
- **Article document**: name, content (XHTML), uri

### Test Content Types
- **Simple POCs**: Basic paragraphs (no special chunks)
- **POCs with special chunks**: Images, tables, code blocks (trigger LLM)
- **Various content lengths**: 3-20 paragraphs for diverse chunking behavior

---

## Expected Results

### Successful Single POC Chunking
```json
{
  "success": true,
  "chunkerType": "READ-CONTENT-SHORT",
  "results": {
    "successful": [
      {
        "pocId": "poc-123",
        "chunkCount": 5
      }
    ],
    "failed": [],
    "totalChunks": 5
  },
  "costs": {
    "totalCost": 0,
    "details": []
  }
}
```

### Successful Batch POC Chunking (Sync)
```json
{
  "success": true,
  "chunkerType": "READ-CONTENT-SHORT",
  "readPocsProcessed": 5,
  "results": {
    "successful": [
      {"pocId": "poc-1", "chunkCount": 4},
      {"pocId": "poc-2", "chunkCount": 5},
      ...
    ],
    "failed": [],
    "totalChunks": 25
  },
  "costs": {
    "totalCost": 0,
    "details": []
  }
}
```

### Background Job Response (Async)
```json
{
  "success": true,
  "jobId": "chunk-1705424561234-abc123",
  "status": "queued",
  "message": "Large batch job queued for processing (150 POCs)",
  "note": "Use /api/chunk-job-status/chunk-1705424561234-abc123 to check progress"
}
```

### Job Status Response
```json
{
  "jobId": "chunk-1705424561234-abc123",
  "status": "processing",
  "totalProcessed": 42,
  "totalPocs": 150,
  "processedPocs": [...],
  "failedPocs": []
}
```

---

## Performance Notes

- **Single POC**: Typically < 5 seconds
- **Batch (5 POCs, sync)**: Typically 10-15 seconds
- **Batch (150 POCs, async)**: Varies based on parallelization (typically 2-5 minutes)
- **LLM chunkers**: Add ~3-5 seconds per special chunk (parallelized to 3 concurrent)
- **Cost calculation**: Negligible overhead (~100ms for full batch)

---

## Troubleshooting

### Tests Timing Out
- Increase Jest timeout: `jest.setTimeout(60000)`
- For async tests: `}, 360000); // 6 minute timeout`
- Check MongoDB connection and performance

### Database Connection Issues
- Verify MongoDB is running: `mongod`
- Check connection string in `.env.test`
- Clear test database if data is stale: `db.dropDatabase()`

### Missing Dependencies
```bash
npm install supertest @types/jest
```

### SSE Events Not Received
- Tests use mocked event tracking, not actual SSE
- For full SSE testing, use e2e tests with browser automation

---

## CI/CD Integration

### GitHub Actions Example
```yaml
- name: Run Tests
  run: |
    npm run test:integration
    npm run test:coverage
```

### Coverage Requirements
- Target: > 80% for chunk creation API
- Critical paths: All chunker types, cost tracking, progress events
- Excluded: Error recovery edge cases

---

## Future Enhancements

- [ ] E2E tests with SSE event stream validation
- [ ] Performance benchmarks for large batches
- [ ] Concurrent session stress tests
- [ ] Database failure recovery tests
- [ ] LLM API failure handling tests
- [ ] Cost calculation accuracy validation with real LLM costs
- [ ] Progress event timing accuracy validation
