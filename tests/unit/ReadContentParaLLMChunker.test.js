/**
 * Tests for ReadContentParaLLMChunker
 * 
 * This chunker combines:
 * - Paragraph-level chunking (one paragraph per chunk)
 * - LLM enhancements for images, tables, and code blocks
 */

const ReadContentParaLLMChunker = require('../../src/services/ReadContentParaLLMChunker');
const AzureOpenAIService = require('../../src/services/azureOpenAI');
const { CHUNKER_TYPES } = require('../../src/constants/chunkers');

// Mock the Azure OpenAI service
jest.mock('../../src/services/azureOpenAI');

describe('ReadContentParaLLMChunker', () => {
  let chunker;
  let mockAzureOpenAI;

  beforeEach(() => {
    // Reset mock
    jest.clearAllMocks();
    
    // Create mock instance
    mockAzureOpenAI = {
      generateResponse: jest.fn(),
      generateResponseWithCosts: jest.fn(),
      hasValidConfig: true
    };
    
    AzureOpenAIService.mockImplementation(() => mockAzureOpenAI);
    
    chunker = new ReadContentParaLLMChunker();
  });

  describe('Initialization', () => {
    test('should initialize with correct chunker type', () => {
      expect(chunker.chunkerType).toBe('READ-CONTENT-PARA-LLM');
    });

    test('should have correct max tokens from parent', () => {
      expect(chunker.maxTokens).toBe(2048);
    });

    test('should have correct target tokens from parent', () => {
      expect(chunker.targetTokens).toBe(512);
    });

    test('should have AzureOpenAI service initialized', () => {
      expect(chunker.azureOpenAI).toBeDefined();
    });
  });

  describe('Inheritance from ReadContentParaChunker', () => {
    test('should inherit paragraph-per-chunk behavior', () => {
      const sections = [
        {
          heading: 'Test Section',
          elements: [
            { type: 'paragraph', content: 'First paragraph.' },
            { type: 'paragraph', content: 'Second paragraph.' }
          ]
        }
      ];

      const chunks = chunker.createChunksFromSections(sections);

      // Should create one chunk per paragraph
      expect(chunks.length).toBe(2);
      expect(chunks[0].type).toBe('paragraph');
      expect(chunks[1].type).toBe('paragraph');
    });

    test('should handle images like parent chunker', () => {
      const sections = [
        { type: 'image', content: 'Image alt text', filename: 'test.png' }
      ];

      const chunks = chunker.createChunksFromSections(sections);

      expect(chunks.length).toBe(1);
      expect(chunks[0].type).toBe('image');
      expect(chunks[0].filename).toBe('test.png');
    });

    test('should handle tables like parent chunker', () => {
      const sections = [
        { type: 'table', content: 'Table content' }
      ];

      const chunks = chunker.createChunksFromSections(sections);

      expect(chunks.length).toBe(1);
      expect(chunks[0].type).toBe('table');
    });

    test('should handle code blocks like parent chunker', () => {
      const sections = [
        { type: 'code', content: 'const x = 5;' }
      ];

      const chunks = chunker.createChunksFromSections(sections);

      expect(chunks.length).toBe(1);
      expect(chunks[0].type).toBe('code');
    });
  });

  describe('LLM Prompt Generation', () => {
    test('should generate image description prompt with metadata', () => {
      const chunkData = {
        content: 'Alt text for image',
        filename: 'diagram.png',
        caption: 'Figure 1: System Architecture'
      };

      const prompt = chunker.generateImageDescriptionPrompt(chunkData);

      expect(prompt).toContain('Filename: diagram.png');
      expect(prompt).toContain('Caption: Figure 1: System Architecture');
      expect(prompt).toContain('Metadata: Alt text for image');
      expect(prompt).toContain('semantic search');
    });

    test('should generate code description prompt', () => {
      const chunkData = {
        content: 'function hello() { return "world"; }',
        caption: 'Listing 1: Hello function'
      };

      const prompt = chunker.generateCodeDescriptionPrompt(chunkData);

      expect(prompt).toContain('Caption: Listing 1: Hello function');
      expect(prompt).toContain('function hello()');
      expect(prompt).toContain('semantic search');
    });

    test('should generate table description prompt', () => {
      const chunkData = {
        content: 'Column A | Column B\n1 | 2\n3 | 4',
        caption: 'Table 1: Results'
      };

      const prompt = chunker.generateTableDescriptionPrompt(chunkData);

      expect(prompt).toContain('Caption: Table 1: Results');
      expect(prompt).toContain('Column A');
      expect(prompt).toContain('semantic search');
    });
  });

  describe('Chunker Type Validation', () => {
    test('should match constant CHUNKER_TYPES', () => {
      expect(chunker.chunkerType).toBe(CHUNKER_TYPES.READ_CONTENT_PARA_LLM);
    });
  });

  describe('Collection Mapping', () => {
    test('should be associated with chunkAuditChunks collection', () => {
      const { COLLECTION_CHUNKER_MAPPING } = require('../../src/constants/chunkers');
      expect(COLLECTION_CHUNKER_MAPPING[CHUNKER_TYPES.READ_CONTENT_PARA_LLM]).toBe('chunkAuditChunks');
    });
  });

  describe('Method Availability', () => {
    test('should have generateImageDescriptionPrompt method', () => {
      expect(typeof chunker.generateImageDescriptionPrompt).toBe('function');
    });

    test('should have generateCodeDescriptionPrompt method', () => {
      expect(typeof chunker.generateCodeDescriptionPrompt).toBe('function');
    });

    test('should have generateTableDescriptionPrompt method', () => {
      expect(typeof chunker.generateTableDescriptionPrompt).toBe('function');
    });

    test('should have generateLLMDescription method', () => {
      expect(typeof chunker.generateLLMDescription).toBe('function');
    });

    test('should have processChunks method', () => {
      expect(typeof chunker.processChunks).toBe('function');
    });

    test('should inherit createChunksFromSections from parent', () => {
      expect(typeof chunker.createChunksFromSections).toBe('function');
    });
  });

  describe('Feature Parity with ReadContentParaChunker', () => {
    test('should have same maxTokens as parent chunker', () => {
      const ReadContentParaChunker = require('../../src/services/ReadContentParaChunker');
      const parentChunker = new ReadContentParaChunker();
      expect(chunker.maxTokens).toBe(parentChunker.maxTokens);
    });

    test('should have same targetTokens as parent chunker', () => {
      const ReadContentParaChunker = require('../../src/services/ReadContentParaChunker');
      const parentChunker = new ReadContentParaChunker();
      expect(chunker.targetTokens).toBe(parentChunker.targetTokens);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty sections array', () => {
      const chunks = chunker.createChunksFromSections([]);
      expect(chunks).toEqual([]);
    });

    test('should handle section with no elements', () => {
      const sections = [
        { heading: 'Empty Section', elements: [] }
      ];

      const chunks = chunker.createChunksFromSections(sections);
      
      // Should create one chunk for the heading
      expect(chunks.length).toBe(1);
      expect(chunks[0].content).toBe('Empty Section');
    });

    test('should handle mixed content correctly', () => {
      const sections = [
        {
          heading: 'Introduction',
          elements: [
            { type: 'paragraph', content: 'First paragraph.' }
          ]
        },
        { type: 'image', content: 'Image description', filename: 'img.png' },
        {
          elements: [
            { type: 'paragraph', content: 'Second paragraph.' }
          ]
        },
        { type: 'table', content: 'Table data' }
      ];

      const chunks = chunker.createChunksFromSections(sections);

      // Should have 4 chunks: 2 paragraphs + 1 image + 1 table
      expect(chunks.length).toBe(4);
      expect(chunks[0].type).toBe('paragraph'); // heading + first para
      expect(chunks[1].type).toBe('image');
      expect(chunks[2].type).toBe('paragraph');
      expect(chunks[3].type).toBe('table');
    });
  });
});
