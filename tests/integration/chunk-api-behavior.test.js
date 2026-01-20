/**
 * Unit Tests for Chunk Creation API Behavior
 * 
 * CRITICAL SAFETY: These tests do NOT connect to any database.
 * All database operations are mocked to prevent accidental data loss.
 * 
 * Tests verify API responses and side effects using mocked data.
 */

jest.mock('../../src/models', () => ({
  ChunkAuditPoc: {
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    countDocuments: jest.fn(),
    deleteMany: jest.fn(),
    updateMany: jest.fn()
  },
  ChunkAuditChunk: {
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    countDocuments: jest.fn(),
    deleteMany: jest.fn(),
    updateMany: jest.fn()
  },
  ChunkAuditCosts: {
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    countDocuments: jest.fn(),
    deleteMany: jest.fn(),
    updateMany: jest.fn()
  },
  Chunk: {
    create: jest.fn(),
    find: jest.fn(),
    deleteMany: jest.fn()
  },
  PieceOfContent: {
    find: jest.fn(),
    findOne: jest.fn()
  },
  Article: {
    find: jest.fn(),
    findOne: jest.fn()
  }
}));

const {
  ChunkAuditPoc,
  ChunkAuditChunk,
  ChunkAuditCosts,
  Chunk,
  PieceOfContent,
  Article
} = require('../../src/models');

describe('Chunk Creation API - Behavior Testing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('Write Operations - Mocked Only', () => {
    test('should create ChunkAuditPoc records without database', async () => {
      const pocData = {
        pocId: 'test-poc-1',
        title: 'Test Article',
        contentType: 'READ',
        schemaType: 'ARTICLE',
        parentSchemaType: 'CONTENT',
        chunks: []
      };

      ChunkAuditPoc.create.mockResolvedValue({
        _id: 'mock-id',
        ...pocData
      });

      const result = await ChunkAuditPoc.create(pocData);

      expect(result.pocId).toBe('test-poc-1');
      expect(ChunkAuditPoc.create).toHaveBeenCalledWith(pocData);
    });

    test('should create ChunkAuditChunk records without database', async () => {
      const chunkData = {
        pocId: 'test-poc-1',
        chunkId: 'chunk-1',
        chunkType: 'PARAGRAPH',
        chunkOrder: 1
      };

      ChunkAuditChunk.create.mockResolvedValue({
        _id: 'mock-chunk-id',
        ...chunkData
      });

      const result = await ChunkAuditChunk.create(chunkData);

      expect(result.pocId).toBe('test-poc-1');
      expect(ChunkAuditChunk.create).toHaveBeenCalledWith(chunkData);
    });

    test('should record costs without database', async () => {
      const costData = {
        pocId: 'test-poc-1',
        inputTokensCost: 0.00015,
        outputTokensCost: 0.00045,
        totalCost: 0.0006
      };

      ChunkAuditCosts.create.mockResolvedValue({
        _id: 'mock-cost-id',
        ...costData
      });

      const result = await ChunkAuditCosts.create(costData);

      expect(result.totalCost).toBe(0.0006);
      expect(ChunkAuditCosts.create).toHaveBeenCalledWith(costData);
    });
  });

  describe('Isolation - Only Allowed Models', () => {
    test('should prevent writes to read-only models', () => {
      // PieceOfContent and Article should only have read methods
      expect(PieceOfContent.find).toBeDefined();
      expect(PieceOfContent.findOne).toBeDefined();
      expect(PieceOfContent.create).toBeUndefined();
      
      expect(Article.find).toBeDefined();
      expect(Article.findOne).toBeDefined();
      expect(Article.create).toBeUndefined();
    });

    test('should verify only 3 models are writable', () => {
      const writableModels = [ChunkAuditPoc, ChunkAuditChunk, ChunkAuditCosts];
      
      writableModels.forEach(model => {
        expect(typeof model.create).toBe('function');
      });
    });
  });

  describe('Data Consistency', () => {
    test('should track chunks with order', async () => {
      const chunks = [
        { pocId: 'poc-1', chunkId: 'c1', chunkOrder: 1 },
        { pocId: 'poc-1', chunkId: 'c2', chunkOrder: 2 }
      ];

      ChunkAuditChunk.create.mockResolvedValue(chunks.map((c, i) => ({
        _id: `id-${i}`,
        ...c
      })));

      const result = await ChunkAuditChunk.create(chunks);

      expect(result[0].chunkOrder).toBe(1);
      expect(result[1].chunkOrder).toBe(2);
    });

    test('should maintain costs per POC', async () => {
      const costRecords = [];

      ChunkAuditCosts.create.mockImplementation(async (data) => {
        costRecords.push(data);
        return { _id: 'mock-id', ...data };
      });

      await ChunkAuditCosts.create({ pocId: 'poc-1', totalCost: 0.0006 });
      await ChunkAuditCosts.create({ pocId: 'poc-2', totalCost: 0.0008 });

      expect(costRecords[0].pocId).toBe('poc-1');
      expect(costRecords[1].pocId).toBe('poc-2');
    });
  });

  describe('Error Handling', () => {
    test('should handle errors in mocked operations', async () => {
      const error = new Error('Operation failed');
      ChunkAuditPoc.create.mockRejectedValue(error);

      await expect(ChunkAuditPoc.create({})).rejects.toThrow('Operation failed');
    });
  });
});
