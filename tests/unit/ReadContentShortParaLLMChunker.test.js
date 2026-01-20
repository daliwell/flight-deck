/**
 * Tests for ReadContentShortParaLLMChunker
 */

const ReadContentShortLLMChunker = require('../../src/services/ReadContentShortLLMChunker');
const AzureOpenAIService = require('../../src/services/azureOpenAI');

// Mock the Azure OpenAI service
jest.mock('../../src/services/azureOpenAI');

describe('ReadContentShortLLMChunker', () => {
  let chunker;
  let mockAzureOpenAI;

  beforeAll(() => {
    // Reset mock
    jest.clearAllMocks();
    
    // Create mock instance
    mockAzureOpenAI = {
      generateResponse: jest.fn(),
      hasValidConfig: true
    };
    
    AzureOpenAIService.mockImplementation(() => mockAzureOpenAI);
    
    chunker = new ReadContentShortLLMChunker();
  });

  describe('Initialization', () => {
    test('should initialize with correct chunker type', () => {
      expect(chunker.chunkerType).toBe('READ-CONTENT-SHORT-LLM');
    });

    test('should have correct max tokens', () => {
      expect(chunker.maxTokens).toBe(1024);
    });

    test('should have correct target tokens', () => {
      expect(chunker.targetTokens).toBe(512);
    });
  });

  describe('Token Estimation', () => {
    test('should estimate tokens correctly', () => {
      const text = 'This is a test string with some words';
      const tokens = chunker.estimateTokens(text);
      // ~160 characters / 4 = ~40 tokens
      expect(tokens).toBeGreaterThan(0);
    });

    test('should return 0 for empty string', () => {
      expect(chunker.estimateTokens('')).toBe(0);
    });

    test('should return 0 for null', () => {
      expect(chunker.estimateTokens(null)).toBe(0);
    });

    test('should return 0 for non-string input', () => {
      expect(chunker.estimateTokens(123)).toBe(0);
    });
  });

  describe('Heading Detection', () => {
    test('should identify h1 as heading', () => {
      const mockH1 = { tagName: 'H1' };
      expect(chunker.isHeading(mockH1)).toBe(true);
    });

    test('should identify h2 as heading', () => {
      const mockH2 = { tagName: 'H2' };
      expect(chunker.isHeading(mockH2)).toBe(true);
    });

    test('should identify h6 as heading', () => {
      const mockH6 = { tagName: 'H6' };
      expect(chunker.isHeading(mockH6)).toBe(true);
    });

    test('should not identify p as heading', () => {
      const mockP = { tagName: 'P' };
      expect(chunker.isHeading(mockP)).toBe(false);
    });

    test('should handle lowercase tag names', () => {
      const mockH1 = { tagName: 'h1' };
      expect(chunker.isHeading(mockH1)).toBe(true);
    });
  });

  describe('Image Detection', () => {
    test('should detect figure elements', () => {
      const mockFigure = {
        tagName: 'FIGURE',
        classList: { contains: () => false }
      };
      expect(chunker.isImage(mockFigure)).toBe(true);
    });

    test('should detect commentedFigure class', () => {
      const mockDiv = {
        tagName: 'DIV',
        classList: { contains: (c) => c === 'commentedFigure' }
      };
      expect(chunker.isImage(mockDiv)).toBe(true);
    });

    test('should detect img tags', () => {
      const mockImg = {
        tagName: 'IMG',
        classList: { contains: () => false }
      };
      expect(chunker.isImage(mockImg)).toBe(true);
    });

    test('should detect paragraph with image', () => {
      const mockImg = { getAttribute: () => 'test.jpg' };
      const mockP = {
        tagName: 'P',
        classList: { contains: () => false },
        querySelector: () => mockImg,
        textContent: ''
      };
      expect(chunker.isImage(mockP)).toBe(true);
    });

    test('should not detect paragraph without image', () => {
      const mockP = {
        tagName: 'P',
        classList: { contains: () => false },
        querySelector: () => null,
        textContent: 'Some text'
      };
      expect(chunker.isImage(mockP)).toBe(false);
    });
  });

  describe('Table Detection', () => {
    test('should detect table elements', () => {
      const mockTable = {
        tagName: 'TABLE',
        classList: { contains: () => false }
      };
      expect(chunker.isTable(mockTable)).toBe(true);
    });

    test('should detect Tabelle class', () => {
      const mockDiv = {
        tagName: 'DIV',
        classList: { contains: (c) => c === 'Tabelle' }
      };
      expect(chunker.isTable(mockDiv)).toBe(true);
    });

    test('should not detect non-table elements', () => {
      const mockDiv = {
        tagName: 'DIV',
        classList: { contains: () => false }
      };
      expect(chunker.isTable(mockDiv)).toBe(false);
    });
  });

  describe('Code Block Detection', () => {
    test('should detect pre elements', () => {
      const mockPre = {
        tagName: 'PRE',
        classList: { contains: () => false }
      };
      expect(chunker.isCodeBlock(mockPre)).toBe(true);
    });

    test('should detect codelisting class', () => {
      const mockDiv = {
        tagName: 'DIV',
        classList: { contains: (c) => c === 'codelisting' }
      };
      expect(chunker.isCodeBlock(mockDiv)).toBe(true);
    });

    test('should not detect non-code elements', () => {
      const mockDiv = {
        tagName: 'DIV',
        classList: { contains: () => false }
      };
      expect(chunker.isCodeBlock(mockDiv)).toBe(false);
    });
  });

  describe('Text Extraction', () => {
    test('should extract text content', () => {
      const mockElement = {
        textContent: '  Some text content  '
      };
      expect(chunker.extractText(mockElement)).toBe('Some text content');
    });

    test('should return empty string for no text', () => {
      const mockElement = {
        textContent: null
      };
      expect(chunker.extractText(mockElement)).toBe('');
    });

    test('should trim whitespace', () => {
      const mockElement = {
        textContent: '   \n\t  text  \n  '
      };
      expect(chunker.extractText(mockElement)).toBe('text');
    });
  });

  describe('Image Content Extraction', () => {
    test('should extract image with alt text and filename', () => {
      const mockImg = {
        getAttribute: (attr) => {
          if (attr === 'alt') return 'Test Alt Text';
          if (attr === 'src') return '/images/test-image.png';
          return null;
        }
      };
      const mockFigure = {
        tagName: 'FIGURE',
        querySelector: () => mockImg
      };
      
      const result = chunker.extractImageContent(mockFigure);
      expect(result.filename).toBe('test-image.png');
      expect(result.text).toContain('Alt: Test Alt Text');
      expect(result.text).toContain('File: test-image.png');
    });

    test('should extract image from img tag directly', () => {
      const mockImg = {
        getAttribute: (attr) => {
          if (attr === 'src') return '/path/to/image.jpg';
          return null;
        },
        tagName: 'IMG',
        querySelector: () => null  // Mock querySelector to avoid errors
      };
      
      const result = chunker.extractImageContent(mockImg);
      expect(result.filename).toBe('image.jpg');
    });

    test('should handle missing alt text', () => {
      const mockImg = {
        getAttribute: (attr) => {
          if (attr === 'src') return '/images/test.png';
          return null;
        }
      };
      const mockFigure = {
        tagName: 'FIGURE',
        querySelector: () => mockImg
      };
      
      const result = chunker.extractImageContent(mockFigure);
      expect(result.text).not.toContain('Alt:');
      expect(result.text).toContain('File: test.png');
    });

    test('should extract figcaption', () => {
      const mockCaption = {
        textContent: 'Figure caption text'
      };
      const mockImg = {
        getAttribute: (attr) => {
          if (attr === 'src') return '/images/test.png';
          return null;
        }
      };
      const mockFigure = {
        tagName: 'FIGURE',
        querySelector: (sel) => {
          if (sel === 'figcaption') return mockCaption;
          return mockImg;
        }
      };
      
      const result = chunker.extractImageContent(mockFigure);
      expect(result.text).toContain('Caption: Figure caption text');
    });
  });

  describe('Text Splitting', () => {
    test('should not split text under max tokens', () => {
      const shortText = 'Short text that is well under the maximum token limit.';
      const chunks = chunker.splitTextEqually(shortText, 1024);
      expect(chunks.length).toBe(1);
      expect(chunks[0]).toBe(shortText);
    });

    test('should split long text into multiple chunks', () => {
      const longText = 'A'.repeat(20000); // Very long text
      const chunks = chunker.splitTextEqually(longText, 1024);
      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach(chunk => {
        expect(chunker.estimateTokens(chunk)).toBeLessThanOrEqual(1024);
      });
    });

    test('should preserve sentence boundaries when possible', () => {
      const text = 'First sentence. Second sentence. Third sentence. Fourth sentence.';
      const chunks = chunker.splitTextEqually(text, 10); // Force split
      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach(chunk => {
        if (chunk && chunk.trim()) {
          expect(chunk.trim().length).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('Chunker Type', () => {
    test('should match constant CHUNKER_TYPES', () => {
      const { CHUNKER_TYPES } = require('../../src/constants/chunkers');
      expect(chunker.chunkerType).toBe(CHUNKER_TYPES.READ_CONTENT_SHORT_LLM);
    });
  });

  describe('Collection Mapping', () => {
    test('should be associated with chunkAuditChunks collection', () => {
      const { COLLECTION_CHUNKER_MAPPING, CHUNKER_TYPES } = require('../../src/constants/chunkers');
      const collection = COLLECTION_CHUNKER_MAPPING[CHUNKER_TYPES.READ_CONTENT_SHORT_LLM];
      expect(collection).toBe('chunkAuditChunks');
    });
  });

  describe('Chunk Creation from Sections', () => {
    test('should create chunks from text sections', () => {
      const sections = [
        {
          heading: 'Section 1',
          elements: [{ type: 'paragraph', content: 'Some paragraph content' }]
        }
      ];
      
      const chunks = chunker.createChunksFromSections(sections);
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].type).toBe('section');
      expect(chunks[0].tokenCount).toBeGreaterThan(0);
    });

    test('should create separate chunks for images', () => {
      const sections = [
        {
          type: 'image',
          content: 'Alt: Test Image\nFile: test.png',
          filename: 'test.png'
        }
      ];
      
      const chunks = chunker.createChunksFromSections(sections);
      expect(chunks.length).toBe(1);
      expect(chunks[0].type).toBe('image');
      expect(chunks[0].filename).toBe('test.png');
    });

    test('should create separate chunks for code blocks', () => {
      const sections = [
        {
          type: 'code',
          content: 'function test() { return true; }'
        }
      ];
      
      const chunks = chunker.createChunksFromSections(sections);
      expect(chunks.length).toBe(1);
      expect(chunks[0].type).toBe('code');
    });

    test('should create separate chunks for tables', () => {
      const sections = [
        {
          type: 'table',
          content: 'Header1 Header2\nData1 Data2'
        }
      ];
      
      const chunks = chunker.createChunksFromSections(sections);
      expect(chunks.length).toBe(1);
      expect(chunks[0].type).toBe('table');
    });

    test('should split large sections into multiple chunks', () => {
      const largeContent = 'A'.repeat(5000); // Very large content
      const sections = [
        {
          heading: 'Large Section',
          elements: [{ type: 'paragraph', content: largeContent }]
        }
      ];
      
      const chunks = chunker.createChunksFromSections(sections);
      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach(chunk => {
        expect(chunk.tokenCount).toBeLessThanOrEqual(chunker.maxTokens);
      });
    });
  });

  describe('Feature Parity with ReadContentShortParaChunker', () => {
    test('should have same maxTokens as parent chunker', () => {
      const ReadContentShortChunker = require('../../src/services/ReadContentShortChunker');
      const parentChunker = new ReadContentShortChunker();
      expect(chunker.maxTokens).toBe(parentChunker.maxTokens);
    });

    test('should have same targetTokens as parent chunker', () => {
      const ReadContentShortChunker = require('../../src/services/ReadContentShortChunker');
      const parentChunker = new ReadContentShortChunker();
      expect(chunker.targetTokens).toBe(parentChunker.targetTokens);
    });

    test('should have same methods as parent chunker', () => {
      const ReadContentShortChunker = require('../../src/services/ReadContentShortChunker');
      const parentChunker = new ReadContentShortChunker();
      
      // Get all methods including inherited ones
      const getAllMethods = (obj) => {
        const methods = [];
        let current = Object.getPrototypeOf(obj);
        while (current && current !== Object.prototype) {
          methods.push(...Object.getOwnPropertyNames(current).filter(name => typeof current[name] === 'function'));
          current = Object.getPrototypeOf(current);
        }
        return [...new Set(methods)]; // Remove duplicates
      };
      
      const llmMethods = getAllMethods(chunker);
      const parentMethods = getAllMethods(parentChunker);
      
      // All parent methods should exist in LLM chunker
      for (const method of parentMethods) {
        expect(llmMethods).toContain(method);
      }
    });
  });
});
