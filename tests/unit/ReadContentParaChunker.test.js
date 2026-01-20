/**
 * Tests for ReadContentParaChunker - one paragraph per chunk
 */

const ReadContentParaChunker = require('../../src/services/ReadContentParaChunker');
const { CHUNKER_TYPES } = require('../../src/constants/chunkers');

describe('ReadContentParaChunker', () => {
  let chunker;

  beforeEach(() => {
    chunker = new ReadContentParaChunker();
  });

  describe('Initialization', () => {
    test('should initialize with correct chunker type', () => {
      expect(chunker.chunkerType).toBe('READ-CONTENT-PARA');
    });

    test('should have correct max tokens', () => {
      expect(chunker.maxTokens).toBe(2048);
    });

    test('should have correct target tokens', () => {
      expect(chunker.targetTokens).toBe(512);
    });
  });

  describe('Chunk Creation from Sections', () => {
    test('should create one chunk per paragraph', () => {
      const sections = [
        {
          heading: 'Section 1',
          elements: [
            { type: 'paragraph', content: 'Paragraph 1 text.' },
            { type: 'paragraph', content: 'Paragraph 2 text.' },
            { type: 'paragraph', content: 'Paragraph 3 text.' }
          ]
        }
      ];

      const chunks = chunker.createChunksFromSections(sections);

      // Should have 3 chunks (1 per paragraph, heading combined with first)
      expect(chunks.length).toBe(3);
      
      // First chunk should have heading + first paragraph
      expect(chunks[0].content).toContain('Section 1');
      expect(chunks[0].content).toContain('Paragraph 1 text');
      expect(chunks[0].type).toBe('paragraph');
      
      // Second chunk should be just second paragraph
      expect(chunks[1].content).toBe('Paragraph 2 text.');
      expect(chunks[1].type).toBe('paragraph');
      
      // Third chunk should be just third paragraph
      expect(chunks[2].content).toBe('Paragraph 3 text.');
      expect(chunks[2].type).toBe('paragraph');
    });

    test('should create separate chunks for tables', () => {
      const sections = [
        { type: 'table', content: 'Table content here' }
      ];

      const chunks = chunker.createChunksFromSections(sections);

      expect(chunks.length).toBe(1);
      expect(chunks[0].type).toBe('table');
      expect(chunks[0].content).toBe('Table content here');
    });

    test('should create separate chunks for images', () => {
      const sections = [
        { type: 'image', content: 'Image description', filename: 'test.png' }
      ];

      const chunks = chunker.createChunksFromSections(sections);

      expect(chunks.length).toBe(1);
      expect(chunks[0].type).toBe('image');
      expect(chunks[0].filename).toBe('test.png');
    });

    test('should create separate chunks for code blocks', () => {
      const sections = [
        { type: 'code', content: 'const x = 5;' }
      ];

      const chunks = chunker.createChunksFromSections(sections);

      expect(chunks.length).toBe(1);
      expect(chunks[0].type).toBe('code');
    });

    test('should handle mixed content - text, images, tables, code', () => {
      const sections = [
        {
          heading: 'Introduction',
          elements: [
            { type: 'paragraph', content: 'Para 1' },
            { type: 'paragraph', content: 'Para 2' }
          ]
        },
        { type: 'image', content: 'Image', filename: 'img.png' },
        { type: 'table', content: 'Table' },
        { type: 'code', content: 'code' },
        {
          heading: 'Conclusion',
          elements: [
            { type: 'paragraph', content: 'Para 3' }
          ]
        }
      ];

      const chunks = chunker.createChunksFromSections(sections);

      // Should have: para1+heading, para2, image, table, code, para3+heading = 6 chunks
      expect(chunks.length).toBe(6);
      expect(chunks[0].type).toBe('paragraph');
      expect(chunks[1].type).toBe('paragraph');
      expect(chunks[2].type).toBe('image');
      expect(chunks[3].type).toBe('table');
      expect(chunks[4].type).toBe('code');
      expect(chunks[5].type).toBe('paragraph');
    });

    test('should preserve caption metadata', () => {
      const sections = [
        { type: 'table', content: 'Table content', caption: 'Table 1: Results' }
      ];

      const chunks = chunker.createChunksFromSections(sections);

      expect(chunks[0].caption).toBe('Table 1: Results');
    });

    test('should handle section with only heading', () => {
      const sections = [
        { heading: 'Just a heading', elements: [] }
      ];

      const chunks = chunker.createChunksFromSections(sections);

      expect(chunks.length).toBe(1);
      expect(chunks[0].content).toBe('Just a heading');
      expect(chunks[0].type).toBe('section');
    });

    test('should calculate token counts correctly', () => {
      const sections = [
        {
          heading: null,
          elements: [
            { type: 'paragraph', content: 'Short para' }
          ]
        }
      ];

      const chunks = chunker.createChunksFromSections(sections);

      expect(chunks[0].tokenCount).toBeGreaterThan(0);
      expect(chunks[0].tokenCount).toBe(Math.ceil('Short para'.length / 4));
    });
  });

  describe('Feature Parity with ReadContentShortChunker', () => {
    const ReadContentShortChunker = require('../../src/services/ReadContentShortChunker');
    const shortChunker = new ReadContentShortChunker();

    test('should inherit from ReadContentShortChunker', () => {
      expect(chunker instanceof ReadContentShortChunker).toBe(true);
    });

    test('should have same heading detection as parent', () => {
      // Both should have isHeading method
      expect(typeof chunker.isHeading).toBe('function');
      expect(typeof shortChunker.isHeading).toBe('function');
    });

    test('should have same token estimation as parent', () => {
      const text = 'Sample text for token estimation';
      expect(chunker.estimateTokens(text)).toBe(shortChunker.estimateTokens(text));
    });
  });
});
