const ReadContentShortLLMChunker = require('../../src/services/ReadContentShortLLMChunker');
const AzureOpenAIService = require('../../src/services/azureOpenAI');
const { JSDOM } = require('jsdom');

// Mock the Azure OpenAI service
jest.mock('../../src/services/azureOpenAI');

describe('ReadContentShortLLMChunker', () => {
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
    
    chunker = new ReadContentShortLLMChunker();
  });

  describe('Image Description Prompts', () => {
    test('should generate prompt with filename and caption', () => {
      const chunkData = {
        content: 'Alt: Architecture diagram\nFile: architecture.png',
        filename: 'architecture.png',
        caption: 'Figure 1: System Architecture Overview',
        type: 'image'
      };

      const prompt = chunker.generateImageDescriptionPrompt(chunkData);

      expect(prompt).toContain('architecture.png');
      expect(prompt).toContain('Figure 1: System Architecture Overview');
      expect(prompt).toContain('semantic search');
    });

    test('should generate prompt with only filename', () => {
      const chunkData = {
        content: 'File: diagram.png',
        filename: 'diagram.png',
        type: 'image'
      };

      const prompt = chunker.generateImageDescriptionPrompt(chunkData);

      expect(prompt).toContain('diagram.png');
      expect(prompt).not.toContain('Caption:');
    });

    test('should generate prompt with only caption', () => {
      const chunkData = {
        content: 'Alt: Some alt text',
        caption: 'Table 1: Database schema',
        type: 'image'
      };

      const prompt = chunker.generateImageDescriptionPrompt(chunkData);

      expect(prompt).toContain('Table 1: Database schema');
      expect(prompt).toContain('semantic search');
    });
  });

  describe('Code Description Prompts', () => {
    test('should generate prompt with code content and caption', () => {
      const chunkData = {
        content: 'function calculateTotal(items) {\n  return items.reduce((sum, item) => sum + item.price, 0);\n}',
        caption: 'Listing 1: Calculate total price',
        type: 'code'
      };

      const prompt = chunker.generateCodeDescriptionPrompt(chunkData);

      expect(prompt).toContain('Listing 1: Calculate total price');
      expect(prompt).toContain('calculateTotal');
      expect(prompt).toContain('programming language');
      expect(prompt).toContain('semantic search');
    });

    test('should generate prompt for code without caption', () => {
      const chunkData = {
        content: 'const x = 10;\nconsole.log(x);',
        type: 'code'
      };

      const prompt = chunker.generateCodeDescriptionPrompt(chunkData);

      expect(prompt).toContain('const x');
      expect(prompt).not.toContain('Caption:');
      expect(prompt).toContain('programming concepts');
    });

    test('should truncate very long code content', () => {
      const longCode = 'function test() {\n' + '  console.log("line");\n'.repeat(100) + '}';
      const chunkData = {
        content: longCode,
        type: 'code'
      };

      const prompt = chunker.generateCodeDescriptionPrompt(chunkData);

      expect(prompt.length).toBeLessThan(longCode.length + 500);
      expect(prompt).toContain('...');
    });
  });

  describe('Table Description Prompts', () => {
    test('should generate prompt with table content and caption', () => {
      const chunkData = {
        content: 'Name | Age | City\nJohn | 30 | NYC\nJane | 25 | LA',
        caption: 'Table 1: User demographics',
        type: 'table'
      };

      const prompt = chunker.generateTableDescriptionPrompt(chunkData);

      expect(prompt).toContain('Table 1: User demographics');
      expect(prompt).toContain('Name');
      expect(prompt).toContain('Age');
      expect(prompt).toContain('tabular data');
    });

    test('should generate prompt for table without caption', () => {
      const chunkData = {
        content: 'Product | Price\nWidget | $10\nGadget | $20',
        type: 'table'
      };

      const prompt = chunker.generateTableDescriptionPrompt(chunkData);

      expect(prompt).toContain('Product');
      expect(prompt).toContain('Price');
      expect(prompt).not.toContain('Caption:');
    });

    test('should truncate very long table content', () => {
      const longTable = 'Col1 | Col2\n' + 'Data | Data\n'.repeat(100);
      const chunkData = {
        content: longTable,
        type: 'table'
      };

      const prompt = chunker.generateTableDescriptionPrompt(chunkData);

      expect(prompt.length).toBeLessThan(longTable.length + 500);
      expect(prompt).toContain('...');
    });
  });

  describe('LLM Description Generation', () => {
    test('should generate description for image chunks', async () => {
      mockAzureOpenAI.generateResponseWithCosts.mockResolvedValue({
        content: 'This architecture diagram illustrates the system design.',
        inputTokens: 100,
        outputTokens: 50
      });

      const imageChunk = {
        content: 'Alt: Architecture\nFile: arch.png',
        filename: 'arch.png',
        type: 'image'
      };

      const description = await chunker.generateLLMDescription(imageChunk);
      expect(description).toBe('This architecture diagram illustrates the system design.');
      expect(mockAzureOpenAI.generateResponseWithCosts).toHaveBeenCalledWith(
        expect.any(String),
        { maxTokens: 400, temperature: 0.7 }
      );
    });

    test('should generate description for code chunks', async () => {
      mockAzureOpenAI.generateResponseWithCosts.mockResolvedValue({
        content: 'This function calculates the sum of array elements using reduce.',
        inputTokens: 100,
        outputTokens: 50
      });

      const codeChunk = {
        content: 'const sum = arr.reduce((a, b) => a + b, 0);',
        type: 'code'
      };

      const description = await chunker.generateLLMDescription(codeChunk);
      expect(description).toBe('This function calculates the sum of array elements using reduce.');
      expect(mockAzureOpenAI.generateResponseWithCosts).toHaveBeenCalled();
    });

    test('should generate description for table chunks', async () => {
      mockAzureOpenAI.generateResponseWithCosts.mockResolvedValue({
        content: 'This table presents performance metrics across different configurations.',
        inputTokens: 100,
        outputTokens: 50
      });

      const tableChunk = {
        content: 'Config | Speed\nA | 100ms\nB | 150ms',
        type: 'table'
      };

      const description = await chunker.generateLLMDescription(tableChunk);
      expect(description).toBe('This table presents performance metrics across different configurations.');
      expect(mockAzureOpenAI.generateResponseWithCosts).toHaveBeenCalled();
    });

    test('should return empty string for unsupported chunk types', async () => {
      const textChunk = {
        content: 'Some text',
        type: 'text'
      };

      const description = await chunker.generateLLMDescription(textChunk);
      expect(description).toBe('');
      expect(mockAzureOpenAI.generateResponseWithCosts).not.toHaveBeenCalled();
    });

    test('should handle LLM errors gracefully', async () => {
      // Mock Azure OpenAI to throw error
      mockAzureOpenAI.generateResponseWithCosts.mockRejectedValue(new Error('API Error'));

      const imageChunk = {
        content: 'Alt: Test\nFile: test.png',
        filename: 'test.png',
        type: 'image'
      };

      const description = await chunker.generateLLMDescription(imageChunk);
      expect(description).toBe('');
    });
  });

  describe('Chunk Processing', () => {
    test('should process image, code, and table chunks with LLM descriptions', async () => {
      // Mock different responses for different chunk types
      mockAzureOpenAI.generateResponseWithCosts
        .mockResolvedValueOnce({
          content: 'Generated description for the architecture diagram showing microservices.',
          inputTokens: 100,
          outputTokens: 50
        })
        .mockResolvedValueOnce({
          content: 'Generated description for the JavaScript function that calculates totals.',
          inputTokens: 100,
          outputTokens: 50
        })
        .mockResolvedValueOnce({
          content: 'Generated description for the performance comparison table.',
          inputTokens: 100,
          outputTokens: 50
        });

      const chunks = [
        {
          chunkType: 'IMAGE',
          chunkContent: 'Alt: Architecture\nFile: arch.png',
          metadata: {
            filename: 'arch.png',
            caption: 'Figure 1: Architecture'
          }
        },
        {
          chunkType: 'CODE',
          chunkContent: 'function calculate() { return 42; }',
          metadata: {
            caption: 'Listing 1: Calculate function'
          }
        },
        {
          chunkType: 'TABLE',
          chunkContent: 'Name | Value\nTest | 100',
          metadata: {
            caption: 'Table 1: Results'
          }
        },
        {
          chunkType: 'SECTION',
          chunkContent: 'Some regular text',
          metadata: {}
        }
      ];

      const processed = await chunker.processChunks(chunks, {});

      // Check image chunk was enhanced (description prepended to content)
      expect(processed[0].chunkContent).toContain('architecture diagram');
      expect(processed[0].chunkContent).toContain('Alt: Architecture');
      expect(processed[0].metadata.llmDescription).toBeDefined();
      expect(processed[0].metadata.llmProcessed).toBe(true);
      expect(processed[0].metadata.originalContent).toBeUndefined(); // Images don't need originalContent

      // Check code chunk was enhanced (description prepended, originalContent stored)
      expect(processed[1].chunkContent).toContain('JavaScript function');
      expect(processed[1].chunkContent).toContain('function calculate()');
      expect(processed[1].metadata.llmDescription).toContain('JavaScript function');
      expect(processed[1].metadata.originalContent).toBe('function calculate() { return 42; }');
      expect(processed[1].metadata.llmProcessed).toBe(true);

      // Check table chunk was enhanced (description prepended, originalContent stored)
      expect(processed[2].chunkContent).toContain('performance comparison');
      expect(processed[2].chunkContent).toContain('Name | Value');
      expect(processed[2].metadata.llmDescription).toContain('performance comparison');
      expect(processed[2].metadata.originalContent).toBe('Name | Value\nTest | 100');
      expect(processed[2].metadata.llmProcessed).toBe(true);

      // Check section chunk was not modified
      expect(processed[3].chunkContent).toBe('Some regular text');
      expect(processed[3].metadata.llmDescription).toBeUndefined();

      // Verify LLM was called 3 times (once for each special chunk type)
      expect(mockAzureOpenAI.generateResponseWithCosts).toHaveBeenCalledTimes(3);
    });

    test('should continue processing if one chunk fails', async () => {
      let callCount = 0;
      mockAzureOpenAI.generateResponseWithCosts.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('API Error'));
        }
        return Promise.resolve({
          content: 'Generated description for second image',
          inputTokens: 100,
          outputTokens: 50
        });
      });

      const chunks = [
        {
          chunkType: 'IMAGE',
          chunkContent: 'First image',
          metadata: { filename: 'first.png' }
        },
        {
          chunkType: 'IMAGE',
          chunkContent: 'Second image',
          metadata: { filename: 'second.png' }
        }
      ];

      const processed = await chunker.processChunks(chunks, {});

      // First chunk should not be enhanced (error)
      expect(processed[0].chunkContent).toBe('First image');
      expect(processed[0].metadata.llmProcessed).toBeUndefined();

      // Second chunk should be enhanced
      expect(processed[1].chunkContent).toContain('Generated description');
      expect(processed[1].metadata.llmProcessed).toBe(true);
    });
  });

  describe('Chunker Type', () => {
    test('should have correct chunker type', () => {
      expect(chunker.chunkerType).toBe('READ-CONTENT-SHORT-LLM');
    });
  });
});
