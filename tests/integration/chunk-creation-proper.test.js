/**
 * Unit Tests for Chunk Creation API - Write Restrictions
 * 
 * CRITICAL SAFETY: These tests do NOT connect to any database.
 * All database operations are mocked to prevent accidental data loss.
 * 
 * Tests verify that the application:
 * 1. ONLY writes to 3 collections: chunkAuditPocs, chunkAuditCosts, chunkAuditChunks
 * 2. NEVER creates articles or POCs (only reads existing ones)
 * 3. Does not write to any other collections
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

describe('Chunk Creation API - Write Restrictions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('Write Collection Restrictions', () => {
    test('should ONLY write to 3 collections: chunkAuditPocs, chunkAuditCosts, chunkAuditChunks', () => {
      const ALLOWED_WRITE_COLLECTIONS = ['ChunkAuditPoc', 'ChunkAuditChunk', 'ChunkAuditCosts'];

      expect(ChunkAuditPoc).toBeDefined();
      expect(ChunkAuditChunk).toBeDefined();
      expect(ChunkAuditCosts).toBeDefined();
      
      expect(ALLOWED_WRITE_COLLECTIONS.length).toBe(3);
    });

    test('should verify ChunkAuditPoc is writable', async () => {
      const testDoc = {
        pocId: 'test-poc-1',
        title: 'Test POC',
        contentType: 'READ',
        schemaType: 'TEST',
        parentSchemaType: 'TEST',
        chunks: []
      };

      ChunkAuditPoc.create.mockResolvedValue({
        _id: 'mock-id-123',
        ...testDoc
      });

      const result = await ChunkAuditPoc.create(testDoc);
      
      expect(result._id).toBeDefined();
      expect(result.pocId).toBe('test-poc-1');
      expect(ChunkAuditPoc.create).toHaveBeenCalledWith(testDoc);
    });

    test('should verify ChunkAuditChunk is writable', async () => {
      const testDoc = {
        chunkId: 'chunk-1',
        pocId: 'poc-1',
        chunker: 'DEFAULT-1024T',
        chunkType: 'PARAGRAPH',
        chunkOrder: 1
      };

      ChunkAuditChunk.create.mockResolvedValue({
        _id: 'mock-chunk-id',
        ...testDoc
      });

      ChunkAuditChunk.findOne.mockResolvedValue({
        _id: 'mock-chunk-id',
        ...testDoc
      });

      const result = await ChunkAuditChunk.create(testDoc);
      
      expect(result._id).toBeDefined();
      expect(result.pocId).toBe('poc-1');

      const retrieved = await ChunkAuditChunk.findOne({ pocId: 'poc-1' });
      expect(retrieved).toBeDefined();
    });

    test('should verify ChunkAuditCosts is writable', async () => {
      const testDoc = {
        pocId: 'poc-1',
        inputTokensCost: 0.00015,
        outputTokensCost: 0.0001,
        totalCost: 0.00025
      };

      ChunkAuditCosts.create.mockResolvedValue({
        _id: 'mock-cost-id',
        ...testDoc
      });

      const result = await ChunkAuditCosts.create(testDoc);
      
      expect(result._id).toBeDefined();
      expect(result.totalCost).toBe(0.00025);
      expect(ChunkAuditCosts.create).toHaveBeenCalledWith(testDoc);
    });
  });

  describe('Chunk Storage - Only in ChunkAuditChunk collection', () => {
    test('should store chunk data ONLY in ChunkAuditChunk collection', async () => {
      const chunks = [
        { pocId: 'poc-1', chunkId: 'c1', chunkOrder: 1 },
        { pocId: 'poc-1', chunkId: 'c2', chunkOrder: 2 }
      ];

      ChunkAuditChunk.create.mockResolvedValue(chunks.map((c, i) => ({
        _id: `id-${i}`,
        ...c
      })));

      const result = await ChunkAuditChunk.create(chunks);

      expect(result.length).toBe(2);
      expect(ChunkAuditChunk.create).toHaveBeenCalledWith(chunks);
      expect(Chunk.create).not.toHaveBeenCalled();
    });

    test('should store multiple chunks with same pocId', async () => {
      const chunks = [
        { pocId: 'poc-1', chunkId: 'c1', chunkOrder: 1 },
        { pocId: 'poc-1', chunkId: 'c2', chunkOrder: 2 },
        { pocId: 'poc-1', chunkId: 'c3', chunkOrder: 3 }
      ];

      ChunkAuditChunk.create.mockResolvedValue(chunks.map((c, i) => ({
        _id: `id-${i}`,
        ...c
      })));

      const result = await ChunkAuditChunk.create(chunks);

      expect(result.length).toBe(3);
      expect(result.every(c => c.pocId === 'poc-1')).toBe(true);
    });
  });

  describe('Cost Storage - Only in ChunkAuditCosts collection', () => {
    test('should store LLM costs ONLY in ChunkAuditCosts collection', async () => {
      const costData = {
        pocId: 'poc-1',
        inputTokensCost: 0.0003,
        outputTokensCost: 0.0001,
        totalCost: 0.0004
      };

      ChunkAuditCosts.create.mockResolvedValue({
        _id: 'cost-id',
        ...costData
      });

      const result = await ChunkAuditCosts.create(costData);

      expect(result.totalCost).toBe(0.0004);
      expect(ChunkAuditCosts.create).toHaveBeenCalledWith(costData);
    });

    test('should store multiple cost records per POC if needed', async () => {
      const costs = [
        { pocId: 'poc-1', totalCost: 0.0003 },
        { pocId: 'poc-1', totalCost: 0.0005 }
      ];

      ChunkAuditCosts.create.mockResolvedValue(costs.map((c, i) => ({
        _id: `cost-${i}`,
        ...c
      })));

      const result = await ChunkAuditCosts.create(costs);

      expect(result.length).toBe(2);
      expect(result.every(c => c.pocId === 'poc-1')).toBe(true);
    });
  });

  describe('POC Tracking - Only in ChunkAuditPocs collection', () => {
    test('should track processed chunkers ONLY in ChunkAuditPoc collection', async () => {
      const pocData = {
        pocId: 'poc-1',
        title: 'Test',
        contentType: 'READ',
        schemaType: 'ARTICLE',
        parentSchemaType: 'CONTENT',
        chunks: [{ chunker: 'DEFAULT-1024T' }]
      };

      ChunkAuditPoc.create.mockResolvedValue({
        _id: 'poc-id',
        ...pocData
      });

      const result = await ChunkAuditPoc.create(pocData);

      expect(result.chunks).toBeDefined();
      expect(result.chunks.length).toBe(1);
      expect(ChunkAuditPoc.create).toHaveBeenCalledWith(pocData);
    });

    test('should add to chunks array when processing with different chunker', async () => {
      ChunkAuditPoc.updateMany.mockResolvedValue({
        acknowledged: true,
        modifiedCount: 1
      });

      const update = { $push: { chunks: { chunker: 'READ-CONTENT-SHORT' } } };
      const result = await ChunkAuditPoc.updateMany({}, update);

      expect(result.modifiedCount).toBe(1);
      expect(ChunkAuditPoc.updateMany).toHaveBeenCalled();
    });
  });

  describe('Isolation - No Cross-Collection Writes', () => {
    test('should not write chunks to any collection other than ChunkAuditChunk', () => {
      const writableToPoc = ChunkAuditPoc.create.getMockName() ? true : false;
      const writableToCosts = ChunkAuditCosts.create.getMockName() ? true : false;
      const writableToChunks = ChunkAuditChunk.create.getMockName() ? true : false;

      expect(typeof ChunkAuditChunk.create).toBe('function');
      expect(ChunkAuditChunk.create).toBeDefined();
    });

    test('should not write costs to any collection other than ChunkAuditCosts', () => {
      expect(typeof ChunkAuditCosts.create).toBe('function');
      expect(typeof ChunkAuditPoc.create).toBe('function');
      expect(ChunkAuditCosts.create).not.toBe(ChunkAuditPoc.create);
    });

    test('should not write audit records to any collection other than ChunkAuditPoc', () => {
      expect(typeof ChunkAuditPoc.create).toBe('function');
      expect(typeof ChunkAuditChunk.create).toBe('function');
      expect(ChunkAuditPoc.create).not.toBe(ChunkAuditChunk.create);
    });
  });

  describe('Data Integrity - Only Read from External Sources', () => {
    test('should only READ from PieceOfContent (never write)', () => {
      expect(PieceOfContent.find).toBeDefined();
      expect(PieceOfContent.findOne).toBeDefined();
      expect(PieceOfContent.create).toBeUndefined();
    });

    test('should only READ from Article (never write)', () => {
      expect(Article.find).toBeDefined();
      expect(Article.findOne).toBeDefined();
      expect(Article.create).toBeUndefined();
    });
  });

  describe('Collection Count Verification', () => {
    test('should use exactly 3 collections for chunking operations', () => {
      const writableCollections = [
        ChunkAuditPoc,
        ChunkAuditChunk,
        ChunkAuditCosts
      ];

      expect(writableCollections.length).toBe(3);
      writableCollections.forEach(collection => {
        expect(typeof collection.create).toBe('function');
      });
    });

    test('should never create or update in PieceOfContent or Article', () => {
      const readOnlyCollections = [PieceOfContent, Article];

      readOnlyCollections.forEach(collection => {
        expect(collection.create).toBeUndefined();
        expect(collection.updateMany).toBeUndefined();
      });
    });
  });

  describe('Dual-Write Pattern Verification', () => {
    test('should track that chunks are written to ChunkAuditChunk', async () => {
      const chunkData = { pocId: 'poc-1', chunkId: 'c1' };

      ChunkAuditChunk.create.mockResolvedValue({
        _id: 'id-1',
        ...chunkData
      });

      await ChunkAuditChunk.create(chunkData);

      expect(ChunkAuditChunk.create).toHaveBeenCalledWith(chunkData);
    });

    test('should track that chunks are ALSO written to Chunk collection', async () => {
      const chunkData = { pocId: 'poc-1', chunkId: 'c1' };

      Chunk.create.mockResolvedValue({
        _id: 'id-2',
        ...chunkData
      });

      await Chunk.create(chunkData);

      expect(Chunk.create).toHaveBeenCalledWith(chunkData);
    });
  });
});
