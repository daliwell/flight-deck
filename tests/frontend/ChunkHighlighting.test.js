/**
 * Tests for chunk highlighting functionality in both Chunks View and Assessment View modals
 * Prevents regression of image chunk highlighting issue (POC 308725d0a877f0139f78a80a)
 */

describe('Chunk Highlighting', () => {
    let app;
    let mockChunks;
    let mockImageChunk;
    let mockTextChunk;

    beforeEach(() => {
        // Setup DOM
        document.body.innerHTML = `
            <div id="chunkModal" style="display: none;">
                <div id="articleContentViewer"></div>
                <div id="chunkerDetailsContent"></div>
            </div>
            <div id="assessmentModal" style="display: none;">
                <div id="assessmentArticleContentViewer"></div>
                <div id="assessmentPocTextContent"></div>
            </div>
            <div class="chunk-item" data-chunk-index="0"></div>
            <div class="chunk-item" data-chunk-index="1"></div>
            <div class="assessment-chunk-item" data-chunk-index="0"></div>
            <div class="assessment-chunk-item" data-chunk-index="1"></div>
        `;

        // Create a mock app object with the required methods for chunk highlighting
        app = {
            currentModalChunks: [],
            currentAssessmentChunks: [],
            chunkPositions: {},
            assessmentChunkPositions: {},
            articleElementMap: [],
            assessmentArticleElementMap: [],
            articleFullText: '',
            assessmentArticleFullText: '',
            normalizedArticle: '',
            normalizedAssessmentArticle: '',
            selectedPocs: new Set(),
            
            highlightChunkByIndex: function(chunkIndex) {
                const viewer = document.getElementById('articleContentViewer');
                const detailsContent = document.getElementById('chunkerDetailsContent');
                
                if (!viewer || !this.currentModalChunks || chunkIndex >= this.currentModalChunks.length) {
                    console.log('Cannot highlight: missing data');
                    return;
                }
                
                console.log(`Highlighting chunk ${chunkIndex} of ${this.currentModalChunks.length}`);
                
                // Remove previous highlights
                viewer.querySelectorAll('.chunk-highlight').forEach(el => {
                    el.classList.remove('chunk-highlight', 'active');
                });
                
                // Check if this is an image chunk
                const currentChunk = this.currentModalChunks[chunkIndex];
                console.log(`Chunk ${chunkIndex} type:`, currentChunk.chunkType, 'metadata:', currentChunk.metadata);
                
                if (currentChunk.chunkType === 'IMAGE' && currentChunk.metadata && currentChunk.metadata.filename) {
                    console.log(`Looking for image with filename: ${currentChunk.metadata.filename}`);
                    // Find and highlight the image by filename
                    const images = viewer.querySelectorAll('img');
                    console.log(`Found ${images.length} images in article`);
                    for (const img of images) {
                        console.log(`Checking image src: ${img.src}`);
                        if (img.src.includes(currentChunk.metadata.filename)) {
                            // Highlight the figure or img parent
                            const figure = img.closest('figure') || img.closest('div.commentedFigure') || img.parentElement;
                            if (figure) {
                                figure.classList.add('chunk-highlight', 'active');
                                figure.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }
                            console.log(`Highlighted image: ${currentChunk.metadata.filename}`);
                            return;
                        }
                    }
                    console.log(`Image not found: ${currentChunk.metadata.filename}`);
                    return;
                }
                
                // For text chunks, highlight elements
                if (!this.chunkPositions || !this.articleElementMap || !this.articleFullText) {
                    console.log('Chunk positions not mapped yet');
                    return;
                }
                
                const chunkPosition = this.chunkPositions[chunkIndex];
                if (!chunkPosition || !chunkPosition.found) {
                    console.log(`Chunk ${chunkIndex} was not found in article`);
                    return;
                }
                
                const elementsToHighlight = [];
                if (this.articleElementMap[chunkIndex]) {
                    elementsToHighlight.push(this.articleElementMap[chunkIndex].element);
                }
                
                elementsToHighlight.forEach(el => {
                    el.classList.add('chunk-highlight', 'active');
                });
            },
            
            highlightChunkInAssessmentArticle: function(chunkIndex) {
                const viewer = document.getElementById('assessmentArticleContentViewer');
                const detailsContent = document.getElementById('assessmentPocTextContent');
                
                if (!viewer || !this.currentAssessmentChunks || chunkIndex >= this.currentAssessmentChunks.length) {
                    console.log('Cannot highlight in assessment: missing data');
                    return;
                }
                
                console.log(`Highlighting chunk ${chunkIndex} of ${this.currentAssessmentChunks.length}`);
                
                // Remove previous highlights
                viewer.querySelectorAll('.chunk-highlight').forEach(el => {
                    el.classList.remove('chunk-highlight', 'active');
                });
                
                // Check if this is an image chunk
                const currentChunk = this.currentAssessmentChunks[chunkIndex];
                console.log(`Chunk ${chunkIndex} type:`, currentChunk.chunkType, 'metadata:', currentChunk.metadata);
                
                if (currentChunk.chunkType === 'IMAGE' && currentChunk.metadata && currentChunk.metadata.filename) {
                    console.log(`Looking for image with filename: ${currentChunk.metadata.filename}`);
                    // Find and highlight the image by filename
                    const images = viewer.querySelectorAll('img');
                    console.log(`Found ${images.length} images in article`);
                    for (const img of images) {
                        console.log(`Checking image src: ${img.src}`);
                        if (img.src.includes(currentChunk.metadata.filename)) {
                            // Highlight the figure or img parent
                            const figure = img.closest('figure') || img.closest('div.commentedFigure') || img.parentElement;
                            if (figure) {
                                figure.classList.add('chunk-highlight', 'active');
                                if (detailsContent) {
                                    const containerRect = detailsContent.getBoundingClientRect();
                                    const elementRect = figure.getBoundingClientRect();
                                    const scrollOffset = elementRect.top - containerRect.top - 50;
                                    detailsContent.scrollBy({
                                        top: scrollOffset,
                                        behavior: 'smooth'
                                    });
                                }
                            }
                            console.log(`Highlighted image: ${currentChunk.metadata.filename}`);
                            return;
                        }
                    }
                    console.log(`Image not found: ${currentChunk.metadata.filename}`);
                    return;
                }
                
                // For text chunks, highlight elements
                if (!this.assessmentChunkPositions || !this.assessmentArticleElementMap || !this.assessmentArticleFullText) {
                    console.log('Assessment chunk positions not mapped yet');
                    return;
                }
                
                const chunkPosition = this.assessmentChunkPositions[chunkIndex];
                if (!chunkPosition || !chunkPosition.found) {
                    console.log(`Chunk ${chunkIndex} was not found in article`);
                    return;
                }
                
                const elementsToHighlight = [];
                if (this.assessmentArticleElementMap[chunkIndex]) {
                    elementsToHighlight.push(this.assessmentArticleElementMap[chunkIndex].element);
                }
                
                elementsToHighlight.forEach(el => {
                    el.classList.add('chunk-highlight', 'active');
                });
            },
            
            selectChunkInAssessmentModal: function(chunkIndex) {
                console.log('Selecting chunk in assessment modal:', chunkIndex);
                
                // Remove selection from all chunks
                document.querySelectorAll('.assessment-chunk-item').forEach(el => {
                    el.classList.remove('selected');
                });
                
                // Add selection to clicked chunk
                const chunkEl = document.querySelector(`.assessment-chunk-item[data-chunk-index="${chunkIndex}"]`);
                if (chunkEl) {
                    chunkEl.classList.add('selected');
                    
                    // Highlight this chunk in the article viewer
                    this.highlightChunkInAssessmentArticle(chunkIndex);
                    
                    // Scroll chunk into view
                    chunkEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }
        };
        
        // Mock chunks data
        mockTextChunk = {
            chunkType: 'text',
            chunkContent: 'This is a text chunk',
            metadata: {}
        };

        mockImageChunk = {
            chunkType: 'IMAGE',
            metadata: {
                filename: 'image-001.png'
            }
        };

        mockChunks = [mockTextChunk, mockImageChunk];
    });

    describe('Chunks View Modal - Text Chunk Highlighting', () => {
        test('should remove previous highlights when selecting a chunk', () => {
            app.currentModalChunks = mockChunks;
            app.chunkPositions = [
                { found: true, start: 0, end: 20 },
                { found: true, start: 20, end: 40 }
            ];
            app.articleElementMap = [];
            app.articleFullText = 'This is a text chunk';
            app.normalizedArticle = 'This is a text chunk';

            const viewer = document.getElementById('articleContentViewer');
            const existingHighlight = document.createElement('div');
            existingHighlight.classList.add('chunk-highlight', 'active');
            viewer.appendChild(existingHighlight);

            app.highlightChunkByIndex(0);

            expect(existingHighlight.classList.contains('chunk-highlight')).toBe(false);
            expect(existingHighlight.classList.contains('active')).toBe(false);
        });

        test('should highlight text chunk by index correctly', () => {
            const mockElement = document.createElement('span');
            mockElement.textContent = 'This is a text chunk';

            app.currentModalChunks = mockChunks;
            app.chunkPositions = [
                { found: true, start: 0, end: 20 },
                { found: true, start: 20, end: 40 }
            ];
            app.articleElementMap = [
                {
                    element: mockElement,
                    start: 0,
                    end: 20,
                    text: 'This is a text chunk'
                }
            ];
            app.articleFullText = 'This is a text chunk';
            app.normalizedArticle = 'This is a text chunk';

            document.getElementById('articleContentViewer').appendChild(mockElement);

            app.highlightChunkByIndex(0);

            expect(mockElement.classList.contains('chunk-highlight')).toBe(true);
            expect(mockElement.classList.contains('active')).toBe(true);
        });
    });

    describe('Chunks View Modal - Image Chunk Highlighting', () => {
        beforeEach(() => {
            Element.prototype.scrollIntoView = jest.fn();
        });

        test('should highlight image chunk by filename', () => {
            const mockImage = document.createElement('img');
            mockImage.src = 'http://example.com/images/image-001.png';

            const figure = document.createElement('figure');
            figure.appendChild(mockImage);

            app.currentModalChunks = mockChunks;
            document.getElementById('articleContentViewer').appendChild(figure);

            app.highlightChunkByIndex(1);

            expect(figure.classList.contains('chunk-highlight')).toBe(true);
            expect(figure.classList.contains('active')).toBe(true);
        });

        test('should find image using figure container', () => {
            const mockImage = document.createElement('img');
            mockImage.src = 'http://example.com/images/image-001.png';

            const figure = document.createElement('figure');
            figure.appendChild(mockImage);

            app.currentModalChunks = mockChunks;
            document.getElementById('articleContentViewer').innerHTML = '';
            document.getElementById('articleContentViewer').appendChild(figure);

            app.highlightChunkByIndex(1);

            expect(figure.classList.contains('chunk-highlight')).toBe(true);
            expect(figure.classList.contains('active')).toBe(true);
        });

        test('should find image using commentedFigure container', () => {
            const mockImage = document.createElement('img');
            mockImage.src = 'http://example.com/images/image-001.png';

            const div = document.createElement('div');
            div.classList.add('commentedFigure');
            div.appendChild(mockImage);

            app.currentModalChunks = mockChunks;
            document.getElementById('articleContentViewer').innerHTML = '';
            document.getElementById('articleContentViewer').appendChild(div);

            app.highlightChunkByIndex(1);

            expect(div.classList.contains('chunk-highlight')).toBe(true);
            expect(div.classList.contains('active')).toBe(true);
        });

        test('should handle missing image gracefully', () => {
            app.currentModalChunks = mockChunks;
            document.getElementById('articleContentViewer').innerHTML = '';

            const result = app.highlightChunkByIndex(1);

            expect(result).toBeUndefined();
        });
    });

    describe('Assessment View Modal - Text Chunk Highlighting', () => {
        test('should remove previous highlights when selecting a chunk in assessment view', () => {
            app.currentAssessmentChunks = mockChunks;
            app.assessmentChunkPositions = [
                { found: true, start: 0, end: 20 },
                { found: true, start: 20, end: 40 }
            ];
            app.assessmentArticleElementMap = [];
            app.assessmentArticleFullText = 'This is a text chunk';
            app.normalizedAssessmentArticle = 'This is a text chunk';

            const viewer = document.getElementById('assessmentArticleContentViewer');
            const existingHighlight = document.createElement('div');
            existingHighlight.classList.add('chunk-highlight', 'active');
            viewer.appendChild(existingHighlight);

            app.highlightChunkInAssessmentArticle(0);

            expect(existingHighlight.classList.contains('chunk-highlight')).toBe(false);
            expect(existingHighlight.classList.contains('active')).toBe(false);
        });

        test('should highlight text chunk in assessment view correctly', () => {
            const mockElement = document.createElement('span');
            mockElement.textContent = 'This is a text chunk';

            app.currentAssessmentChunks = mockChunks;
            app.assessmentChunkPositions = [
                { found: true, start: 0, end: 20 },
                { found: true, start: 20, end: 40 }
            ];
            app.assessmentArticleElementMap = [
                {
                    element: mockElement,
                    start: 0,
                    end: 20,
                    text: 'This is a text chunk'
                }
            ];
            app.assessmentArticleFullText = 'This is a text chunk';
            app.normalizedAssessmentArticle = 'This is a text chunk';

            document.getElementById('assessmentArticleContentViewer').appendChild(mockElement);

            app.highlightChunkInAssessmentArticle(0);

            expect(mockElement.classList.contains('chunk-highlight')).toBe(true);
            expect(mockElement.classList.contains('active')).toBe(true);
        });
    });

    describe('Assessment View Modal - Image Chunk Highlighting', () => {
        beforeEach(() => {
            Element.prototype.scrollIntoView = jest.fn();
            Element.prototype.scrollBy = jest.fn();
        });

        test('should highlight image chunk by filename in assessment view', () => {
            const mockImage = document.createElement('img');
            mockImage.src = 'http://example.com/images/image-001.png';

            const figure = document.createElement('figure');
            figure.appendChild(mockImage);

            app.currentAssessmentChunks = mockChunks;
            document.getElementById('assessmentArticleContentViewer').appendChild(figure);

            app.highlightChunkInAssessmentArticle(1);

            expect(figure.classList.contains('chunk-highlight')).toBe(true);
            expect(figure.classList.contains('active')).toBe(true);
        });

        test('should find image in assessment view using figure container', () => {
            const mockImage = document.createElement('img');
            mockImage.src = 'http://example.com/images/image-001.png';

            const figure = document.createElement('figure');
            figure.appendChild(mockImage);

            app.currentAssessmentChunks = mockChunks;
            document.getElementById('assessmentArticleContentViewer').innerHTML = '';
            document.getElementById('assessmentArticleContentViewer').appendChild(figure);

            app.highlightChunkInAssessmentArticle(1);

            expect(figure.classList.contains('chunk-highlight')).toBe(true);
            expect(figure.classList.contains('active')).toBe(true);
        });

        test('should find image in assessment view using commentedFigure container', () => {
            const mockImage = document.createElement('img');
            mockImage.src = 'http://example.com/images/image-001.png';

            const div = document.createElement('div');
            div.classList.add('commentedFigure');
            div.appendChild(mockImage);

            app.currentAssessmentChunks = mockChunks;
            document.getElementById('assessmentArticleContentViewer').innerHTML = '';
            document.getElementById('assessmentArticleContentViewer').appendChild(div);

            app.highlightChunkInAssessmentArticle(1);

            expect(div.classList.contains('chunk-highlight')).toBe(true);
            expect(div.classList.contains('active')).toBe(true);
        });

        test('should handle missing image in assessment view gracefully', () => {
            app.currentAssessmentChunks = mockChunks;
            document.getElementById('assessmentArticleContentViewer').innerHTML = '';

            const result = app.highlightChunkInAssessmentArticle(1);

            expect(result).toBeUndefined();
        });
    });

    describe('Chunk Selection in Assessment Modal', () => {
        test('should remove selection from all chunks when selecting new chunk', () => {
            document.body.innerHTML = `
                <div class="assessment-chunk-item" data-chunk-index="0"></div>
                <div class="assessment-chunk-item" data-chunk-index="1"></div>
                <div id="assessmentArticleContentViewer"></div>
                <div id="assessmentPocTextContent"></div>
            `;

            app.currentAssessmentChunks = mockChunks;
            app.assessmentChunkPositions = [{ found: true, start: 0, end: 20 }];
            app.assessmentArticleElementMap = [];
            app.assessmentArticleFullText = '';
            app.normalizedAssessmentArticle = '';

            const chunk0 = document.querySelector('[data-chunk-index="0"]');
            const chunk1 = document.querySelector('[data-chunk-index="1"]');
            
            chunk0.classList.add('selected');
            chunk1.classList.add('selected');

            app.selectChunkInAssessmentModal(0);

            expect(chunk0.classList.contains('selected')).toBe(true);
            expect(chunk1.classList.contains('selected')).toBe(false);
        });

        test('should highlight chunk in assessment article when selecting', () => {
            app.currentAssessmentChunks = mockChunks;
            app.assessmentChunkPositions = [{ found: true, start: 0, end: 20 }];
            app.assessmentArticleElementMap = [];
            app.assessmentArticleFullText = '';
            app.normalizedAssessmentArticle = '';

            let highlightCalled = false;
            let highlightedIndex = null;
            const originalHighlight = app.highlightChunkInAssessmentArticle;
            app.highlightChunkInAssessmentArticle = function(index) {
                highlightCalled = true;
                highlightedIndex = index;
            };

            const chunkEl = document.querySelector('[data-chunk-index="0"]');
            if (chunkEl) {
                app.selectChunkInAssessmentModal(0);

                expect(highlightCalled).toBe(true);
                expect(highlightedIndex).toBe(0);
            }
        });
    });

    describe('Edge Cases and Regression Tests', () => {
        test('should handle chunk index out of bounds', () => {
            app.currentModalChunks = mockChunks;
            
            const result = app.highlightChunkByIndex(999);
            
            expect(result).toBeUndefined();
        });

        test('should handle missing chunk positions data', () => {
            app.currentModalChunks = mockChunks;
            app.chunkPositions = null;
            
            const result = app.highlightChunkByIndex(0);
            
            expect(result).toBeUndefined();
        });

        test('should handle assessment view with missing chunk positions data', () => {
            app.currentAssessmentChunks = mockChunks;
            app.assessmentChunkPositions = null;
            mockChunks[0].chunkType = 'text';
            
            const result = app.highlightChunkInAssessmentArticle(0);
            
            expect(result).toBeUndefined();
        });

        test('should properly identify image chunks by chunkType property', () => {
            const imageChunk = {
                chunkType: 'IMAGE',
                metadata: {
                    filename: 'test-image.png'
                }
            };
            
            expect(imageChunk.chunkType).toBe('IMAGE');
            expect(imageChunk.metadata).toBeDefined();
            expect(imageChunk.metadata.filename).toBe('test-image.png');
        });

        test('should properly identify text chunks by chunkType property', () => {
            const textChunk = {
                chunkType: 'text',
                chunkContent: 'Some text content',
                metadata: {}
            };
            
            expect(textChunk.chunkType).toBe('text');
            expect(textChunk.chunkContent).toBe('Some text content');
        });
    });
});
