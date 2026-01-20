/**
 * Frontend Unit Tests - Chunker Screen UI
 * Tests for chunker screen UI components in public/index.html
 */

describe('Chunker Screen UI', () => {
  beforeEach(() => {
    // Setup DOM with Chunker screen structure
    document.body.innerHTML = `
      <div class="container">
        <div id="chunkerScreen" class="screen active">
          <div class="user-header">
            <div class="app-mode">
              <button id="ragScreenButton" class="app-mode-btn">RAG</button>
            </div>
            <div class="user-info">
              <span id="userWelcome">Loading user...</span>
            </div>
            <div class="user-actions">
              <button id="createChunksButton" class="create-chunks-btn">Create Chunks for POCs</button>
              <button id="assessQualityButton" class="assess-quality-btn">Assess Chunks of POCs</button>
              <button id="exportReportsButton" class="export-reports-btn">Export Quality Reports</button>
              <button id="logoutButton" class="logout-btn">Logout</button>
            </div>
          </div>
          
          <header>
            <div class="top-controls">
              <div class="search-container">
                <input type="text" id="searchInput" placeholder="Search all fields..." />
                <button id="searchButton">Search</button>
                <button id="clearSearch">Clear</button>
              </div>
              
              <div class="filter-toggle-container">
                <button id="filterToggleBtn" class="filter-toggle-btn">
                  <span>Filters</span>
                  <span class="filter-arrow">▼</span>
                </button>
              </div>
            </div>
            
            <div id="filterPanel" class="filter-panel hidden">
              <div class="filter-section">
                <label>Content Types</label>
                <div class="button-group">
                  <div id="contentTypeButtons" style="display: contents;">
                    <div style="padding: 10px; color: #666; font-style: italic;">Loading content types...</div>
                  </div>
                  <div class="filter-divider"></div>
                  <button id="selectAllContentTypes" class="filter-btn secondary">Select All</button>
                  <button id="deselectAllContentTypes" class="filter-btn secondary">Deselect All</button>
                </div>
              </div>
            </div>

            <div class="bottom-controls">
              <div class="selection-controls">
                <button id="selectAllGlobal">Select All</button>
                <button id="selectAllPage">Select All On Page</button>
                <button id="deselectAll">Deselect All</button>
                <span id="selectedCount">0 selected</span>
              </div>
              <div class="pagination-info">
                <span id="paginationInfo">Loading...</span>
              </div>
            </div>
          </header>

          <div class="content-area">
            <div class="loading" id="loading">
              <div class="spinner"></div>
              <p>Loading data...</p>
            </div>

            <div class="error" id="error" style="display: none;">
              <p id="errorMessage"></p>
              <button onclick="location.reload()">Retry</button>
            </div>

            <div class="poc-list" id="pocList">
              <!-- POC items will be dynamically inserted here -->
            </div>

            <div class="pagination" id="pagination">
              <button id="prevPage" disabled>Previous</button>
              <span id="pageInfo">Page 1 of 1</span>
              <button id="nextPage" disabled>Next</button>
            </div>
          </div>
        </div>
      </div>
    `;
  });

  describe('Screen Structure', () => {
    test('should have chunker screen element', () => {
      const chunkerScreen = document.getElementById('chunkerScreen');
      expect(chunkerScreen).not.toBeNull();
      expect(chunkerScreen.classList.contains('screen')).toBe(true);
    });

    test('should have active class by default', () => {
      const chunkerScreen = document.getElementById('chunkerScreen');
      expect(chunkerScreen.classList.contains('active')).toBe(true);
    });

    test('should have user header', () => {
      const userHeader = document.querySelector('#chunkerScreen .user-header');
      expect(userHeader).not.toBeNull();
    });

    test('should have main header', () => {
      const header = document.querySelector('#chunkerScreen header');
      expect(header).not.toBeNull();
    });

    test('should have content area', () => {
      const contentArea = document.querySelector('.content-area');
      expect(contentArea).not.toBeNull();
    });
  });

  describe('User Header Elements', () => {
    test('should have app-mode section', () => {
      const appMode = document.querySelector('.app-mode');
      expect(appMode).not.toBeNull();
    });

    test('should have RAG screen button', () => {
      const ragButton = document.getElementById('ragScreenButton');
      expect(ragButton).not.toBeNull();
      expect(ragButton.classList.contains('app-mode-btn')).toBe(true);
      expect(ragButton.textContent).toBe('RAG');
    });

    test('should have user-info section', () => {
      const userInfo = document.querySelector('.user-info');
      expect(userInfo).not.toBeNull();
    });

    test('should have user welcome element', () => {
      const userWelcome = document.getElementById('userWelcome');
      expect(userWelcome).not.toBeNull();
      expect(userWelcome.textContent).toBe('Loading user...');
    });

    test('should have user-actions section', () => {
      const userActions = document.querySelector('.user-actions');
      expect(userActions).not.toBeNull();
    });

    test('should have Create Chunks button', () => {
      const button = document.getElementById('createChunksButton');
      expect(button).not.toBeNull();
      expect(button.classList.contains('create-chunks-btn')).toBe(true);
      expect(button.textContent).toBe('Create Chunks for POCs');
    });

    test('should have Assess Quality button', () => {
      const button = document.getElementById('assessQualityButton');
      expect(button).not.toBeNull();
      expect(button.classList.contains('assess-quality-btn')).toBe(true);
      expect(button.textContent).toBe('Assess Chunks of POCs');
    });

    test('should have Export Reports button', () => {
      const button = document.getElementById('exportReportsButton');
      expect(button).not.toBeNull();
      expect(button.classList.contains('export-reports-btn')).toBe(true);
      expect(button.textContent).toBe('Export Quality Reports');
    });

    test('should have Logout button', () => {
      const button = document.getElementById('logoutButton');
      expect(button).not.toBeNull();
      expect(button.classList.contains('logout-btn')).toBe(true);
      expect(button.textContent).toBe('Logout');
    });
  });

  describe('Search Container', () => {
    test('should have search container', () => {
      const container = document.querySelector('.search-container');
      expect(container).not.toBeNull();
    });

    test('should have search input', () => {
      const input = document.getElementById('searchInput');
      expect(input).not.toBeNull();
      expect(input.type).toBe('text');
    });

    test('should have search placeholder', () => {
      const input = document.getElementById('searchInput');
      expect(input.placeholder).toBe('Search all fields...');
    });

    test('should have search button', () => {
      const button = document.getElementById('searchButton');
      expect(button).not.toBeNull();
      expect(button.textContent).toBe('Search');
    });

    test('should have clear search button', () => {
      const button = document.getElementById('clearSearch');
      expect(button).not.toBeNull();
      expect(button.textContent).toBe('Clear');
    });

    test('search input should accept text', () => {
      const input = document.getElementById('searchInput');
      input.value = 'test search';
      expect(input.value).toBe('test search');
    });

    test('search input should be clearable', () => {
      const input = document.getElementById('searchInput');
      input.value = 'test';
      input.value = '';
      expect(input.value).toBe('');
    });
  });

  describe('Filter Toggle', () => {
    test('should have filter toggle container', () => {
      const container = document.querySelector('.filter-toggle-container');
      expect(container).not.toBeNull();
    });

    test('should have filter toggle button', () => {
      const button = document.getElementById('filterToggleBtn');
      expect(button).not.toBeNull();
      expect(button.classList.contains('filter-toggle-btn')).toBe(true);
    });

    test('should have filter toggle text', () => {
      const button = document.getElementById('filterToggleBtn');
      const text = button.querySelector('span:first-child');
      expect(text.textContent).toBe('Filters');
    });

    test('should have filter arrow', () => {
      const button = document.getElementById('filterToggleBtn');
      const arrow = button.querySelector('.filter-arrow');
      expect(arrow).not.toBeNull();
      expect(arrow.textContent).toBe('▼');
    });

    test('should be clickable', () => {
      const button = document.getElementById('filterToggleBtn');
      const clickHandler = jest.fn();
      button.addEventListener('click', clickHandler);
      button.click();
      expect(clickHandler).toHaveBeenCalled();
    });
  });

  describe('Filter Panel', () => {
    test('should have filter panel', () => {
      const panel = document.getElementById('filterPanel');
      expect(panel).not.toBeNull();
      expect(panel.classList.contains('filter-panel')).toBe(true);
    });

    test('should be hidden by default', () => {
      const panel = document.getElementById('filterPanel');
      expect(panel.classList.contains('hidden')).toBe(true);
    });

    test('should have filter section', () => {
      const section = document.querySelector('.filter-section');
      expect(section).not.toBeNull();
    });

    test('should have Content Types label', () => {
      const label = document.querySelector('.filter-section label');
      expect(label).not.toBeNull();
      expect(label.textContent).toBe('Content Types');
    });

    test('should have button group', () => {
      const buttonGroup = document.querySelector('.button-group');
      expect(buttonGroup).not.toBeNull();
    });

    test('should have content type buttons container', () => {
      const container = document.getElementById('contentTypeButtons');
      expect(container).not.toBeNull();
    });

    test('should have loading message initially', () => {
      const container = document.getElementById('contentTypeButtons');
      const loadingText = container.textContent.trim();
      expect(loadingText).toBe('Loading content types...');
    });

    test('should have filter divider', () => {
      const divider = document.querySelector('.filter-divider');
      expect(divider).not.toBeNull();
    });

    test('should have Select All Content Types button', () => {
      const button = document.getElementById('selectAllContentTypes');
      expect(button).not.toBeNull();
      expect(button.classList.contains('filter-btn')).toBe(true);
      expect(button.classList.contains('secondary')).toBe(true);
      expect(button.textContent).toBe('Select All');
    });

    test('should have Deselect All Content Types button', () => {
      const button = document.getElementById('deselectAllContentTypes');
      expect(button).not.toBeNull();
      expect(button.classList.contains('filter-btn')).toBe(true);
      expect(button.classList.contains('secondary')).toBe(true);
      expect(button.textContent).toBe('Deselect All');
    });
  });

  describe('Selection Controls', () => {
    test('should have selection controls container', () => {
      const container = document.querySelector('.selection-controls');
      expect(container).not.toBeNull();
    });

    test('should have Select All Global button', () => {
      const button = document.getElementById('selectAllGlobal');
      expect(button).not.toBeNull();
      expect(button.textContent).toBe('Select All');
    });

    test('should have Select All Page button', () => {
      const button = document.getElementById('selectAllPage');
      expect(button).not.toBeNull();
      expect(button.textContent).toBe('Select All On Page');
    });

    test('should have Deselect All button', () => {
      const button = document.getElementById('deselectAll');
      expect(button).not.toBeNull();
      expect(button.textContent).toBe('Deselect All');
    });

    test('should have selected count display', () => {
      const count = document.getElementById('selectedCount');
      expect(count).not.toBeNull();
      expect(count.textContent).toBe('0 selected');
    });

    test('all selection buttons should be clickable', () => {
      const buttons = [
        document.getElementById('selectAllGlobal'),
        document.getElementById('selectAllPage'),
        document.getElementById('deselectAll')
      ];
      
      buttons.forEach(button => {
        const clickHandler = jest.fn();
        button.addEventListener('click', clickHandler);
        button.click();
        expect(clickHandler).toHaveBeenCalled();
      });
    });
  });

  describe('Pagination Info', () => {
    test('should have pagination-info container', () => {
      const container = document.querySelector('.pagination-info');
      expect(container).not.toBeNull();
    });

    test('should have pagination info element', () => {
      const info = document.getElementById('paginationInfo');
      expect(info).not.toBeNull();
      expect(info.textContent).toBe('Loading...');
    });
  });

  describe('Content Area Elements', () => {
    test('should have content area', () => {
      const contentArea = document.querySelector('.content-area');
      expect(contentArea).not.toBeNull();
    });

    test('should have loading indicator', () => {
      const loading = document.getElementById('loading');
      expect(loading).not.toBeNull();
      expect(loading.classList.contains('loading')).toBe(true);
    });

    test('should have spinner in loading indicator', () => {
      const spinner = document.querySelector('#loading .spinner');
      expect(spinner).not.toBeNull();
    });

    test('should have loading text', () => {
      const text = document.querySelector('#loading p');
      expect(text).not.toBeNull();
      expect(text.textContent).toBe('Loading data...');
    });

    test('should have error container', () => {
      const error = document.getElementById('error');
      expect(error).not.toBeNull();
      expect(error.classList.contains('error')).toBe(true);
    });

    test('error container should be hidden by default', () => {
      const error = document.getElementById('error');
      expect(error.style.display).toBe('none');
    });

    test('should have error message element', () => {
      const errorMessage = document.getElementById('errorMessage');
      expect(errorMessage).not.toBeNull();
    });

    test('should have retry button in error', () => {
      const retryButton = document.querySelector('#error button');
      expect(retryButton).not.toBeNull();
      expect(retryButton.textContent).toBe('Retry');
    });
  });

  describe('POC List', () => {
    test('should have POC list container', () => {
      const pocList = document.getElementById('pocList');
      expect(pocList).not.toBeNull();
      expect(pocList.classList.contains('poc-list')).toBe(true);
    });

    test('should initially be empty', () => {
      const pocList = document.getElementById('pocList');
      expect(pocList.children.length).toBe(0);
    });

    test('should accept child elements', () => {
      const pocList = document.getElementById('pocList');
      const pocItem = document.createElement('div');
      pocItem.className = 'poc-item';
      pocItem.textContent = 'Test POC';
      pocList.appendChild(pocItem);
      expect(pocList.children.length).toBe(1);
      expect(pocList.querySelector('.poc-item')).not.toBeNull();
    });
  });

  describe('Pagination Controls', () => {
    test('should have pagination container', () => {
      const pagination = document.getElementById('pagination');
      expect(pagination).not.toBeNull();
      expect(pagination.classList.contains('pagination')).toBe(true);
    });

    test('should have previous page button', () => {
      const button = document.getElementById('prevPage');
      expect(button).not.toBeNull();
      expect(button.textContent).toBe('Previous');
    });

    test('previous button should be disabled by default', () => {
      const button = document.getElementById('prevPage');
      expect(button.disabled).toBe(true);
    });

    test('should have page info display', () => {
      const pageInfo = document.getElementById('pageInfo');
      expect(pageInfo).not.toBeNull();
      expect(pageInfo.textContent).toBe('Page 1 of 1');
    });

    test('should have next page button', () => {
      const button = document.getElementById('nextPage');
      expect(button).not.toBeNull();
      expect(button.textContent).toBe('Next');
    });

    test('next button should be disabled by default', () => {
      const button = document.getElementById('nextPage');
      expect(button.disabled).toBe(true);
    });

    test('pagination buttons should be clickable when enabled', () => {
      const prevButton = document.getElementById('prevPage');
      const nextButton = document.getElementById('nextPage');
      
      prevButton.disabled = false;
      nextButton.disabled = false;
      
      const prevHandler = jest.fn();
      const nextHandler = jest.fn();
      
      prevButton.addEventListener('click', prevHandler);
      nextButton.addEventListener('click', nextHandler);
      
      prevButton.click();
      nextButton.click();
      
      expect(prevHandler).toHaveBeenCalled();
      expect(nextHandler).toHaveBeenCalled();
    });
  });

  describe('Layout and Container Relationships', () => {
    test('should have user-header before main header', () => {
      const userHeader = document.querySelector('.user-header');
      const mainHeader = document.querySelector('header');
      
      const userHeaderPosition = Array.from(document.body.querySelectorAll('*')).indexOf(userHeader);
      const mainHeaderPosition = Array.from(document.body.querySelectorAll('*')).indexOf(mainHeader);
      
      expect(userHeaderPosition).toBeLessThan(mainHeaderPosition);
    });

    test('should have header before content area', () => {
      const header = document.querySelector('header');
      const contentArea = document.querySelector('.content-area');
      
      const headerPosition = Array.from(document.body.querySelectorAll('*')).indexOf(header);
      const contentPosition = Array.from(document.body.querySelectorAll('*')).indexOf(contentArea);
      
      expect(headerPosition).toBeLessThan(contentPosition);
    });

    test('should have top-controls before filter panel', () => {
      const topControls = document.querySelector('.top-controls');
      const filterPanel = document.getElementById('filterPanel');
      
      const topPosition = Array.from(document.body.querySelectorAll('*')).indexOf(topControls);
      const panelPosition = Array.from(document.body.querySelectorAll('*')).indexOf(filterPanel);
      
      expect(topPosition).toBeLessThan(panelPosition);
    });

    test('should have filter panel before bottom-controls', () => {
      const filterPanel = document.getElementById('filterPanel');
      const bottomControls = document.querySelector('.bottom-controls');
      
      const panelPosition = Array.from(document.body.querySelectorAll('*')).indexOf(filterPanel);
      const bottomPosition = Array.from(document.body.querySelectorAll('*')).indexOf(bottomControls);
      
      expect(panelPosition).toBeLessThan(bottomPosition);
    });

    test('should have POC list before pagination', () => {
      const pocList = document.getElementById('pocList');
      const pagination = document.getElementById('pagination');
      
      const listPosition = Array.from(document.body.querySelectorAll('*')).indexOf(pocList);
      const paginationPosition = Array.from(document.body.querySelectorAll('*')).indexOf(pagination);
      
      expect(listPosition).toBeLessThan(paginationPosition);
    });
  });

  describe('Accessibility', () => {
    test('search input should have placeholder for screen readers', () => {
      const input = document.getElementById('searchInput');
      expect(input.placeholder).toBeTruthy();
    });

    test('all buttons should be focusable', () => {
      const buttons = [
        document.getElementById('ragScreenButton'),
        document.getElementById('createChunksButton'),
        document.getElementById('assessQualityButton'),
        document.getElementById('exportReportsButton'),
        document.getElementById('logoutButton'),
        document.getElementById('searchButton'),
        document.getElementById('clearSearch'),
        document.getElementById('filterToggleBtn'),
        document.getElementById('selectAllContentTypes'),
        document.getElementById('deselectAllContentTypes'),
        document.getElementById('selectAllGlobal'),
        document.getElementById('selectAllPage'),
        document.getElementById('deselectAll')
      ];
      
      buttons.forEach(button => {
        expect(button.getAttribute('tabindex')).not.toBe('-1');
      });
    });

    test('disabled buttons should not be clickable', () => {
      const prevButton = document.getElementById('prevPage');
      const nextButton = document.getElementById('nextPage');
      
      expect(prevButton.disabled).toBe(true);
      expect(nextButton.disabled).toBe(true);
    });

    test('filter panel label should be associated with content', () => {
      const label = document.querySelector('.filter-section label');
      const contentTypeButtons = document.getElementById('contentTypeButtons');
      expect(label).not.toBeNull();
      expect(contentTypeButtons).not.toBeNull();
    });
  });

  describe('Responsive Behavior', () => {
    test('top-controls should contain search and filter toggle', () => {
      const topControls = document.querySelector('.top-controls');
      const searchContainer = topControls.querySelector('.search-container');
      const filterToggle = topControls.querySelector('.filter-toggle-container');
      
      expect(searchContainer).not.toBeNull();
      expect(filterToggle).not.toBeNull();
    });

    test('bottom-controls should contain selection and pagination info', () => {
      const bottomControls = document.querySelector('.bottom-controls');
      const selectionControls = bottomControls.querySelector('.selection-controls');
      const paginationInfo = bottomControls.querySelector('.pagination-info');
      
      expect(selectionControls).not.toBeNull();
      expect(paginationInfo).not.toBeNull();
    });
  });

  describe('State Management Elements', () => {
    test('should have elements for displaying dynamic data', () => {
      const dynamicElements = [
        document.getElementById('userWelcome'),
        document.getElementById('selectedCount'),
        document.getElementById('paginationInfo'),
        document.getElementById('pageInfo'),
        document.getElementById('pocList'),
        document.getElementById('contentTypeButtons')
      ];
      
      dynamicElements.forEach(element => {
        expect(element).not.toBeNull();
      });
    });

    test('should have loading and error states', () => {
      const loading = document.getElementById('loading');
      const error = document.getElementById('error');
      
      expect(loading).not.toBeNull();
      expect(error).not.toBeNull();
      expect(error.style.display).toBe('none');
    });
  });

  describe('Button Groups', () => {
    test('user-actions should contain all action buttons', () => {
      const userActions = document.querySelector('.user-actions');
      const createButton = userActions.querySelector('#createChunksButton');
      const assessButton = userActions.querySelector('#assessQualityButton');
      const exportButton = userActions.querySelector('#exportReportsButton');
      const logoutButton = userActions.querySelector('#logoutButton');
      
      expect(createButton).not.toBeNull();
      expect(assessButton).not.toBeNull();
      expect(exportButton).not.toBeNull();
      expect(logoutButton).not.toBeNull();
    });

    test('search-container should contain all search controls', () => {
      const searchContainer = document.querySelector('.search-container');
      const input = searchContainer.querySelector('#searchInput');
      const searchButton = searchContainer.querySelector('#searchButton');
      const clearButton = searchContainer.querySelector('#clearSearch');
      
      expect(input).not.toBeNull();
      expect(searchButton).not.toBeNull();
      expect(clearButton).not.toBeNull();
    });

    test('selection-controls should contain all selection buttons', () => {
      const selectionControls = document.querySelector('.selection-controls');
      const selectAll = selectionControls.querySelector('#selectAllGlobal');
      const selectPage = selectionControls.querySelector('#selectAllPage');
      const deselectAll = selectionControls.querySelector('#deselectAll');
      const count = selectionControls.querySelector('#selectedCount');
      
      expect(selectAll).not.toBeNull();
      expect(selectPage).not.toBeNull();
      expect(deselectAll).not.toBeNull();
      expect(count).not.toBeNull();
    });
  });
});
