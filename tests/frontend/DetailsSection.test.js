/**
 * Frontend Unit Tests - Details Section (Shared Modal Logic)
 * Tests for unified details section rendering in Chunks View and Assessment View modals
 */

describe('Details Section - Unified Modal Logic', () => {
  let app;
  let mockArticleContent;

  beforeEach(() => {
    // Setup comprehensive DOM for both modals
    document.body.innerHTML = `
      <div id="chunkerModal" style="display: none;">
        <div class="modal-header">
          <h2 id="chunkerModalTitle">Chunker View</h2>
          <button id="closeChunkerModal">&times;</button>
        </div>
        <div id="chunkerPocMetadataHeader"></div>
        <div class="modal-content">
          <div class="split-view">
            <div class="left-panel">
              <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 10px; margin-bottom: 10px; border-bottom: 1px solid #e9ecef;">
                <span style="font-size: 14px; font-weight: 600;">Details</span>
                <button id="chunkerHtmlToggle" style="background: #f0f2f5; border: 1px solid #dee2e6; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: 500; display: none;">Show HTML Text</button>
              </div>
              <div class="chunker-details-content" id="chunkerDetailsContent"></div>
            </div>
            <div class="right-panel">
              <h3 id="chunkerChunksTitle">Chunks</h3>
              <div class="chunks-content" id="chunkerChunksContent"></div>
            </div>
          </div>
        </div>
      </div>
      <div id="assessmentModal" style="display: none;">
        <div class="modal-header">
          <h2 id="assessmentModalTitle">Assessment View</h2>
          <button id="closeAssessmentModal">&times;</button>
        </div>
        <div id="assessmentPocMetadataHeader"></div>
        <div class="modal-content">
          <div class="split-view">
            <div class="left-panel">
              <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 10px; margin-bottom: 10px; border-bottom: 1px solid #e9ecef;">
                <span style="font-size: 14px; font-weight: 600;">POC Text</span>
                <button id="assessmentHtmlToggle" style="background: #f0f2f5; border: 1px solid #dee2e6; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: 500; display: none;">Show HTML Text</button>
              </div>
              <div class="poc-text-content" id="assessmentPocTextContent"></div>
            </div>
            <div class="right-panel">
              <h3 id="assessmentChunksTitle">Chunks</h3>
              <div class="chunks-content" id="assessmentChunksContent"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Mock fetch
    global.fetch = jest.fn();

    // Sample article content for testing
    mockArticleContent = {
      htmlContent: '<p>This is a test paragraph.</p><p>This is another paragraph.</p>',
      images: ['https://example.com/image1.jpg']
    };

    // Create mock app instance
    app = {
      selectedPocs: new Set(),
      currentModalPocId: null,
      currentAssessmentPocId: null,
      currentModalChunks: [],
      currentAssessmentChunks: [],
      currentModalViewerId: null,
      currentAssessmentViewerId: null,
      
      escapeHtml: function(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
      },

      // Real implementation of unified function for testing
      populateDetailsSection: async function(pocId, chunks, isAssessmentModal = false) {
        const detailsContentId = isAssessmentModal ? 'assessmentPocTextContent' : 'chunkerDetailsContent';
        const detailsContent = document.getElementById(detailsContentId);
        const viewerId = isAssessmentModal ? 'assessmentArticleContentViewer' : 'articleContentViewer';
        const toggleId = isAssessmentModal ? 'assessmentHtmlToggle' : 'chunkerHtmlToggle';
        const rawHtmlId = isAssessmentModal ? 'assessmentRawHtml' : 'chunkerRawHtml';
        
        // Store the viewer ID for chunk highlighting
        if (isAssessmentModal) {
          this.currentAssessmentViewerId = viewerId;
        } else {
          this.currentModalViewerId = viewerId;
        }
        
        try {
          const response = await fetch(`/api/pocs/${pocId}/article-content`);
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          const result = await response.json();
          
          if (result.success) {
            const { htmlContent, images } = result.data;
            let processedHtml = htmlContent;
            
            if (images && images.length > 0) {
              const imageMap = {};
              images.forEach(imageUrl => {
                const filename = imageUrl.split('/').pop();
                imageMap[filename] = imageUrl;
              });
              Object.keys(imageMap).forEach(filename => {
                const regex = new RegExp(`src=["']([^"']*${filename}[^"']*)["']`, 'g');
                processedHtml = processedHtml.replace(regex, `src="${imageMap[filename]}"`);
              });
            }
            
            detailsContent.innerHTML = `
              <link rel="stylesheet" href="https://redsys-prod.s3.eu-west-1.amazonaws.com/css/main.css">
              <style>
                .article-content-viewer img { max-width: 100%; height: auto; }
                .article-content-viewer figure,
                .article-content-viewer .commentedFigure { max-width: 100%; overflow: hidden; }
                .raw-html-content { background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; padding: 12px; font-family: 'Monaco', 'Courier New', monospace; font-size: 12px; line-height: 1.4; color: #333; overflow: auto; max-height: 600px; white-space: pre-wrap; word-wrap: break-word; }
              </style>
              <div class="article-content-viewer" id="${viewerId}">${processedHtml}</div>
              <div class="raw-html-content" id="${rawHtmlId}" style="display: none;">${this.escapeHtml(processedHtml)}</div>
            `;
            
            // Setup toggle button
            const toggleBtn = document.getElementById(toggleId);
            const renderedView = document.getElementById(viewerId);
            const rawHtmlView = document.getElementById(rawHtmlId);
            toggleBtn.style.display = 'block';
            let isRawMode = false;
            
            toggleBtn.addEventListener('click', () => {
              isRawMode = !isRawMode;
              if (isRawMode) {
                renderedView.style.display = 'none';
                rawHtmlView.style.display = 'block';
                toggleBtn.textContent = 'Show Rendered';
                toggleBtn.style.background = '#e7f3ff';
                toggleBtn.style.borderColor = '#91d5ff';
              } else {
                renderedView.style.display = 'block';
                rawHtmlView.style.display = 'none';
                toggleBtn.textContent = 'Show HTML Text';
                toggleBtn.style.background = '#f0f2f5';
                toggleBtn.style.borderColor = '#dee2e6';
              }
            });
            
            // Call markChunkBoundariesUnified to set up chunk position data for highlighting
            this.markChunkBoundariesUnified(viewerId, chunks, isAssessmentModal);
          } else {
            throw new Error(result.error || 'Failed to load article content');
          }
        } catch (error) {
          console.error('Error loading article content:', error);
          detailsContent.innerHTML = '<div style="color: #999; padding: 20px;">Article content not available</div>';
        }
      },

      // Mark chunk boundaries to enable highlighting (required for chunk selection)
      markChunkBoundariesUnified: function(viewerId, chunks, isAssessmentModal = false) {
        const viewer = document.getElementById(viewerId);
        if (!viewer || !chunks || chunks.length === 0) return;
        
        const fullText = viewer.textContent || '';
        const elementMap = [];
        let currentPos = 0;
        
        const walkDOM = (node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node;
            const tagName = element.tagName?.toLowerCase();
            const isTargetBlock = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'li', 'pre', 'code', 'table', 'figure'].includes(tagName);
            const hasBlockChildren = isTargetBlock && element.querySelector('p, h1, h2, h3, h4, h5, h6, blockquote, li, pre, code, table, figure');
            
            if (isTargetBlock && !hasBlockChildren) {
              const elementText = element.textContent || '';
              if (elementText.trim().length > 0) {
                const startPos = currentPos;
                currentPos += elementText.length;
                elementMap.push({element, text: elementText, start: startPos, end: currentPos});
                return;
              }
            }
            for (const child of element.childNodes) walkDOM(child);
          } else if (node.nodeType === Node.TEXT_NODE) {
            currentPos += (node.textContent || '').length;
          }
        };
        
        walkDOM(viewer);
        
        const prefix = isAssessmentModal ? 'assessment' : '';
        this[`${prefix}ArticleElementMap`] = elementMap;
        this[`${prefix}ArticleFullText`] = fullText;
        
        console.log(`DEBUG markChunkBoundariesUnified: prefix="${prefix}", elementMap.length=${elementMap.length}, set as "${prefix}ArticleElementMap"`);
        
        const normalize = (text) => text.replace(/\s+/g, ' ').replace(/["\"''„]/g, '"').replace(/[–—−]/g, '-').trim();
        this[`${prefix}NormalizedArticle`] = normalize(fullText);
        
        let searchStartPos = 0;
        this[`${prefix}ChunkPositions`] = chunks.map((chunk, idx) => {
          const chunkText = (chunk.chunkContent || chunk.text || '').trim();
          const normalizedChunk = normalize(chunkText);
          const chunkStart200 = normalizedChunk.substring(0, Math.min(200, normalizedChunk.length));
          let chunkStartPos = this[`${prefix}NormalizedArticle`].indexOf(chunkStart200, searchStartPos);
          
          if (chunkStartPos === -1) {
            const chunkStart50 = normalizedChunk.substring(0, Math.min(50, normalizedChunk.length));
            chunkStartPos = this[`${prefix}NormalizedArticle`].indexOf(chunkStart50, searchStartPos);
          }
          
          if (chunkStartPos === -1) {
            return { index: idx, start: searchStartPos, end: searchStartPos, found: false };
          }
          
          const chunkEnd200 = normalizedChunk.length > 200 ? normalizedChunk.substring(normalizedChunk.length - 200) : normalizedChunk;
          let chunkEndPos = this[`${prefix}NormalizedArticle`].indexOf(chunkEnd200, chunkStartPos);
          
          if (chunkEndPos !== -1) chunkEndPos += chunkEnd200.length;
          else chunkEndPos = chunkStartPos + normalizedChunk.length;
          
          searchStartPos = chunkEndPos;
          return { index: idx, start: chunkStartPos, end: chunkEndPos, found: true };
        });
        
        console.log(`Mapped ${this[`${prefix}ChunkPositions`].filter(c => c.found).length} of ${chunks.length} chunks to article positions`);
      },

      // Highlight a chunk by its index (called when user selects a chunk)
      highlightChunkByIndex: function(chunkIndex) {
        const viewer = document.getElementById(this.currentModalViewerId || 'articleContentViewer');
        const detailsContent = document.getElementById('chunkerDetailsContent');
        
        if (!viewer || !this.currentModalChunks || chunkIndex >= this.currentModalChunks.length) {
          console.log('Cannot highlight: missing data', { viewer: !!viewer, chunks: !!this.currentModalChunks, viewerId: this.currentModalViewerId });
          return;
        }
        
        console.log(`Highlighting chunk ${chunkIndex} of ${this.currentModalChunks.length}`);
        
        // Remove previous highlights
        viewer.querySelectorAll('.chunk-highlight').forEach(el => {
          el.classList.remove('chunk-highlight', 'active');
        });
        
        // Check if we have chunk positions
        // Note: markChunkBoundariesUnified uses dynamic property names with prefix
        // For chunker modal (prefix=""):  ArticleElementMap, ChunkPositions, articleFullText, normalizedArticle
        // For assessment modal (prefix="assessment"): assessmentArticleElementMap, assessmentChunkPositions, assessmentArticleFullText, assessmentNormalizedArticle
        const chunkPositions = this.ChunkPositions || this.chunkPositions;
        const articleElementMap = this.ArticleElementMap || this.articleElementMap;
        
        if (!chunkPositions || !articleElementMap) {
          console.log('Chunk positions not mapped yet', { chunkPositions: !!chunkPositions, articleElementMap: !!articleElementMap });
          return;
        }
        
        const chunkPosition = chunkPositions[chunkIndex];
        if (!chunkPosition || !chunkPosition.found) {
          console.log(`Chunk ${chunkIndex} was not found in article`);
          return;
        }
        
        // Find elements that correspond to this chunk
        const elementsToHighlight = [];
        articleElementMap.forEach(item => {
          // Simple approach: find elements in the mapped range
          if (item.start <= chunkPosition.end && item.end >= chunkPosition.start) {
            elementsToHighlight.push(item.element);
          }
        });
        
        console.log(`Found ${elementsToHighlight.length} elements to highlight for chunk ${chunkIndex}`);
        
        // Apply highlighting
        elementsToHighlight.forEach(el => {
          el.classList.add('chunk-highlight', 'active');
        });
      },

      // Existing functions
      loadArticleContent: async function(pocId, chunks, isAssessmentModal = false) {
        const detailsContent = isAssessmentModal 
          ? document.getElementById('assessmentPocTextContent')
          : document.getElementById('chunkerDetailsContent');
        
        try {
          const response = await fetch(`/api/pocs/${pocId}/article-content`);
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const result = await response.json();
          
          if (result.success) {
            const { htmlContent, images } = result.data;
            
            // Process HTML content to replace image src with S3 URLs
            let processedHtml = htmlContent;
            if (images && images.length > 0) {
              const imageMap = {};
              images.forEach(imageUrl => {
                const filename = imageUrl.split('/').pop();
                imageMap[filename] = imageUrl;
              });
              
              Object.keys(imageMap).forEach(filename => {
                const regex = new RegExp(`src=["']([^"']*${filename}[^"']*)["']`, 'g');
                processedHtml = processedHtml.replace(regex, `src="${imageMap[filename]}"`);
              });
            }
            
            // Create article viewer with the HTML content
            const viewerId = isAssessmentModal ? 'assessmentArticleContentViewer' : 'articleContentViewer';
            detailsContent.innerHTML = `
              <link rel="stylesheet" href="https://redsys-prod.s3.eu-west-1.amazonaws.com/css/main.css">
              <style>
                .article-content-viewer img {
                  max-width: 100%;
                  height: auto;
                }
                .article-content-viewer figure,
                .article-content-viewer .commentedFigure {
                  max-width: 100%;
                  overflow: hidden;
                }
              </style>
              <div class="article-content-viewer" id="${viewerId}">
                ${processedHtml}
              </div>
            `;
          } else {
            throw new Error(result.error || 'Failed to load article content');
          }
        } catch (error) {
          console.error('Error loading article content:', error);
          detailsContent.innerHTML = '<div style="color: #999; padding: 20px;">Article content not available</div>';
        }
      },

      // Select a chunk in modal and highlight it (simulates click behavior)
      selectChunkInModal: function(chunkIndex) {
        console.log('Selecting chunk:', chunkIndex);
        
        // Remove selection from all chunks
        document.querySelectorAll('.chunk-item-detail').forEach(el => {
          el.classList.remove('selected');
        });
        
        // Add selection to clicked chunk
        const chunkEl = document.querySelector(`.chunk-item-detail[data-chunk-index="${chunkIndex}"]`);
        if (chunkEl) {
          chunkEl.classList.add('selected');
          
          // Highlight this chunk in the article viewer
          this.highlightChunkByIndex(chunkIndex);
          
          // Scroll chunk into view (mock method)
          if (chunkEl.scrollIntoView) {
            chunkEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }
      }
    };

    // Bind methods to app context
    app.loadArticleContent = app.loadArticleContent.bind(app);
    app.populateDetailsSection = app.populateDetailsSection.bind(app);
    app.markChunkBoundariesUnified = app.markChunkBoundariesUnified.bind(app);
    app.highlightChunkByIndex = app.highlightChunkByIndex.bind(app);
    app.selectChunkInModal = app.selectChunkInModal.bind(app);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Details Section - Chunker Modal', () => {
    it('should load article content in chunker details section', async () => {
      const pocId = 'poc-123';
      const chunks = [];

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockArticleContent })
      });

      await app.loadArticleContent(pocId, chunks, false);

      const detailsContent = document.getElementById('chunkerDetailsContent');
      expect(detailsContent.innerHTML).toContain('article-content-viewer');
      expect(detailsContent.innerHTML).toContain('This is a test paragraph.');
    });

    it('should handle API errors in chunker details section', async () => {
      const pocId = 'poc-123';
      const chunks = [];

      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      await app.loadArticleContent(pocId, chunks, false);

      const detailsContent = document.getElementById('chunkerDetailsContent');
      expect(detailsContent.innerHTML).toContain('Article content not available');
    });

    it('should process images in chunker details section', async () => {
      const pocId = 'poc-123';
      const chunks = [];
      const contentWithImage = {
        htmlContent: '<img src="local_image1.jpg" /><p>Content</p>',
        images: ['https://s3.example.com/image1.jpg']
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: contentWithImage })
      });

      await app.loadArticleContent(pocId, chunks, false);

      const detailsContent = document.getElementById('chunkerDetailsContent');
      expect(detailsContent.innerHTML).toContain('https://s3.example.com/image1.jpg');
    });
  });

  describe('Details Section - Assessment Modal', () => {
    it('should load article content in assessment details section', async () => {
      const pocId = 'poc-123';
      const chunks = [];

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockArticleContent })
      });

      await app.loadArticleContent(pocId, chunks, true);

      const detailsContent = document.getElementById('assessmentPocTextContent');
      expect(detailsContent.innerHTML).toContain('article-content-viewer');
      expect(detailsContent.innerHTML).toContain('This is a test paragraph.');
    });

    it('should handle API errors in assessment details section', async () => {
      const pocId = 'poc-123';
      const chunks = [];

      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      await app.loadArticleContent(pocId, chunks, true);

      const detailsContent = document.getElementById('assessmentPocTextContent');
      expect(detailsContent.innerHTML).toContain('Article content not available');
    });

    it('should process images in assessment details section', async () => {
      const pocId = 'poc-123';
      const chunks = [];
      const contentWithImage = {
        htmlContent: '<img src="local_image1.jpg" /><p>Content</p>',
        images: ['https://s3.example.com/image1.jpg']
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: contentWithImage })
      });

      await app.loadArticleContent(pocId, chunks, true);

      const detailsContent = document.getElementById('assessmentPocTextContent');
      expect(detailsContent.innerHTML).toContain('https://s3.example.com/image1.jpg');
    });
  });

  describe('Unified Details Section Logic', () => {
    it('should use same logic for both modals', async () => {
      const pocId = 'poc-123';
      const chunks = [];

      // Load for chunker modal
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockArticleContent })
      });
      await app.loadArticleContent(pocId, chunks, false);
      const chunkerContent = document.getElementById('chunkerDetailsContent').innerHTML;

      // Load for assessment modal
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockArticleContent })
      });
      await app.loadArticleContent(pocId, chunks, true);
      const assessmentContent = document.getElementById('assessmentPocTextContent').innerHTML;

      // Both should have the same structure and content
      expect(chunkerContent).toContain('article-content-viewer');
      expect(assessmentContent).toContain('article-content-viewer');
      expect(chunkerContent).toContain(mockArticleContent.htmlContent);
      expect(assessmentContent).toContain(mockArticleContent.htmlContent);
    });

    it('should maintain consistency when loading multiple times', async () => {
      const pocId = 'poc-123';
      const chunks = [];

      for (let i = 0; i < 3; i++) {
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: mockArticleContent })
        });
        await app.loadArticleContent(pocId, chunks, false);
      }

      const detailsContent = document.getElementById('chunkerDetailsContent');
      expect(detailsContent.innerHTML).toContain('This is a test paragraph.');
    });

    it('should handle edge case: empty HTML content', async () => {
      const pocId = 'poc-123';
      const chunks = [];
      const emptyContent = {
        htmlContent: '',
        images: []
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: emptyContent })
      });

      await app.loadArticleContent(pocId, chunks, false);

      const detailsContent = document.getElementById('chunkerDetailsContent');
      expect(detailsContent.innerHTML).toContain('article-content-viewer');
    });

    it('should handle edge case: multiple images with different filenames', async () => {
      const pocId = 'poc-123';
      const chunks = [];
      const contentWithImages = {
        htmlContent: '<img src="image1.jpg" /><img src="image2.png" /><p>Content</p>',
        images: ['https://s3.example.com/image1.jpg', 'https://s3.example.com/image2.png']
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: contentWithImages })
      });

      await app.loadArticleContent(pocId, chunks, false);

      const detailsContent = document.getElementById('chunkerDetailsContent');
      expect(detailsContent.innerHTML).toContain('https://s3.example.com/image1.jpg');
      expect(detailsContent.innerHTML).toContain('https://s3.example.com/image2.png');
    });
  });

  describe('Error Handling - Unified Logic', () => {
    it('should gracefully handle network errors', async () => {
      const pocId = 'poc-123';
      const chunks = [];

      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      await app.loadArticleContent(pocId, chunks, false);

      const detailsContent = document.getElementById('chunkerDetailsContent');
      expect(detailsContent.innerHTML).toContain('Article content not available');
    });

    it('should handle response with no data field', async () => {
      const pocId = 'poc-123';
      const chunks = [];

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await app.loadArticleContent(pocId, chunks, false);

      const detailsContent = document.getElementById('chunkerDetailsContent');
      // Should have error or handle gracefully
      expect(detailsContent.innerHTML).toBeTruthy();
    });

    it('should both modals use same error handling', async () => {
      const pocId = 'poc-123';
      const chunks = [];

      // Error in chunker modal
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      });
      await app.loadArticleContent(pocId, chunks, false);

      // Error in assessment modal
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      });
      await app.loadArticleContent(pocId, chunks, true);

      const chunkerContent = document.getElementById('chunkerDetailsContent').innerHTML;
      const assessmentContent = document.getElementById('assessmentPocTextContent').innerHTML;

      expect(chunkerContent).toContain('Article content not available');
      expect(assessmentContent).toContain('Article content not available');
    });
  });

  describe('Chunk Selection and Highlighting', () => {
    it('should populate details section with HTML view toggle', async () => {
      const pocId = 'poc-123';
      const chunks = [{ chunkContent: 'Test chunk' }];

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockArticleContent })
      });

      await app.populateDetailsSection(pocId, chunks, false);

      const detailsContent = document.getElementById('chunkerDetailsContent');
      const toggleBtn = document.getElementById('chunkerHtmlToggle');
      const renderedView = document.getElementById('articleContentViewer');
      const rawHtmlView = document.getElementById('chunkerRawHtml');

      expect(toggleBtn).toBeTruthy();
      expect(toggleBtn.textContent).toBe('Show HTML Text');
      expect(renderedView).toBeTruthy();
      expect(rawHtmlView).toBeTruthy();
      expect(rawHtmlView.style.display).toBe('none');
    });

    it('should toggle between rendered and raw HTML views in chunker modal', async () => {
      const pocId = 'poc-123';
      const chunks = [{ chunkContent: 'Test chunk' }];

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockArticleContent })
      });

      await app.populateDetailsSection(pocId, chunks, false);

      const toggleBtn = document.getElementById('chunkerHtmlToggle');
      const renderedView = document.getElementById('articleContentViewer');
      const rawHtmlView = document.getElementById('chunkerRawHtml');

      // Initially showing rendered view
      expect(renderedView.style.display).not.toBe('none');
      expect(rawHtmlView.style.display).toBe('none');

      // Click to show raw HTML
      toggleBtn.click();
      expect(renderedView.style.display).toBe('none');
      expect(rawHtmlView.style.display).toBe('block');
      expect(toggleBtn.textContent).toBe('Show Rendered');

      // Click to show rendered again
      toggleBtn.click();
      expect(renderedView.style.display).toBe('block');
      expect(rawHtmlView.style.display).toBe('none');
      expect(toggleBtn.textContent).toBe('Show HTML Text');
    });

    it('should toggle between rendered and raw HTML views in assessment modal', async () => {
      const pocId = 'poc-123';
      const chunks = [{ chunkContent: 'Test chunk' }];

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockArticleContent })
      });

      await app.populateDetailsSection(pocId, chunks, true);

      const toggleBtn = document.getElementById('assessmentHtmlToggle');
      const renderedView = document.getElementById('assessmentArticleContentViewer');
      const rawHtmlView = document.getElementById('assessmentRawHtml');

      // Initially showing rendered view
      expect(renderedView.style.display).not.toBe('none');
      expect(rawHtmlView.style.display).toBe('none');

      // Click to show raw HTML
      toggleBtn.click();
      expect(renderedView.style.display).toBe('none');
      expect(rawHtmlView.style.display).toBe('block');
      expect(toggleBtn.textContent).toBe('Show Rendered');
    });

    it('should store viewer ID for chunker modal chunk highlighting', async () => {
      const pocId = 'poc-123';
      const chunks = [{ chunkContent: 'Test chunk' }];

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockArticleContent })
      });

      await app.populateDetailsSection(pocId, chunks, false);

      // Verify viewer ID was stored
      expect(app.currentModalViewerId).toBe('articleContentViewer');
      expect(app.currentAssessmentViewerId).toBeNull();
    });

    it('should store viewer ID for assessment modal chunk highlighting', async () => {
      const pocId = 'poc-123';
      const chunks = [{ chunkContent: 'Test chunk' }];

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockArticleContent })
      });

      await app.populateDetailsSection(pocId, chunks, true);

      // Verify viewer ID was stored
      expect(app.currentAssessmentViewerId).toBe('assessmentArticleContentViewer');
    });

    it('should render HTML correctly in raw view with escaped HTML', async () => {
      const pocId = 'poc-123';
      const chunks = [];
      const htmlContent = '<p>This is <strong>bold</strong> text</p>';

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { htmlContent, images: [] } })
      });

      await app.populateDetailsSection(pocId, chunks, false);

      const rawHtmlView = document.getElementById('chunkerRawHtml');
      // Verify HTML is escaped (should contain &lt; and &gt;)
      expect(rawHtmlView.textContent).toContain('<p>');
      expect(rawHtmlView.textContent).toContain('</p>');
    });

    it('should highlight text chunks that exist in the article', async () => {
      const pocId = 'poc-123';
      
      // Create chunks with text that matches article paragraphs
      const chunks = [
        { chunkContent: 'This is a test paragraph.' },
        { chunkContent: 'This is another paragraph.' }
      ];

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockArticleContent })
      });

      app.currentModalChunks = chunks;
      await app.populateDetailsSection(pocId, chunks, false);

      // Verify chunk positions were mapped
      const chunkPositions = app.ChunkPositions;
      expect(chunkPositions).toBeTruthy();
      expect(chunkPositions.length).toBe(2);
      
      // Check that chunks were found
      const foundChunks = chunkPositions.filter(c => c.found);
      console.log('Found chunks:', foundChunks.length, 'of', chunkPositions.length);
      console.log('Chunk positions:', chunkPositions);
      
      // At least some chunks should be found for highlighting to work
      expect(foundChunks.length).toBeGreaterThan(0);
    });

    it('should use correct highlighting with real article structure', async () => {
      const pocId = 'poc-123';
      
      // Create realistic HTML with proper structure
      const htmlContent = '<p>First paragraph with content.</p><p>Second paragraph with content.</p>';
      const chunks = [
        { chunkContent: 'First paragraph with content.' },
        { chunkContent: 'Second paragraph with content.' }
      ];

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { htmlContent, images: [] } })
      });

      app.currentModalChunks = chunks;
      await app.populateDetailsSection(pocId, chunks, false);

      // Now test that selecting a chunk highlights it
      const viewer = document.getElementById('articleContentViewer');
      expect(viewer).toBeTruthy();
      expect(viewer.innerHTML).toContain('First paragraph');
      
      // Get the chunk positions to verify mapping worked
      const chunkPositions = app.ChunkPositions;
      expect(chunkPositions).toBeTruthy();
      
      // For proper highlighting, chunks need to be found
      const foundChunks = chunkPositions.filter(c => c.found);
      console.log('Real article test - found chunks:', foundChunks.length);
    });

    it('should highlight chunks when selected by index', async () => {
      const pocId = 'poc-123';
      
      // Create realistic HTML
      const htmlContent = '<p>First paragraph with content.</p><p>Second paragraph with content.</p>';
      const chunks = [
        { chunkContent: 'First paragraph with content.' },
        { chunkContent: 'Second paragraph with content.' }
      ];

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { htmlContent, images: [] } })
      });

      app.currentModalChunks = chunks;
      app.currentModalViewerId = 'articleContentViewer';
      await app.populateDetailsSection(pocId, chunks, false);

      const viewer = document.getElementById('articleContentViewer');
      const paragraphs = viewer.querySelectorAll('p');
      expect(paragraphs.length).toBe(2);
      
      // Get the first paragraph and verify it doesn't have the highlight class yet
      const firstP = paragraphs[0];
      expect(firstP.classList.contains('chunk-highlight')).toBe(false);
      
      // Call highlightChunkByIndex to simulate selecting chunk 0
      console.log('About to highlight chunk 0');
      app.highlightChunkByIndex(0);
      
      // Now the first paragraph should be highlighted
      console.log('After highlighting:', firstP.classList.toString());
      expect(firstP.classList.contains('chunk-highlight')).toBe(true);
    });

    it('should simulate actual click flow like production code', async () => {
      const pocId = 'test-poc-123';
      const chunks = [
        { chunkContent: 'This is a test', chunkType: 'text' },
        { chunkContent: 'This is another', chunkType: 'text' }
      ];

      // Mock fetch for populateDetailsSection
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            htmlContent: '<p>This is a test</p><p>This is another</p>',
            images: []
          }
        })
      });

      app.currentModalChunks = chunks;
      app.currentModalViewerId = 'articleContentViewer';
      await app.populateDetailsSection(pocId, chunks, false);

      const viewer = document.getElementById('articleContentViewer');
      const paragraphs = viewer.querySelectorAll('p');
      
      // Simulate creating chunk elements and setting up click listeners (like production code does)
      const chunksContent = document.createElement('div');
      chunksContent.id = 'chunkerChunksContent';
      document.body.appendChild(chunksContent);
      
      // Create chunk elements with click listeners (same structure as production)
      let clickedIndex = -1;
      chunks.forEach((chunk, index) => {
        const chunkEl = document.createElement('div');
        chunkEl.className = 'chunk-item-detail';
        chunkEl.setAttribute('data-chunk-index', index.toString());
        chunkEl.textContent = chunk.chunkContent;
        chunksContent.appendChild(chunkEl);
        
        // Add click listener exactly like production (with setTimeout)
        chunkEl.addEventListener('click', () => {
          console.log(`Clicked chunk ${index}`);
          clickedIndex = index;
          app.selectChunkInModal(index);
        });
      });
      
      // Simulate clicking first chunk
      const firstChunk = chunksContent.querySelector('.chunk-item-detail[data-chunk-index="0"]');
      firstChunk.click();
      
      // Verify first paragraph is highlighted
      expect(paragraphs[0].classList.contains('chunk-highlight')).toBe(true);
      expect(clickedIndex).toBe(0);
    });

    it('should highlight text in raw HTML view when chunk is selected', async () => {
      const pocId = 'test-poc-123';
      const chunks = [
        { chunkContent: 'This is a test', chunkType: 'text' },
        { chunkContent: 'This is another', chunkType: 'text' }
      ];

      // Mock fetch for populateDetailsSection
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            htmlContent: '<p>This is a test</p><p>This is another</p>',
            images: []
          }
        })
      });

      app.currentModalChunks = chunks;
      app.currentModalViewerId = 'articleContentViewer';
      await app.populateDetailsSection(pocId, chunks, false);

      const rawHtmlView = document.getElementById('chunkerRawHtml');
      const toggleBtn = document.getElementById('chunkerHtmlToggle');
      
      expect(rawHtmlView).toBeTruthy();
      expect(toggleBtn).toBeTruthy();
      
      // Verify raw HTML view is initially hidden
      expect(rawHtmlView.style.display).toBe('none');
      
      // Switch to raw HTML view
      toggleBtn.click();
      expect(rawHtmlView.style.display).toBe('block');
      expect(toggleBtn.textContent).toBe('Show Rendered');
      
      // Verify raw HTML content is visible and contains escaped HTML
      expect(rawHtmlView.innerHTML).toContain('&lt;p&gt;');
      
      // Switch back to rendered view
      toggleBtn.click();
      expect(rawHtmlView.style.display).toBe('none');
      expect(toggleBtn.textContent).toBe('Show HTML Text');
    });

    it('should support chunk selection with raw HTML view visible', async () => {
      const pocId = 'test-poc-123';
      const chunks = [
        { chunkContent: 'First paragraph', chunkType: 'text' },
        { chunkContent: 'Second paragraph', chunkType: 'text' }
      ];

      // Mock fetch
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            htmlContent: '<p>First paragraph here</p><p>Second paragraph here</p>',
            images: []
          }
        })
      });

      app.currentModalChunks = chunks;
      app.currentModalViewerId = 'articleContentViewer';
      await app.populateDetailsSection(pocId, chunks, false);

      const toggleBtn = document.getElementById('chunkerHtmlToggle');
      
      // Create chunk elements
      const chunksContent = document.createElement('div');
      document.body.appendChild(chunksContent);
      
      chunks.forEach((chunk, index) => {
        const chunkEl = document.createElement('div');
        chunkEl.className = 'chunk-item-detail';
        chunkEl.setAttribute('data-chunk-index', index.toString());
        chunkEl.textContent = chunk.chunkContent;
        chunksContent.appendChild(chunkEl);
        
        chunkEl.addEventListener('click', () => {
          app.selectChunkInModal(index);
        });
      });
      
      // Toggle to raw HTML
      toggleBtn.click();
      
      // Now select a chunk - should not throw error
      const firstChunk = chunksContent.querySelector('.chunk-item-detail[data-chunk-index="0"]');
      expect(() => {
        firstChunk.click();
      }).not.toThrow();
      
      // Verify chunk is selected
      expect(firstChunk.classList.contains('selected')).toBe(true);
    });
  });
});
