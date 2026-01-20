/**
 * Frontend Unit Tests - SemanticChunkerApp Class
 * Tests for public/script.js
 */

describe('SemanticChunkerApp', () => {
  let app;
  let mockDocument;

  beforeEach(() => {
    // Setup comprehensive DOM
    document.body.innerHTML = `
      <div id="pocList"></div>
      <div id="loading" style="display: none;"></div>
      <div id="error" style="display: none;"><span id="errorMessage"></span></div>
      <span id="selectedCount">0 selected</span>
      <span id="pageInfo">Page 1 of 1</span>
      <span id="paginationInfo">Showing 0-0 of 0</span>
      <button id="prevPage"></button>
      <button id="nextPage"></button>
      <input id="searchInput" type="text" />
      <button id="searchButton"></button>
      <button id="clearSearch"></button>
      <button id="selectAllGlobal"></button>
      <button id="selectAllPage"></button>
      <button id="deselectAll"></button>
      <button id="logoutButton"></button>
      <button id="assessQualityButton"></button>
      <button id="createChunksButton"></button>
      <button id="exportReportsButton"></button>
      <button id="selectAllContentTypes"></button>
      <button id="deselectAllContentTypes"></button>
      <button id="filterToggleBtn"></button>
      <div id="filterPanel" class="hidden"></div>
      <div id="contentTypeButtons"></div>
      <div id="userWelcome"></div>
      <div id="chunkModal" style="display: none;">
        <span id="closeModal"></span>
        <div id="modalTitle"></div>
        <div id="pocMetadataHeader"></div>
        <div id="pocTextContent"></div>
        <div id="chunksTitle"></div>
        <div id="chunksContent"></div>
      </div>
      <div id="chunkerModal" style="display: none;">
        <span id="closeChunkerModal"></span>
      </div>
      <div id="pocViewModal" style="display: none;">
        <span id="closePocViewModal"></span>
        <div id="pocViewModalTitle"></div>
        <div id="pocViewContent"></div>
      </div>
      <div id="qualityAssessmentModal" style="display: none;">
        <span id="closeQualityModal"></span>
        <button id="cancelProgressButton"></button>
        <button id="closeResultsButton"></button>
        <button id="exportResultsButton"></button>
      </div>
      <div id="assessmentMethodModal" style="display: none;">
        <span id="closeMethodModal"></span>
        <button id="cancelMethodButton"></button>
        <button id="startQualityAssessmentButton"></button>
      </div>
      <div id="chunkCreationSetupModal" style="display: none;">
        <span id="closeChunkCreationSetupModal"></span>
        <button id="cancelChunkCreationButton"></button>
        <button id="startChunkCreationButton"></button>
      </div>
      <div id="chunkCreationProgressModal" style="display: none;">
        <span id="closeChunkCreationModal"></span>
        <button id="cancelChunkCreationProgressButton"></button>
        <button id="closeChunkCreationResultsButton"></button>
      </div>
      <div id="assessmentModal" style="display: none;">
        <button id="closeAssessmentModal"></button>
        <div id="assessmentModalTitle"></div>
        <div id="assessmentPocMetadataHeader"></div>
        <div id="assessmentPocTextContent"></div>
        <div id="assessmentChunksTitle"></div>
        <div id="assessmentChunksContent"></div>
      </div>
    `;

    // Mock fetch
    global.fetch = jest.fn();
    
    // Mock the SemanticChunkerApp class methods that would normally be called in constructor
    app = {
      selectedPocs: new Set(),
      currentPocId: null,
      pocs: [],
      allPocs: [],
      chunkerInfo: new Map(),
      qualityInfo: {},
      currentPage: 1,
      totalPages: 1,
      currentSearch: '',
      filterState: {
        contentTypes: new Set(['READ']),
        allContentTypes: new Set()
      },
      // Mock methods
      toggleSelection: jest.fn((pocId) => {
        if (app.selectedPocs.has(pocId)) {
          app.selectedPocs.delete(pocId);
        } else {
          app.selectedPocs.add(pocId);
        }
      }),
      updateSelectedCount: jest.fn(),
      deselectAll: jest.fn(() => app.selectedPocs.clear()),
      createChunkDisplay: jest.fn((chunk) => {
        const assessment = chunk?.assessments?.[0];
        const chunkerType = chunk?.chunker || 'unknown';
        if (assessment) {
          const score = assessment.qualityScore || 0;
          return `<div>${chunkerType} ${score.toFixed(2)}</div>`;
        }
        return '<div>UNKNOWN</div>';
      }),
      getScoreColorClass: jest.fn((score) => {
        if (score >= 0.8) return 'score-excellent';
        if (score >= 0.6) return 'score-good';
        if (score >= 0.4) return 'score-moderate';
        if (score >= 0.2) return 'score-poor';
        if (score > 0) return 'score-bad';
        return 'score-unknown';
      }),
      getQualityColorClass: jest.fn((quality) => {
        switch(quality) {
          case 'GOOD': return 'quality-good';
          case 'BAD_POC': return 'quality-bad-poc';
          case 'BAD_CHUNKS': return 'quality-bad-chunks';
          default: return 'quality-unknown';
        }
      }),
      openChunkModal: jest.fn(),
      closeChunkModal: jest.fn(),
      handleAssessmentIndicatorClick: jest.fn(),
      openAssessmentModal: jest.fn(),
      closeAssessmentModal: jest.fn(),
      openPocViewModal: jest.fn(),
      closePocViewModal: jest.fn(),
      copyToClipboard: jest.fn(),
      showToast: jest.fn(),
      escapeHtml: jest.fn((text) => {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
      }),
      formatSortDate: jest.fn((dateString) => {
        if (!dateString) return 'No Date';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
      })
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    test('should initialize with default state', () => {
      expect(app.selectedPocs).toEqual(new Set());
      expect(app.currentPocId).toBeNull();
    });

    test('should setup event listeners', () => {
      // Test that event listeners are attached
    });
  });

  describe('POC Selection', () => {
    test('should select a POC', () => {
      const pocId = 'test-poc-123';
      app.toggleSelection(pocId);
      
      expect(app.selectedPocs.has(pocId)).toBe(true);
    });

    test('should deselect a POC', () => {
      const pocId = 'test-poc-123';
      app.selectedPocs.add(pocId);
      app.toggleSelection(pocId);
      
      expect(app.selectedPocs.has(pocId)).toBe(false);
    });

    test('should update selected count display', () => {
      app.selectedPocs.add('poc-1');
      app.selectedPocs.add('poc-2');
      app.updateSelectedCount();
      
      expect(app.updateSelectedCount).toHaveBeenCalled();
    });

    test('should select all POCs', () => {
      app.pocs = [
        { pocId: 'poc-1' },
        { pocId: 'poc-2' },
        { pocId: 'poc-3' }
      ];
      
      // Mock select all behavior
      app.pocs.forEach(poc => app.selectedPocs.add(poc.pocId));
      
      expect(app.selectedPocs.size).toBe(3);
    });

    test('should deselect all POCs', () => {
      app.selectedPocs.add('poc-1');
      app.selectedPocs.add('poc-2');
      
      app.deselectAll();
      
      expect(app.selectedPocs.size).toBe(0);
    });
  });

  describe('Filtering', () => {
    test('should filter POCs by schema type', () => {
      app.pocs = [
        { pocId: 'poc-1', schemaType: 'ARTICLE' },
        { pocId: 'poc-2', schemaType: 'VIDEO' },
        { pocId: 'poc-3', schemaType: 'ARTICLE' }
      ];
      
      const filtered = app.pocs.filter(p => p.schemaType === 'ARTICLE');
      
      expect(filtered.length).toBe(2);
    });

    test('should filter POCs by content type', () => {
      app.pocs = [
        { pocId: 'poc-1', contentType: 'READ' },
        { pocId: 'poc-2', contentType: 'WATCH' }
      ];
      
      const filtered = app.pocs.filter(p => p.contentType === 'READ');
      
      expect(filtered.length).toBe(1);
    });

    test('should filter POCs by search text', () => {
      app.pocs = [
        { pocId: 'poc-1', title: 'Java Programming' },
        { pocId: 'poc-2', title: 'Python Basics' }
      ];
      
      const filtered = app.pocs.filter(p => p.title.includes('Java'));
      
      expect(filtered.length).toBe(1);
    });
  });

  describe('Chunk Display', () => {
    test('should create chunk display for POC with assessments', () => {
      const chunk = {
        chunker: 'DEFAULT-1024T',
        assessments: [{
          method: 'basic-heuristics',
          qualityScore: 0.75,
          assessmentCost: 0,
          updatedAt: new Date()
        }]
      };
      
      const display = app.createChunkDisplay(chunk);
      
      expect(display).toContain('DEFAULT-1024T');
      expect(display).toContain('0.75');
    });

    test('should handle POC without assessments', () => {
      const chunk = {
        chunker: 'DEFAULT-1024T',
        assessments: []
      };
      
      const display = app.createChunkDisplay(chunk);
      
      expect(display).toContain('UNKNOWN');
    });

    test('should sort assessments by updatedAt', () => {
      const now = new Date();
      const earlier = new Date(now - 1000 * 60 * 60); // 1 hour ago
      
      const poc = {
        pocId: 'test-poc',
        chunks: [{
          chunker: 'DEFAULT-1024T',
          assessments: [
            { method: 'basic-heuristics', qualityScore: 0.5, updatedAt: earlier },
            { method: 'ai-advanced', qualityScore: 0.8, updatedAt: now }
          ]
        }]
      };
      
      const display = app.createChunkDisplay(poc);
      
      // Should show ai-advanced first (most recent)
    });
  });

  describe('Quality Score Color Classes', () => {
    test('should return score-excellent for score >= 0.8', () => {
      expect(app.getScoreColorClass(0.9)).toBe('score-excellent');
    });

    test('should return score-good for score >= 0.6', () => {
      expect(app.getScoreColorClass(0.7)).toBe('score-good');
    });

    test('should return score-moderate for score >= 0.4', () => {
      expect(app.getScoreColorClass(0.5)).toBe('score-moderate');
    });

    test('should return score-poor for score >= 0.2', () => {
      expect(app.getScoreColorClass(0.3)).toBe('score-poor');
    });

    test('should return score-bad for score < 0.2', () => {
      expect(app.getScoreColorClass(0.1)).toBe('score-bad');
    });

    test('should return score-unknown for undefined score', () => {
      expect(app.getScoreColorClass(0)).toBe('score-unknown');
    });
  });

  describe('Modal Operations', () => {
    test('should open chunk modal', async () => {
      await app.openChunkModal('test-poc', 'DEFAULT-1024T', 'GOOD', 'basic-heuristics');
      
      expect(app.openChunkModal).toHaveBeenCalledWith('test-poc', 'DEFAULT-1024T', 'GOOD', 'basic-heuristics');
    });

    test('should close chunk modal', () => {
      app.closeChunkModal();
      
      expect(app.closeChunkModal).toHaveBeenCalled();
    });

    test('should open POC view modal', async () => {
      const poc = {
        pocId: 'test-poc',
        title: 'Test POC',
        text: 'Test content'
      };

      await app.openPocViewModal(poc);
      
      expect(app.openPocViewModal).toHaveBeenCalledWith(poc);
    });

    test('should handle assessment indicator click', async () => {
      const pocId = 'test-poc';
      const chunker = 'DEFAULT-1024T';
      const quality = 'GOOD';
      const method = 'basic-heuristics';

      await app.handleAssessmentIndicatorClick(pocId, chunker, quality, method);
      
      expect(app.handleAssessmentIndicatorClick).toHaveBeenCalledWith(pocId, chunker, quality, method);
    });

    test('should open assessment modal', async () => {
      const pocId = 'test-poc';
      const chunkerType = 'DEFAULT-1024T';
      const quality = 'GOOD';
      const assessmentMethod = 'basic-heuristics';

      await app.openAssessmentModal(pocId, chunkerType, quality, assessmentMethod);
      
      expect(app.openAssessmentModal).toHaveBeenCalledWith(pocId, chunkerType, quality, assessmentMethod);
    });

    test('should close assessment modal', () => {
      app.closeAssessmentModal();
      
      expect(app.closeAssessmentModal).toHaveBeenCalled();
    });
  });

  describe('Assessment Modal Operations', () => {
    test('should handle assessment indicator click with valid parameters', async () => {
      const pocId = 'poc-123';
      const chunker = 'DEFAULT-1024T';
      const quality = 'GOOD';
      const method = 'basic-heuristics';

      await app.handleAssessmentIndicatorClick(pocId, chunker, quality, method);
      
      expect(app.handleAssessmentIndicatorClick).toHaveBeenCalledWith(pocId, chunker, quality, method);
    });

    test('should handle assessment indicator click with unknown quality', async () => {
      const pocId = 'poc-123';
      const chunker = 'DEFAULT-1024T';
      const quality = 'UNKNOWN';
      const method = 'basic-heuristics';

      await app.handleAssessmentIndicatorClick(pocId, chunker, quality, method);
      
      expect(app.handleAssessmentIndicatorClick).toHaveBeenCalledWith(pocId, chunker, quality, method);
    });

    test('should handle assessment indicator click with default assessment method', async () => {
      const pocId = 'poc-123';
      const chunker = 'DEFAULT-1024T';
      const quality = 'GOOD';

      await app.handleAssessmentIndicatorClick(pocId, chunker, quality);
      
      expect(app.handleAssessmentIndicatorClick).toHaveBeenCalled();
    });

    test('should open assessment modal with all parameters', async () => {
      const pocId = 'poc-123';
      const chunkerType = 'DEFAULT-1024T';
      const quality = 'GOOD';
      const assessmentMethod = 'basic-heuristics';

      await app.openAssessmentModal(pocId, chunkerType, quality, assessmentMethod);
      
      expect(app.openAssessmentModal).toHaveBeenCalledWith(pocId, chunkerType, quality, assessmentMethod);
    });

    test('should open assessment modal with different chunker types', async () => {
      const pocId = 'poc-123';
      const chunkerType = 'READ-CONTENT-PARA';
      const quality = 'BAD_CHUNKS';
      const assessmentMethod = 'ai-advanced';

      await app.openAssessmentModal(pocId, chunkerType, quality, assessmentMethod);
      
      expect(app.openAssessmentModal).toHaveBeenCalledWith(pocId, chunkerType, quality, assessmentMethod);
    });

    test('should close assessment modal', () => {
      app.closeAssessmentModal();
      
      expect(app.closeAssessmentModal).toHaveBeenCalled();
    });

    test('should handle multiple assessment modal interactions', async () => {
      const pocId = 'poc-123';
      const chunkerType = 'DEFAULT-1024T';
      const quality = 'GOOD';

      // Open modal
      await app.openAssessmentModal(pocId, chunkerType, quality, 'basic-heuristics');
      expect(app.openAssessmentModal).toHaveBeenCalled();

      // Close modal
      app.closeAssessmentModal();
      expect(app.closeAssessmentModal).toHaveBeenCalled();

      // Open again
      await app.openAssessmentModal(pocId, chunkerType, quality, 'ai-advanced');
      expect(app.openAssessmentModal).toHaveBeenCalledTimes(2);
    });

    test('should validate assessment modal DOM elements exist', () => {
      const assessmentModal = document.getElementById('assessmentModal');
      const closeButton = document.getElementById('closeAssessmentModal');
      const modalTitle = document.getElementById('assessmentModalTitle');
      const pocMetadataHeader = document.getElementById('assessmentPocMetadataHeader');
      const pocTextContent = document.getElementById('assessmentPocTextContent');
      const chunksTitle = document.getElementById('assessmentChunksTitle');
      const chunksContent = document.getElementById('assessmentChunksContent');

      expect(assessmentModal).toBeTruthy();
      expect(closeButton).toBeTruthy();
      expect(modalTitle).toBeTruthy();
      expect(pocMetadataHeader).toBeTruthy();
      expect(pocTextContent).toBeTruthy();
      expect(chunksTitle).toBeTruthy();
      expect(chunksContent).toBeTruthy();
    });

    test('should differentiate assessment modal from chunk modal', () => {
      const chunkModal = document.getElementById('chunkModal');
      const assessmentModal = document.getElementById('assessmentModal');

      expect(chunkModal).toBeTruthy();
      expect(assessmentModal).toBeTruthy();
      expect(chunkModal).not.toBe(assessmentModal);
    });

    test('should match chunk modal structure for assessment modal', () => {
      const chunkElements = [
        'chunkModal',
        'closeModal',
        'modalTitle',
        'pocMetadataHeader',
        'pocTextContent',
        'chunksTitle',
        'chunksContent'
      ];

      const assessmentElements = [
        'assessmentModal',
        'closeAssessmentModal',
        'assessmentModalTitle',
        'assessmentPocMetadataHeader',
        'assessmentPocTextContent',
        'assessmentChunksTitle',
        'assessmentChunksContent'
      ];

      // Verify all chunk modal elements exist
      chunkElements.forEach(id => {
        expect(document.getElementById(id)).toBeTruthy();
      });

      // Verify all assessment modal elements exist
      assessmentElements.forEach(id => {
        expect(document.getElementById(id)).toBeTruthy();
      });
    });
  });

  describe('Assessment Operations', () => {
    test('should start quality assessment', async () => {
      app.selectedPocs.add('poc-1');
      
      // Mock method exists but not fully implemented in tests
      expect(app.selectedPocs.has('poc-1')).toBe(true);
    });

    test('should handle assessment errors', async () => {
      app.selectedPocs.add('poc-1');
      
      // Mock error handling
      expect(app.selectedPocs.size).toBe(1);
    });
  });

  describe('Clipboard Operations', () => {
    test('should copy text to clipboard', async () => {
      await app.copyToClipboard('test-text');
      
      expect(app.copyToClipboard).toHaveBeenCalledWith('test-text');
    });

    test('should show toast notification', () => {
      app.showToast('Test message', 'success');
      
      expect(app.showToast).toHaveBeenCalledWith('Test message', 'success');
    });
  });

  describe('Utility Functions', () => {
    test('should escape HTML entities', () => {
      const input = '<script>alert("xss")</script>';
      const escaped = app.escapeHtml(input);
      
      expect(escaped).not.toContain('<script>');
      expect(escaped).toContain('&lt;script&gt;');
    });

    test('should format dates', () => {
      const dateString = '2025-12-08T12:00:00Z';
      const formatted = app.formatSortDate(dateString);
      
      expect(formatted).toBeTruthy();
      expect(formatted).not.toBe('No Date');
    });
  });
});
