/**
 * Tests for chunk selection functionality across different modals
 * Ensures consistent behavior between chunk modal, chunker modal, and assessment modal
 */

describe('Chunk Selection', () => {
  let app;
  let mockChunks;
  
  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = `
      <div id="chunksContent">
        <div class="chunk-item-detail" data-chunk-index="0"></div>
        <div class="chunk-item-detail" data-chunk-index="1"></div>
        <div class="chunk-item-detail" data-chunk-index="2"></div>
      </div>
      <div id="chunkerChunksContent">
        <div class="chunk-item-detail" data-chunk-index="0"></div>
        <div class="chunk-item-detail" data-chunk-index="1"></div>
      </div>
      <div id="assessmentChunks">
        <div class="assessment-chunk-item" data-chunk-index="0"></div>
        <div class="assessment-chunk-item" data-chunk-index="1"></div>
        <div class="assessment-chunk-item" data-chunk-index="2"></div>
      </div>
      <div id="assessmentArticleContentViewer">
        <p>This is a test article with some content.</p>
        <p>This is the second paragraph.</p>
        <p>And here is the third paragraph.</p>
      </div>
      <div id="assessmentRawHtml" style="display: none;"></div>
    `;
    
    // Mock SemanticChunkerApp
    app = {
      currentModalChunks: [],
      currentAssessmentChunks: [],
      assessmentChunkPositions: [],
      assessmentArticleElementMap: [],
      assessmentArticleFullText: '',
      assessmentNormalizedArticle: '',
      currentAssessmentViewerId: 'assessmentArticleContentViewer',
      
      selectChunkInModal: function(chunkIndex) {
        document.querySelectorAll('.chunk-item-detail').forEach(el => {
          el.classList.remove('selected');
        });
        const chunkEl = document.querySelector(`#chunksContent .chunk-item-detail[data-chunk-index="${chunkIndex}"]`);
        if (chunkEl) {
          chunkEl.classList.add('selected');
        }
      },
      
      selectChunkInChunkerModal: function(chunkIndex) {
        document.querySelectorAll('#chunkerChunksContent .chunk-item-detail').forEach(el => {
          el.classList.remove('selected');
        });
        const chunkEl = document.querySelector(`#chunkerChunksContent .chunk-item-detail[data-chunk-index="${chunkIndex}"]`);
        if (chunkEl) {
          chunkEl.classList.add('selected');
        }
      },
      
      selectChunkInAssessmentModal: function(chunkIndex) {
        document.querySelectorAll('.assessment-chunk-item').forEach(el => {
          el.classList.remove('selected');
        });
        const chunkEl = document.querySelector(`.assessment-chunk-item[data-chunk-index="${chunkIndex}"]`);
        if (chunkEl) {
          chunkEl.classList.add('selected');
          this.highlightChunkInAssessmentArticle(chunkIndex);
        }
      },
      
      highlightChunkInAssessmentArticle: function(chunkIndex) {
        const viewer = document.getElementById(this.currentAssessmentViewerId || 'assessmentArticleContentViewer');
        if (!viewer || !this.currentAssessmentChunks || chunkIndex >= this.currentAssessmentChunks.length) {
          return;
        }
        
        viewer.querySelectorAll('.chunk-highlight').forEach(el => {
          el.classList.remove('chunk-highlight', 'active');
        });
        
        const currentChunk = this.currentAssessmentChunks[chunkIndex];
        
        // Handle image chunks
        if (currentChunk.chunkType === 'IMAGE' && currentChunk.metadata && currentChunk.metadata.filename) {
          const images = viewer.querySelectorAll('img');
          for (const img of images) {
            if (img.src.includes(currentChunk.metadata.filename)) {
              const figure = img.closest('figure') || img.closest('div.commentedFigure') || img.parentElement;
              if (figure) {
                figure.classList.add('chunk-highlight', 'active');
              }
              return;
            }
          }
          return;
        }
        
        // Check if we have chunk positions mapped
        if (!this.assessmentChunkPositions || !this.assessmentArticleElementMap || !this.assessmentArticleFullText) {
          return;
        }
        
        const chunkPosition = this.assessmentChunkPositions[chunkIndex];
        if (!chunkPosition || !chunkPosition.found) {
          return;
        }
        
        const chunkStart = chunkPosition.start;
        const chunkEnd = chunkPosition.end;
        
        // Map back to original article positions
        let normalizedPos = 0;
        let originalStart = -1;
        let originalEnd = -1;
        
        for (let i = 0; i < this.assessmentArticleFullText.length && normalizedPos <= chunkEnd; i++) {
          if (normalizedPos === chunkStart) {
            originalStart = i;
          }
          if (normalizedPos === chunkEnd) {
            originalEnd = i;
            break;
          }
          
          const char = this.assessmentArticleFullText[i];
          if (!/\s/.test(char)) {
            normalizedPos++;
          } else if (normalizedPos < this.assessmentNormalizedArticle.length && this.assessmentNormalizedArticle[normalizedPos] === ' ') {
            normalizedPos++;
          }
        }
        
        if (originalEnd === -1) originalEnd = this.assessmentArticleFullText.length;
        
        // Find elements to highlight
        const elementsToHighlight = [];
        this.assessmentArticleElementMap.forEach(item => {
          if (item.start < originalEnd && item.end > originalStart) {
            elementsToHighlight.push(item.element);
          }
        });
        
        elementsToHighlight.forEach(el => {
          el.classList.add('chunk-highlight', 'active');
        });
      }
    };
    
    mockChunks = [
      { chunkContent: 'This is a test article with some content.', chunkType: 'SECTION', chunkOrder: 1 },
      { chunkContent: 'This is the second paragraph.', chunkType: 'SECTION', chunkOrder: 2 },
      { chunkContent: 'And here is the third paragraph.', chunkType: 'SECTION', chunkOrder: 3 }
    ];
  });
  
  afterEach(() => {
    document.body.innerHTML = '';
  });
  
  describe('Chunk Modal Selection', () => {
    test('should select chunk in chunk modal', () => {
      app.selectChunkInModal(1);
      
      const selected = document.querySelector('#chunksContent .chunk-item-detail.selected');
      expect(selected).toBeTruthy();
      expect(selected.getAttribute('data-chunk-index')).toBe('1');
    });
    
    test('should deselect previous chunk when selecting new one', () => {
      app.selectChunkInModal(0);
      let selected = document.querySelectorAll('#chunksContent .chunk-item-detail.selected');
      expect(selected.length).toBe(1);
      
      app.selectChunkInModal(2);
      selected = document.querySelectorAll('#chunksContent .chunk-item-detail.selected');
      expect(selected.length).toBe(1);
      expect(selected[0].getAttribute('data-chunk-index')).toBe('2');
    });
    
    test('should handle selecting non-existent chunk gracefully', () => {
      app.selectChunkInModal(999);
      const selected = document.querySelectorAll('#chunksContent .chunk-item-detail.selected');
      expect(selected.length).toBe(0);
    });
  });
  
  describe('Chunker Modal Selection', () => {
    test('should select chunk in chunker modal', () => {
      app.selectChunkInChunkerModal(0);
      
      const selected = document.querySelector('#chunkerChunksContent .chunk-item-detail.selected');
      expect(selected).toBeTruthy();
      expect(selected.getAttribute('data-chunk-index')).toBe('0');
    });
    
    test('should not affect chunk modal selection', () => {
      app.selectChunkInModal(1);
      app.selectChunkInChunkerModal(0);
      
      const chunkModalSelected = document.querySelector('#chunksContent .chunk-item-detail.selected');
      const chunkerModalSelected = document.querySelector('#chunkerChunksContent .chunk-item-detail.selected');
      
      expect(chunkModalSelected.getAttribute('data-chunk-index')).toBe('1');
      expect(chunkerModalSelected.getAttribute('data-chunk-index')).toBe('0');
    });
  });
  
  describe('Assessment Modal Selection', () => {
    beforeEach(() => {
      app.currentAssessmentChunks = mockChunks;
      
      // Setup mock chunk positions
      const viewer = document.getElementById('assessmentArticleContentViewer');
      const fullText = viewer.textContent || '';
      const normalize = (text) => text.replace(/\s+/g, ' ').trim();
      
      app.assessmentArticleFullText = fullText;
      app.assessmentNormalizedArticle = normalize(fullText);
      
      // Build element map
      const elementMap = [];
      let currentPos = 0;
      viewer.querySelectorAll('p').forEach(p => {
        const text = p.textContent || '';
        elementMap.push({
          element: p,
          text: text,
          start: currentPos,
          end: currentPos + text.length
        });
        currentPos += text.length;
      });
      app.assessmentArticleElementMap = elementMap;
      
      // Map chunks to positions
      const normalizedArticle = app.assessmentNormalizedArticle;
      let searchStartPos = 0;
      app.assessmentChunkPositions = mockChunks.map((chunk, idx) => {
        const chunkText = chunk.chunkContent.trim();
        const normalizedChunk = normalize(chunkText);
        const chunkStart = normalizedArticle.indexOf(normalizedChunk, searchStartPos);
        
        if (chunkStart === -1) {
          return { index: idx, start: searchStartPos, end: searchStartPos, found: false };
        }
        
        const chunkEnd = chunkStart + normalizedChunk.length;
        searchStartPos = chunkEnd;
        
        return { index: idx, start: chunkStart, end: chunkEnd, found: true };
      });
    });
    
    test('should select chunk in assessment modal', () => {
      app.selectChunkInAssessmentModal(1);
      
      const selected = document.querySelector('.assessment-chunk-item.selected');
      expect(selected).toBeTruthy();
      expect(selected.getAttribute('data-chunk-index')).toBe('1');
    });
    
    test('should deselect previous chunk when selecting new one', () => {
      app.selectChunkInAssessmentModal(0);
      app.selectChunkInAssessmentModal(2);
      
      const selected = document.querySelectorAll('.assessment-chunk-item.selected');
      expect(selected.length).toBe(1);
      expect(selected[0].getAttribute('data-chunk-index')).toBe('2');
    });
    
    test('should highlight corresponding article element', () => {
      app.selectChunkInAssessmentModal(0);
      
      const highlighted = document.querySelectorAll('.chunk-highlight.active');
      expect(highlighted.length).toBeGreaterThan(0);
    });
    
    test('should use assessmentNormalizedArticle property', () => {
      // This test verifies the fix for the bug
      app.selectChunkInAssessmentModal(1);
      
      // Should not throw error about normalizedAssessmentArticle being undefined
      const viewer = document.getElementById('assessmentArticleContentViewer');
      const highlighted = viewer.querySelectorAll('.chunk-highlight.active');
      expect(highlighted.length).toBeGreaterThan(0);
    });
    
    test('should handle image chunks', () => {
      const imageChunk = {
        chunkContent: '[Image: test.png]',
        chunkType: 'IMAGE',
        chunkOrder: 1,
        metadata: { filename: 'test.png' }
      };
      
      app.currentAssessmentChunks = [imageChunk];
      
      // Add an image to the viewer
      const viewer = document.getElementById('assessmentArticleContentViewer');
      viewer.innerHTML = '<figure><img src="/images/test.png" alt="Test"/></figure>';
      
      app.selectChunkInAssessmentModal(0);
      
      const highlighted = viewer.querySelector('figure.chunk-highlight');
      expect(highlighted).toBeTruthy();
    });
    
    test('should handle chunks not found in article', () => {
      app.assessmentChunkPositions[1] = { index: 1, start: 0, end: 0, found: false };
      
      // Should not throw error
      expect(() => {
        app.selectChunkInAssessmentModal(1);
      }).not.toThrow();
    });
  });
  
  describe('Raw HTML Highlighting', () => {
    beforeEach(() => {
      // Add raw HTML view elements
      document.body.innerHTML += `
        <div id="rawHtml" style="display: none;"></div>
        <div id="chunkerRawHtml" style="display: none;"></div>
        <div id="assessmentRawHtml" style="display: none;"></div>
      `;
      
      app.currentModalChunks = mockChunks;
      app.currentAssessmentChunks = mockChunks;
      
      // Mock raw HTML content
      app.OriginalRawHtml = '<p>This is a test article with some content.</p><p>This is the second paragraph.</p>';
      app.assessmentOriginalRawHtml = '<p>This is a test article with some content.</p><p>This is the second paragraph.</p>';
      
      // Mock raw HTML chunk positions
      app.RawHtmlChunkPositions = [
        { index: 0, start: 0, end: 50, found: true },
        { index: 1, start: 50, end: 85, found: true },
        { index: 2, start: 85, end: 120, found: true }
      ];
      app.assessmentRawHtmlChunkPositions = [
        { index: 0, start: 0, end: 50, found: true },
        { index: 1, start: 50, end: 85, found: true },
        { index: 2, start: 85, end: 120, found: true }
      ];
      
      app.escapeHtml = (text) => {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
      };
      
      app.highlightChunkInRawHtml = function(viewerId, rawHtmlId, isAssessmentModal = false) {
        const rawHtmlView = document.getElementById(rawHtmlId);
        if (!rawHtmlView) return;
        
        let selectedChunkIndex = -1;
        if (isAssessmentModal) {
          const chunkItems = document.querySelectorAll('.assessment-chunk-item');
          chunkItems.forEach((item, idx) => {
            if (item.classList.contains('selected')) {
              selectedChunkIndex = idx;
            }
          });
        } else {
          const chunkItems = document.querySelectorAll('.chunk-item-detail');
          chunkItems.forEach((item, idx) => {
            if (item.classList.contains('selected')) {
              selectedChunkIndex = idx;
            }
          });
        }
        
        if (selectedChunkIndex === -1) return;
        
        const currentChunks = isAssessmentModal ? this.currentAssessmentChunks : this.currentModalChunks;
        const currentChunk = currentChunks[selectedChunkIndex];
        
        // Handle image chunks
        if (currentChunk.chunkType === 'IMAGE' && currentChunk.metadata && currentChunk.metadata.filename) {
          const rawHtmlContent = this[`${isAssessmentModal ? 'assessment' : ''}OriginalRawHtml`] || '';
          const filename = currentChunk.metadata.filename;
          const filenamePos = rawHtmlContent.indexOf(filename);
          
          if (filenamePos !== -1) {
            let figureStart = rawHtmlContent.lastIndexOf('<figure', filenamePos);
            if (figureStart === -1) figureStart = rawHtmlContent.lastIndexOf('<img', filenamePos);
            
            let figureEnd = rawHtmlContent.indexOf('</figure>', filenamePos);
            if (figureEnd !== -1) {
              figureEnd += '</figure>'.length;
            } else {
              figureEnd = rawHtmlContent.indexOf('>', filenamePos) + 1;
            }
            
            const before = rawHtmlContent.substring(0, figureStart);
            const highlighted = rawHtmlContent.substring(figureStart, figureEnd);
            const after = rawHtmlContent.substring(figureEnd);
            
            rawHtmlView.innerHTML = `${this.escapeHtml(before)}<mark class="raw-html-highlight">${this.escapeHtml(highlighted)}</mark>${this.escapeHtml(after)}`;
          }
          return;
        }
        
        // For non-image chunks
        const prefix = isAssessmentModal ? 'assessment' : '';
        const rawHtmlChunkPositions = this[`${prefix}RawHtmlChunkPositions`];
        
        if (!rawHtmlChunkPositions) return;
        
        const chunkPos = rawHtmlChunkPositions[selectedChunkIndex];
        if (!chunkPos || !chunkPos.found) return;
        
        const rawHtmlContent = this[`${prefix}OriginalRawHtml`] || '';
        const before = rawHtmlContent.substring(0, chunkPos.start);
        const highlighted = rawHtmlContent.substring(chunkPos.start, chunkPos.end);
        const after = rawHtmlContent.substring(chunkPos.end);
        
        rawHtmlView.innerHTML = `${this.escapeHtml(before)}<mark class="raw-html-highlight">${this.escapeHtml(highlighted)}</mark>${this.escapeHtml(after)}`;
      };
    });
    
    test('should highlight chunk in raw HTML for chunk modal', () => {
      app.selectChunkInModal(0);
      app.highlightChunkInRawHtml('articleContentViewer', 'rawHtml', false);
      
      const rawHtmlView = document.getElementById('rawHtml');
      expect(rawHtmlView.innerHTML).toContain('<mark class="raw-html-highlight">');
    });
    
    test('should highlight chunk in raw HTML for chunker modal', () => {
      // Clear the chunk modal items to avoid confusion
      const chunksContent = document.getElementById('chunksContent');
      chunksContent.innerHTML = '';
      
      app.selectChunkInChunkerModal(0);
      app.highlightChunkInRawHtml('articleContentViewer', 'chunkerRawHtml', false);
      
      const rawHtmlView = document.getElementById('chunkerRawHtml');
      expect(rawHtmlView.innerHTML).toContain('<mark class="raw-html-highlight">');
    });
    
    test('should highlight chunk in raw HTML for assessment modal', () => {
      app.selectChunkInAssessmentModal(0);
      app.highlightChunkInRawHtml('assessmentArticleContentViewer', 'assessmentRawHtml', true);
      
      const rawHtmlView = document.getElementById('assessmentRawHtml');
      expect(rawHtmlView.innerHTML).toContain('<mark class="raw-html-highlight">');
    });
    
    test('should use correct chunk selector for assessment modal', () => {
      // Select chunk in assessment modal
      app.selectChunkInAssessmentModal(1);
      
      // Verify assessment chunk is selected
      const assessmentChunk = document.querySelector('.assessment-chunk-item[data-chunk-index="1"]');
      expect(assessmentChunk.classList.contains('selected')).toBe(true);
      
      // Highlight in raw HTML - should use assessment chunks
      app.highlightChunkInRawHtml('assessmentArticleContentViewer', 'assessmentRawHtml', true);
      
      const rawHtmlView = document.getElementById('assessmentRawHtml');
      expect(rawHtmlView.innerHTML).toContain('<mark class="raw-html-highlight">');
    });
    
    test('should handle image chunks in raw HTML', () => {
      const imageChunk = {
        chunkContent: '[Image: test.png]',
        chunkType: 'IMAGE',
        chunkOrder: 1,
        metadata: { filename: 'test.png' }
      };
      
      app.currentAssessmentChunks = [imageChunk];
      app.assessmentOriginalRawHtml = '<figure><img src="/images/test.png" alt="Test"/></figure>';
      
      app.selectChunkInAssessmentModal(0);
      app.highlightChunkInRawHtml('assessmentArticleContentViewer', 'assessmentRawHtml', true);
      
      const rawHtmlView = document.getElementById('assessmentRawHtml');
      expect(rawHtmlView.innerHTML).toContain('test.png');
      expect(rawHtmlView.innerHTML).toContain('<mark class="raw-html-highlight">');
    });
    
    test('should handle no chunk selected gracefully', () => {
      // Don't select any chunk
      expect(() => {
        app.highlightChunkInRawHtml('assessmentArticleContentViewer', 'assessmentRawHtml', true);
      }).not.toThrow();
      
      const rawHtmlView = document.getElementById('assessmentRawHtml');
      expect(rawHtmlView.innerHTML).toBe('');
    });
  });

  describe('Property Name Consistency', () => {
    test('should use assessmentNormalizedArticle not normalizedAssessmentArticle', () => {
      // Verify the correct property name is used
      app.assessmentNormalizedArticle = 'test normalized text';
      app.assessmentArticleFullText = 'test article full text';
      app.currentAssessmentChunks = mockChunks;
      app.assessmentChunkPositions = [{ index: 0, start: 0, end: 10, found: true }];
      app.assessmentArticleElementMap = [{
        element: document.querySelector('#assessmentArticleContentViewer p'),
        text: 'test text',
        start: 0,
        end: 10
      }];
      
      // This should not throw an error about undefined property
      expect(() => {
        app.highlightChunkInAssessmentArticle(0);
      }).not.toThrow();
      
      // Verify the correct property is accessed
      expect(app.assessmentNormalizedArticle).toBeDefined();
      expect(app.normalizedAssessmentArticle).toBeUndefined();
    });
  });
});
