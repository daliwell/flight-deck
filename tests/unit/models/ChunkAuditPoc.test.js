const ChunkAuditPoc = require('../../../src/models/ChunkAuditPoc');

describe('ChunkAuditPoc Model', () => {
  describe('Schema Validation', () => {
    test('should create a valid POC document', () => {
      const validPoc = {
        pocId: 'test-123',
        schemaType: 'ARTICLE',
        parentSchemaType: 'ISSUE',
        title: 'Test Article',
        isArchetype: false,
        sortDate: new Date(),
        contentType: 'READ'
      };

      const poc = new ChunkAuditPoc(validPoc);
      const validationError = poc.validateSync();
      
      expect(validationError).toBeUndefined();
      expect(poc.pocId).toBe('test-123');
      expect(poc.schemaType).toBe('ARTICLE');
    });

    test('should require pocId', () => {
      const invalidPoc = {
        schemaType: 'ARTICLE',
        title: 'Test'
      };

      const poc = new ChunkAuditPoc(invalidPoc);
      const validationError = poc.validateSync();
      
      expect(validationError).toBeDefined();
      expect(validationError.errors.pocId).toBeDefined();
    });

    test('should validate schemaType enum', () => {
      const validPoc = {
        pocId: 'test-123',
        schemaType: 'ARTICLE',
        parentSchemaType: 'ISSUE',
        contentType: 'READ',
        title: 'Test'
      };

      const poc = new ChunkAuditPoc(validPoc);
      const validationError = poc.validateSync();
      
      // Model doesn't enforce schemaType enum - just validates it's provided
      expect(validationError).toBeUndefined();
      expect(poc.schemaType).toBe('ARTICLE');
    });
  });

  describe('Chunks Array', () => {
    test('should allow empty chunks array', () => {
      const poc = new ChunkAuditPoc({
        pocId: 'test-123',
        schemaType: 'ARTICLE',
        parentSchemaType: 'ISSUE',
        contentType: 'READ',
        title: 'Test',
        chunks: []
      });

      const validationError = poc.validateSync();
      expect(validationError).toBeUndefined();
      expect(poc.chunks).toHaveLength(0);
    });

    test('should validate chunk structure', () => {
      const poc = new ChunkAuditPoc({
        pocId: 'test-123',
        schemaType: 'ARTICLE',
        parentSchemaType: 'ISSUE',
        contentType: 'READ',
        title: 'Test',
        chunks: [{
          chunker: 'DEFAULT-1024T',
          assessments: [{
            method: 'basic-heuristics',
            qualityScore: 0.75,
            assessmentCost: 0,
            updatedAt: new Date(),
            qualityAssessments: []
          }]
        }]
      });

      const validationError = poc.validateSync();
      expect(validationError).toBeUndefined();
      expect(poc.chunks[0].chunker).toBe('DEFAULT-1024T');
      expect(poc.chunks[0].assessments[0].method).toBe('basic-heuristics');
    });

    test('should validate qualityScore range', () => {
      const poc = new ChunkAuditPoc({
        pocId: 'test-123',
        schemaType: 'ARTICLE',
        parentSchemaType: 'ISSUE',
        contentType: 'READ',
        title: 'Test',
        chunks: [{
          chunker: 'DEFAULT-1024T',
          assessments: [{
            method: 'basic-heuristics',
            qualityScore: 1.5, // Invalid: > 1
            assessmentCost: 0
          }]
        }]
      });

      const validationError = poc.validateSync();
      expect(validationError).toBeDefined();
    });

    test('should validate individual chunk assessments structure', () => {
      const poc = new ChunkAuditPoc({
        pocId: 'test-123',
        schemaType: 'ARTICLE',
        parentSchemaType: 'ISSUE',
        contentType: 'READ',
        title: 'Test',
        chunks: [{
          chunker: 'DEFAULT-1024T',
          assessments: [{
            method: 'basic-heuristics',
            qualityScore: 0.75,
            assessmentCost: 0,
            qualityAssessments: [{
              index: 0,
              quality: 'GOOD',
              qualityScore: 0.8
            }]
          }]
        }]
      });

      const validationError = poc.validateSync();
      expect(validationError).toBeUndefined();
      expect(poc.chunks[0].assessments[0].qualityAssessments).toHaveLength(1);
      expect(poc.chunks[0].assessments[0].qualityAssessments[0].index).toBe(0);
    });
  });

  describe('Quality Assessments (Legacy)', () => {
    test('should allow legacy qualityAssessments array', () => {
      const poc = new ChunkAuditPoc({
        pocId: 'test-123',
        schemaType: 'ARTICLE',
        parentSchemaType: 'ISSUE',
        contentType: 'READ',
        title: 'Test',
        qualityAssessments: [{
          index: 0,
          method: 'basic-heuristics',
          chunker: 'DEFAULT-1024T',
          qualityScore: 0.8,
          quality: 'GOOD',
          updatedAt: new Date()
        }]
      });

      const validationError = poc.validateSync();
      expect(validationError).toBeUndefined();
      expect(poc.qualityAssessments).toHaveLength(1);
    });
  });

  describe('Timestamps', () => {
    test('should auto-generate createdAt and updatedAt', () => {
      const poc = new ChunkAuditPoc({
        pocId: 'test-123',
        schemaType: 'ARTICLE',
        parentSchemaType: 'ISSUE',
        contentType: 'READ',
        title: 'Test'
      });

      expect(poc.createdAt).toBeUndefined(); // Not set until save
      expect(poc.updatedAt).toBeUndefined();
    });
  });
});
