const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { PieceOfContent, ChunkAuditPoc } = require('../../src/models');

/**
 * Integration tests for POC loading from different collections
 * Tests the defect where POCs weren't found due to _id type mismatch
 */
describe('POC Loading from Collections', () => {
  const testPocId = 'test-poc-12345';
  let createdPocIds = [];
  let mongoServer;

  beforeAll(async () => {
    // Start in-memory MongoDB server
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    // Connect mongoose to in-memory database
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    // Clean up test data
    if (createdPocIds.length > 0) {
      await PieceOfContent.deleteMany({ _id: { $in: createdPocIds } });
      await ChunkAuditPoc.deleteMany({ pocId: { $in: createdPocIds } });
    }
    // Close mongoose connection and stop in-memory server
    await mongoose.connection.close();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  describe('PieceOfContent Collection', () => {
    test('should store _id as string, not ObjectId', async () => {
      const testPoc = new PieceOfContent({
        _id: testPocId,
        contentId: testPocId,
        content: '<div>Test content</div>',
        metadata: { test: true }
      });

      const saved = await testPoc.save();
      createdPocIds.push(testPocId);

      // Verify _id is stored as string
      expect(typeof saved._id).toBe('string');
      expect(saved._id).toBe(testPocId);
    });

    test('should query POC by string _id', async () => {
      // Create test POC
      await PieceOfContent.create({
        _id: 'query-test-poc-1',
        contentId: 'query-test-poc-1',
        content: '<div>Query test</div>',
        metadata: {}
      });
      createdPocIds.push('query-test-poc-1');

      // Query by string _id
      const found = await PieceOfContent.findOne({ _id: 'query-test-poc-1' });

      expect(found).not.toBeNull();
      expect(found._id).toBe('query-test-poc-1');
      expect(found.contentId).toBe('query-test-poc-1');
    });

    test('should query multiple POCs by string _id array', async () => {
      // Create test POCs
      const pocIds = ['multi-poc-1', 'multi-poc-2', 'multi-poc-3'];
      await PieceOfContent.insertMany(pocIds.map(id => ({
        _id: id,
        contentId: id,
        content: `<div>Content for ${id}</div>`,
        metadata: {}
      })));
      createdPocIds.push(...pocIds);

      // Query by array of string _ids
      const found = await PieceOfContent.find({ _id: { $in: pocIds } });

      expect(found).toHaveLength(3);
      expect(found.map(p => p._id).sort()).toEqual(pocIds.sort());
    });

    test('should return empty array when POC IDs not found', async () => {
      const found = await PieceOfContent.find({ _id: { $in: ['non-existent-1', 'non-existent-2'] } });
      
      expect(found).toHaveLength(0);
    });

    test('should handle POCs with rich metadata fields', async () => {
      const richPocId = 'rich-metadata-poc';
      await PieceOfContent.create({
        _id: richPocId,
        contentId: richPocId,
        content: '<div>Rich content</div>',
        contentType: 'READ',
        title: 'Test Article',
        subtitle: 'Test Subtitle',
        abstract: 'Test Abstract',
        primaryCategoryNames: 'Category1',
        secondaryCategoryNames: 'Category2',
        language: 'en',
        sortYear: '2024',
        sortDate: new Date('2024-01-01'),
        experts: [{ name: 'Expert 1' }, { name: 'Expert 2' }],
        expertSearchNames: 'Expert1,Expert2',
        similarities: [0.8, 0.9],
        supportedApps: ['app1', 'app2'],
        isArchetype: false,
        parentId: 'parent-123',
        parentName: 'Parent Article',
        indexBrandName: 'Brand',
        indexSeriesName: 'Series',
        summaryDe: 'German summary',
        summaryEn: 'English summary',
        summaryNl: 'Dutch summary',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        metadata: { custom: 'field' }
      });
      createdPocIds.push(richPocId);

      const found = await PieceOfContent.findOne({ _id: richPocId });

      expect(found).not.toBeNull();
      expect(found.title).toBe('Test Article');
      expect(found.subtitle).toBe('Test Subtitle');
      expect(found.abstract).toBe('Test Abstract');
      expect(found.primaryCategoryNames).toBe('Category1');
      expect(found.language).toBe('en');
      expect(found.experts).toHaveLength(2);
      expect(found.supportedApps).toEqual(['app1', 'app2']);
    });
  });

  describe('ChunkAuditPoc Collection Fallback', () => {
    test('should query POC by pocId field', async () => {
      const pocId = 'audit-poc-test';
      await ChunkAuditPoc.create({
        pocId: pocId,
        parentSchemaType: 'article',
        schemaType: 'article',
        contentType: 'READ',
        title: 'Test POC',
        summary: 'Test summary',
        chunks: []
      });
      createdPocIds.push(pocId);

      const found = await ChunkAuditPoc.findOne({ pocId: pocId });

      expect(found).not.toBeNull();
      expect(found.pocId).toBe(pocId);
    });

    test('should query multiple POCs from ChunkAuditPoc', async () => {
      const pocIds = ['audit-1', 'audit-2'];
      await ChunkAuditPoc.insertMany(pocIds.map(id => ({
        pocId: id,
        parentSchemaType: 'article',
        schemaType: 'article',
        contentType: 'READ',
        title: `POC ${id}`,
        summary: '',
        chunks: []
      })));
      createdPocIds.push(...pocIds);

      const found = await ChunkAuditPoc.find({ pocId: { $in: pocIds } });

      expect(found).toHaveLength(2);
      expect(found.map(p => p.pocId).sort()).toEqual(pocIds.sort());
    });
  });

  describe('API Route POC Loading Logic', () => {
    test('should find POC in PieceOfContent first', async () => {
      const pocId = 'priority-test-poc';
      
      // Create in both collections
      await PieceOfContent.create({
        _id: pocId,
        contentId: pocId,
        content: '<div>Content</div>',
        contentType: 'READ',
        title: 'From PieceOfContent',
        subtitle: 'Has rich metadata',
        metadata: {}
      });
      
      await ChunkAuditPoc.create({
        pocId: pocId,
        parentSchemaType: 'article',
        schemaType: 'article',
        contentType: 'READ',
        title: 'From ChunkAuditPoc',
        summary: 'Limited metadata',
        chunks: []
      });
      createdPocIds.push(pocId);

      // Query like the API does
      const fromPieceOfContent = await PieceOfContent.find({ _id: { $in: [pocId] } });
      const fromChunkAuditPoc = await ChunkAuditPoc.find({ pocId: { $in: [pocId] } });

      expect(fromPieceOfContent).toHaveLength(1);
      expect(fromPieceOfContent[0].subtitle).toBe('Has rich metadata');
      
      expect(fromChunkAuditPoc).toHaveLength(1);
      expect(fromChunkAuditPoc[0].subtitle).toBeUndefined();
    });

    test('should fallback to ChunkAuditPoc when not in PieceOfContent', async () => {
      const pocId = 'fallback-test-poc';
      
      // Create only in ChunkAuditPoc
      await ChunkAuditPoc.create({
        pocId: pocId,
        parentSchemaType: 'article',
        schemaType: 'article',
        contentType: 'READ',
        title: 'Fallback POC',
        summary: '',
        chunks: []
      });
      createdPocIds.push(pocId);

      // Simulate API logic
      let pocs = await PieceOfContent.find({ _id: { $in: [pocId] } });
      
      if (pocs.length === 0) {
        pocs = await ChunkAuditPoc.find({ pocId: { $in: [pocId] } });
      }

      expect(pocs).toHaveLength(1);
      expect(pocs[0].pocId).toBe(pocId);
    });

    test('should handle mixed POC IDs (some in each collection)', async () => {
      const pocInPieceOfContent = 'mixed-poc-1';
      const pocInChunkAudit = 'mixed-poc-2';
      
      await PieceOfContent.create({
        _id: pocInPieceOfContent,
        contentId: pocInPieceOfContent,
        content: '<div>Content</div>',
        contentType: 'READ',
        metadata: {}
      });
      
      await ChunkAuditPoc.create({
        pocId: pocInChunkAudit,
        parentSchemaType: 'article',
        schemaType: 'article',
        contentType: 'READ',
        title: 'POC 2',
        summary: '',
        chunks: []
      });
      createdPocIds.push(pocInPieceOfContent, pocInChunkAudit);

      const pocIds = [pocInPieceOfContent, pocInChunkAudit];
      let pocs = await PieceOfContent.find({ _id: { $in: pocIds } });
      
      const foundIds = pocs.map(p => p._id || p.pocId);
      const missingIds = pocIds.filter(id => !foundIds.includes(id));
      
      if (missingIds.length > 0) {
        const fallbackPocs = await ChunkAuditPoc.find({ pocId: { $in: missingIds } });
        pocs = [...pocs, ...fallbackPocs];
      }

      expect(pocs).toHaveLength(2);
    });
  });

  describe('_id Type Handling', () => {
    test('should NOT convert string to ObjectId for PieceOfContent', async () => {
      const stringId = 'string-id-test';
      
      await PieceOfContent.create({
        _id: stringId,
        contentId: stringId,
        content: '<div>Test</div>',
        metadata: {}
      });
      createdPocIds.push(stringId);

      // This should work - string to string comparison
      const found = await PieceOfContent.findOne({ _id: stringId });
      expect(found).not.toBeNull();
      expect(typeof found._id).toBe('string');

      // This should NOT work - ObjectId to string comparison
      const ObjectId = mongoose.Types.ObjectId;
      let shouldNotFind = null;
      try {
        shouldNotFind = await PieceOfContent.findOne({ _id: new ObjectId(stringId) });
      } catch (error) {
        // Expected - can't convert arbitrary string to ObjectId
        expect(error).toBeDefined();
      }
      
      // If no error, should not find anything
      if (shouldNotFind !== null) {
        expect(shouldNotFind).toBeNull();
      }
    });

    test('should handle pocId consistently across collections', async () => {
      const testId = 'consistent-id-test';
      
      // Create in PieceOfContent with _id
      const poc1 = await PieceOfContent.create({
        _id: testId,
        contentId: testId,
        content: '<div>Test</div>',
        metadata: {}
      });
      
      // Create in ChunkAuditPoc with pocId
      const poc2 = await ChunkAuditPoc.create({
        pocId: testId,
        parentSchemaType: 'article',
        schemaType: 'article',
        contentType: 'READ',
        title: 'Test',
        summary: '',
        chunks: []
      });
      
      createdPocIds.push(testId);

      // Both should be queryable with the same ID value
      expect(poc1._id).toBe(testId);
      expect(poc2.pocId).toBe(testId);
      
      // Base class getPocId should handle both (prioritizes pocId over _id)
      const pocId1 = poc1.pocId || poc1._id;
      const pocId2 = poc2.pocId || poc2._id;
      
      expect(pocId1).toBe(testId);
      expect(pocId2).toBe(testId);
    });
  });
});
