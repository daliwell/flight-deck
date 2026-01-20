class SemanticChunkerApp {
    // Attach event listeners for a single POC element after DOM update
    attachPocEventListeners(poc) {
        const checkbox = document.getElementById(`checkbox-${poc._id}`);
        const checkboxContainer = document.getElementById(`checkbox-container-${poc._id}`);
        const title = document.getElementById(`title-${poc._id}`);
        const summary = document.getElementById(`summary-${poc._id}`);
        
        // Add listener for POC ID copy
        const pocIdElement = document.querySelector(`#poc-${poc._id} .poc-id-copy`);
        if (pocIdElement) {
            pocIdElement.addEventListener('click', (e) => {
                e.stopPropagation();
                const pocId = pocIdElement.getAttribute('data-poc-id');
                this.copyToClipboard(pocId);
            });
        }
        
        if (checkbox && checkboxContainer) {
            checkboxContainer.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleSelection(poc._id);
            });
            checkbox.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleSelection(poc._id);
            });
        }
        if (title) {
            title.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openPocViewModal(poc);
            });
        }
        if (summary) {
            summary.addEventListener('click', (e) => {
                e.stopPropagation();
                console.log('Summary clicked for POC:', poc.pocId);
            });
        }
    }
    // Update chunker-list and assessments-list for a single POC
    updateChunkerUIForPoc(pocId) {
        // Find the POC in current data
        const poc = this.pocs.find(p => p._id === pocId) || this.allPocs.find(p => p._id === pocId);
        if (!poc) return;
        console.log('updateChunkerUIForPoc:', pocId, 'chunks:', poc.chunks, 'chunkers:', poc.chunkers);
        // Update chunker-list
        const chunkerListEl = document.querySelector(`[data-poc-id="${pocId}"] .chunker-list`);
        if (chunkerListEl) {
            chunkerListEl.innerHTML = poc.chunkers && poc.chunkers.length
                ? poc.chunkers.map(c => `<span class="chunker-type">${c.type}</span>`).join(', ')
                : '<span class="no-chunkers">No chunks</span>';
        }
        // Update assessments-list
        const assessmentsListEl = document.querySelector(`[data-poc-id="${pocId}"] .assessments-list`);
        if (assessmentsListEl) {
            // Example: enable/disable buttons based on chunk existence
            if (poc.chunkers && poc.chunkers.length) {
                assessmentsListEl.classList.add('has-chunks');
            } else {
                assessmentsListEl.classList.remove('has-chunks');
            }
        }
    }
    constructor() {
        this.currentPage = 1;
        this.totalPages = 1;
        this.currentSearch = '';
        this.currentLimit = 20;
        this.selectedPocs = new Set();
        this.allPocs = [];
        this.chunkerInfo = new Map(); // Cache for chunker information
        this.qualityInfo = {}; // Cache for quality information
        this.chunkerAvailability = {}; // Cache for chunker availability per POC
        this.currentPocId = null; // Track current POC for modal
        this.initialTimeEstimate = null; // Store initial time estimate for countdown
        this.currentModalViewerId = null; // Track current modal's viewer ID for chunk highlighting
        this.currentAssessmentViewerId = null; // Track assessment modal's viewer ID
        this.isProcessingChunks = false; // Flag to prevent closing modal during processing
        
        // Filter state - set READ as default filter
        this.filterState = {
            contentTypes: new Set(['READ']), // Default to READ filter
            allContentTypes: new Set() // Store all available content types for comparison
        };
        
        console.log('Initializing SemanticChunkerApp...');
        this.initializeEventListeners();
        this.loadUserInfo();
        this.loadChunkerInfo();
        this.loadQualityInfo();
        // Load content types first, then load POCs once they're available
        this.loadContentTypes().then(() => this.loadPocs());
    }

    initializeEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('searchInput');
        const searchButton = document.getElementById('searchButton');
        const clearSearch = document.getElementById('clearSearch');

        searchButton.addEventListener('click', () => this.performSearch());
        clearSearch.addEventListener('click', () => this.clearSearch());
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.performSearch();
            }
        });

        // Selection controls
        document.getElementById('selectAllGlobal').addEventListener('click', () => this.selectAllGlobal());
        document.getElementById('selectAllPage').addEventListener('click', () => this.selectAllPage());
        document.getElementById('deselectAll').addEventListener('click', () => this.deselectAll());

        // User authentication
        document.getElementById('logoutButton').addEventListener('click', () => this.logout());

        // Quality assessment
        const assessQualityBtn = document.getElementById('assessQualityButton');
        if (assessQualityBtn) {
            assessQualityBtn.addEventListener('click', (e) => {
                console.log('Button clicked!', e); // Debug log
                try {
                    this.openAssessmentMethodModal();
                } catch (error) {
                    console.error('Error in openAssessmentMethodModal:', error);
                    alert('Error: ' + error.message);
                }
            });
            console.log('Quality assessment button event listener attached successfully');
        } else {
            console.error('Quality assessment button not found!');
        }

        // Create chunks for POCs
        const createChunksBtn = document.getElementById('createChunksButton');
        if (createChunksBtn) {
            createChunksBtn.addEventListener('click', (e) => {
                console.log('Create chunks button clicked!', e);
                try {
                    this.openCreateChunksModal();
                } catch (error) {
                    console.error('Error in openCreateChunksModal:', error);
                    alert('Error: ' + error.message);
                }
            });
            console.log('Create chunks button event listener attached successfully');
        } else {
            console.error('Create chunks button not found!');
        }

        // Export quality reports
        const exportReportsBtn = document.getElementById('exportReportsButton');
        if (exportReportsBtn) {
            exportReportsBtn.addEventListener('click', (e) => {
                console.log('Export reports button clicked!');
                try {
                    this.exportQualityReports();
                } catch (error) {
                    console.error('Error in exportQualityReports:', error);
                    alert('Error: ' + error.message);
                }
            });
            console.log('Export reports button event listener attached successfully');
        } else {
            console.error('Export reports button not found!');
        }

        // Content type filter controls
        document.getElementById('selectAllContentTypes').addEventListener('click', () => this.selectAllContentTypes());
        document.getElementById('deselectAllContentTypes').addEventListener('click', () => this.deselectAllContentTypes());

        // Pagination
        document.getElementById('prevPage').addEventListener('click', () => this.previousPage());
        document.getElementById('nextPage').addEventListener('click', () => this.nextPage());

        // Filter functionality
        const filterToggleBtn = document.getElementById('filterToggleBtn');
        
        if (filterToggleBtn) {
            filterToggleBtn.addEventListener('click', () => this.toggleFilterPanel());
        }

        // Modal controls
        document.getElementById('closeModal').addEventListener('click', () => this.closeChunkModal());
        document.getElementById('chunkModal').addEventListener('click', (e) => {
            if (e.target.id === 'chunkModal') {
                this.closeChunkModal();
            }
        });

        // Chunker Modal controls
        document.getElementById('closeChunkerModal').addEventListener('click', () => this.closeChunkerModal());
        document.getElementById('chunkerModal').addEventListener('click', (e) => {
            if (e.target.id === 'chunkerModal') {
                this.closeChunkerModal();
            }
        });

        // Assessment Modal controls
        document.getElementById('closeAssessmentModal').addEventListener('click', () => this.closeAssessmentModal());
        document.getElementById('assessmentModal').addEventListener('click', (e) => {
            if (e.target.id === 'assessmentModal') {
                this.closeAssessmentModal();
            }
        });

        // POC View Modal controls
        document.getElementById('closePocViewModal').addEventListener('click', () => this.closePocViewModal());
        document.getElementById('pocViewModal').addEventListener('click', (e) => {
            if (e.target.id === 'pocViewModal') {
                this.closePocViewModal();
            }
        });

        // ESC key to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeChunkModal();
                this.closeChunkerModal();
                this.closeAssessmentModal();
                this.closePocViewModal();
                this.closeQualityAssessmentModal();
            }
        });

        // Quality assessment modal controls
        document.getElementById('closeQualityModal').addEventListener('click', () => this.closeQualityAssessmentModal());
        document.getElementById('qualityAssessmentModal').addEventListener('click', (e) => {
            if (e.target.id === 'qualityAssessmentModal') {
                this.closeQualityAssessmentModal();
            }
        });
        document.getElementById('cancelProgressButton').addEventListener('click', () => this.cancelQualityAssessment());
        document.getElementById('closeResultsButton').addEventListener('click', () => this.closeQualityAssessmentModal());
        document.getElementById('exportResultsButton').addEventListener('click', () => this.exportAssessmentResults());

        // Assessment method modal controls
        document.getElementById('closeMethodModal').addEventListener('click', () => this.closeAssessmentMethodModal());
        document.getElementById('assessmentMethodModal').addEventListener('click', (e) => {
            if (e.target.id === 'assessmentMethodModal') {
                this.closeAssessmentMethodModal();
            }
        });
        document.getElementById('cancelMethodButton').addEventListener('click', () => this.closeAssessmentMethodModal());
        document.getElementById('startQualityAssessmentButton').addEventListener('click', () => this.startQualityAssessment());

        // Chunk creation modal controls
        document.getElementById('closeChunkCreationSetupModal').addEventListener('click', () => this.closeChunkCreationSetupModal());
        document.getElementById('chunkCreationSetupModal').addEventListener('click', (e) => {
            if (e.target.id === 'chunkCreationSetupModal') {
                this.closeChunkCreationSetupModal();
            }
        });
        document.getElementById('cancelChunkCreationButton').addEventListener('click', () => this.closeChunkCreationSetupModal());
        document.getElementById('startChunkCreationButton').addEventListener('click', () => this.startChunkCreation());
        
        // Chunk creation progress modal controls
        document.getElementById('closeChunkCreationModal').addEventListener('click', () => {
            // Only allow closing if not currently processing
            if (!this.isProcessingChunks) {
                this.closeChunkCreationProgressModal();
            }
        });
        document.getElementById('chunkCreationProgressModal').addEventListener('click', (e) => {
            // Only allow closing by clicking overlay if not currently processing
            if (e.target.id === 'chunkCreationProgressModal' && !this.isProcessingChunks) {
                this.closeChunkCreationProgressModal();
            }
        });
        document.getElementById('cancelChunkCreationProgressButton').addEventListener('click', () => this.cancelChunkCreation());
        document.getElementById('closeChunkCreationResultsButton').addEventListener('click', () => this.handleChunkCreationClose());
    }

    async loadQualityInfo() {
        try {
            const response = await fetch('/api/qualities');
            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    this.qualityInfo = result.data;
                }
            }
        } catch (error) {
            console.error('Error loading quality information:', error);
        }
    }

    async loadChunkerInfo() {
        try {
            const response = await fetch('/api/chunkers');
            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    result.data.forEach(chunker => {
                        this.chunkerInfo.set(chunker.type, chunker);
                    });
                }
            }
        } catch (error) {
            console.error('Error loading chunker information:', error);
        }
    }

    async loadUserInfo() {
        try {
            const response = await fetch('/auth/user');
            const result = await response.json();
            
            if (result.success && result.user) {
                const userWelcome = document.getElementById('userWelcome');
                userWelcome.innerHTML = `
                    <span>👋 Welcome, <strong>${result.user.name}</strong></span>
                    <span style="font-size: 0.9em; opacity: 0.8;">${result.user.email}</span>
                `;
            } else {
                // User not authenticated, redirect to login
                window.location.href = '/auth/login';
            }
        } catch (error) {
            console.error('Error loading user info:', error);
            // On error, redirect to login
            window.location.href = '/auth/login';
        }
    }

    async logout() {
        try {
            const response = await fetch('/auth/logout');
            if (response.ok) {
                window.location.href = '/auth/login';
            } else {
                alert('Error during logout. Please try again.');
            }
        } catch (error) {
            console.error('Error during logout:', error);
            alert('Error during logout. Please try again.');
        }
    }

    async loadPocs(page = 1, search = '', limit = 20) {
        try {
            this.showLoading();
            this.hideError();

            const queryParams = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString()
            });

            if (search.trim()) {
                queryParams.append('search', search.trim());
            }
            
            // Add content type filter parameters
            // Apply filter if:
            // 1. Some content types are selected AND
            // 2. Either not all types are selected OR allContentTypes hasn't been populated yet
            if (this.filterState.contentTypes.size > 0) {
                // Only skip the filter if ALL content types are explicitly selected
                const allTypesSelected = this.filterState.allContentTypes.size > 0 && 
                    this.filterState.contentTypes.size === this.filterState.allContentTypes.size;
                
                if (!allTypesSelected) {
                    const selectedContentTypes = Array.from(this.filterState.contentTypes);
                    queryParams.append('contentTypes', selectedContentTypes.join(','));
                }
            }

            console.log('Search query:', { search, page, limit, filters: Array.from(this.filterState.contentTypes) });
            const response = await fetch(`/api/pocs?${queryParams}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('Search result:', { success: result.success, count: result.data?.length, total: result.pagination?.totalDocuments });

            if (result.success) {
                this.pocs = result.data;
                this.allPocs = result.data;
                this.currentPage = result.pagination.currentPage;
                this.totalPages = result.pagination.totalPages;
                this.currentSearch = search;
                this.currentLimit = limit;

                this.renderPocs(this.pocs);
                this.updatePagination(result.pagination);
                this.updateSelectedCount();
            } else {
                throw new Error(result.message || 'Failed to load POCs');
            }
        } catch (error) {
            console.error('Error loading POCs:', error);
            this.showError(error.message);
        } finally {
            this.hideLoading();
        }
    }

    async loadContentTypes() {
        try {
            console.log('Loading content types...');
            const response = await fetch('/api/pocs/content-types');
            console.log('Response status:', response.status);
            
            if (!response.ok) {
                const text = await response.text();
                console.error('Response text:', text);
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('Content types response:', result);
            
            // Handle the response format {success: true, data: [...]}
            const contentTypes = result.success ? result.data : result;
            const buttonContainer = document.getElementById('contentTypeButtons');
            
            if (buttonContainer && contentTypes && contentTypes.length > 0) {
                // Clear existing buttons
                buttonContainer.innerHTML = '';
                
                // Store all available content types
                this.filterState.allContentTypes = new Set(contentTypes);
                
                // Create buttons for each content type
                contentTypes.forEach(type => {
                    const button = document.createElement('button');
                    const isActive = this.filterState.contentTypes.has(type);
                    button.className = isActive ? 'filter-btn active' : 'filter-btn';
                    button.textContent = type;
                    button.dataset.contentType = type;
                    button.addEventListener('click', () => this.toggleContentTypeFilter(type));
                    buttonContainer.appendChild(button);
                });
                
                console.log(`Created ${contentTypes.length} content type buttons`);
                
                // Close filter panel after initialization
                this.initializeFilterPanelState();
            } else {
                console.warn('No content types found in database');
                // Don't show error - allow the app to continue without filters
                const buttonContainer = document.getElementById('contentTypeButtons');
                if (buttonContainer) {
                    buttonContainer.innerHTML = '<div style="padding: 10px; color: orange;">No content types available</div>';
                }
            }
        } catch (error) {
            console.error('Error loading content types:', error);
            const buttonContainer = document.getElementById('contentTypeButtons');
            if (buttonContainer) {
                buttonContainer.innerHTML = `<div style="padding: 10px; color: red;">Error: ${error.message}</div>`;
            }
        }
    }

    toggleFilterPanel() {
        const panel = document.getElementById('filterPanel');
        const toggleBtn = document.getElementById('filterToggleBtn');
        
        if (panel && toggleBtn) {
            panel.classList.toggle('hidden');
            toggleBtn.classList.toggle('active');
        }
    }
    
    initializeFilterPanelState() {
        // Close filter panel on startup
        const panel = document.getElementById('filterPanel');
        const toggleBtn = document.getElementById('filterToggleBtn');
        
        if (panel && toggleBtn) {
            panel.classList.add('hidden');
            toggleBtn.classList.remove('active');
        }
    }

    toggleContentTypeFilter(contentType) {
        if (this.filterState.contentTypes.has(contentType)) {
            this.filterState.contentTypes.delete(contentType);
        } else {
            this.filterState.contentTypes.add(contentType);
        }
        
        const button = document.querySelector(`[data-content-type="${contentType}"]`);
        if (button) {
            button.classList.toggle('active', this.filterState.contentTypes.has(contentType));
        }
        
        this.applyFilters();
    }

    selectAllContentTypes() {
        // Select all content types
        if (this.filterState.allContentTypes) {
            this.filterState.contentTypes = new Set(this.filterState.allContentTypes);
            
            // Update all button states
            document.querySelectorAll('[data-content-type]').forEach(button => {
                button.classList.add('active');
            });
            
            this.applyFilters();
        }
    }

    deselectAllContentTypes() {
        // Deselect all content types
        this.filterState.contentTypes.clear();
        
        // Update all button states
        document.querySelectorAll('[data-content-type]').forEach(button => {
            button.classList.remove('active');
        });
        
        this.applyFilters();
    }

    applyFilters() {
        // If there's a search term, fetch all results; otherwise use default pagination
        const limit = this.currentSearch.trim() ? 10000 : 20;
        this.loadPocs(1, this.currentSearch, limit);
    }

    renderPocs(pocs) {
        const pocList = document.getElementById('pocList');
        
        if (!pocs || pocs.length === 0) {
            pocList.innerHTML = `
                <div class="empty-state">
                    <h3>No POCs found</h3>
                    <p>${this.currentSearch ? 'Try adjusting your search criteria.' : 'No data available.'}</p>
                </div>
            `;
            return;
        }

        pocList.innerHTML = pocs.map(poc => {
            this.currentPocId = poc._id; // Set current POC ID for chunk buttons - keep as _id for consistency
            return this.createPocElement(poc);
        }).join('');

        // Add event listeners to checkboxes only
        pocs.forEach(poc => {
            const checkbox = document.getElementById(`checkbox-${poc._id}`);
            const checkboxContainer = document.getElementById(`checkbox-container-${poc._id}`);
            const title = document.getElementById(`title-${poc._id}`);
            const summary = document.getElementById(`summary-${poc._id}`);
            
            // Add listener for POC ID copy
            const pocIdElement = document.querySelector(`#poc-${poc._id} .poc-id-copy`);
            if (pocIdElement) {
                pocIdElement.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const pocId = pocIdElement.getAttribute('data-poc-id');
                    this.copyToClipboard(pocId);
                });
            }
            
            if (checkbox && checkboxContainer) {
                // Handle checkbox container click
                checkboxContainer.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleSelection(poc._id);
                });

                // Handle direct checkbox click
                checkbox.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleSelection(poc._id);
                });
            }

            // Add click handlers for other interactive elements
            if (title) {
                title.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.openPocViewModal(poc);
                });
            }

            if (summary) {
                summary.addEventListener('click', (e) => {
                    e.stopPropagation();
                    console.log('Summary clicked for POC:', poc.pocId);
                    // Future: Expand/collapse summary or show full text
                });
            }
            
            // Add long press detection to chunker buttons
            const chunkerButtons = document.querySelectorAll(`#poc-${poc._id} .chunker-indicator`);
            chunkerButtons.forEach(btn => {
                let pressTimer;
                let isLongPress = false;
                
                btn.addEventListener('mousedown', (e) => {
                    isLongPress = false;
                    pressTimer = setTimeout(() => {
                        isLongPress = true;
                    }, 500); // 500ms for long press
                });
                
                btn.addEventListener('mouseup', (e) => {
                    clearTimeout(pressTimer);
                    e.stopPropagation();
                    
                    const pocId = btn.getAttribute('data-poc-id');
                    const chunkerType = btn.getAttribute('data-chunker');
                    const statusClass = btn.getAttribute('data-status-class');
                    
                    this.handleChunkerClick(pocId, chunkerType, statusClass, isLongPress);
                });
                
                btn.addEventListener('mouseleave', () => {
                    clearTimeout(pressTimer);
                });
                
                // Touch support for mobile
                btn.addEventListener('touchstart', (e) => {
                    isLongPress = false;
                    pressTimer = setTimeout(() => {
                        isLongPress = true;
                    }, 500);
                });
                
                btn.addEventListener('touchend', (e) => {
                    clearTimeout(pressTimer);
                    e.stopPropagation();
                    e.preventDefault();
                    
                    const pocId = btn.getAttribute('data-poc-id');
                    const chunkerType = btn.getAttribute('data-chunker');
                    const statusClass = btn.getAttribute('data-status-class');
                    
                    this.handleChunkerClick(pocId, chunkerType, statusClass, isLongPress);
                });
                
                btn.addEventListener('touchcancel', () => {
                    clearTimeout(pressTimer);
                });
            });
        });
    }

    createPocElement(poc) {
        const isSelected = this.selectedPocs.has(poc._id);
        const chunks = poc.chunks || [];
        const formattedDate = this.formatSortDate(poc.sortDate);
        
        // Create assessment buttons for all available chunkers
        const allChunkers = poc.chunks || [];
        const assessmentButtonsHtml = this.createAssessmentButtonsForAllChunkers(poc);
        
        return `
            <div class="poc-item ${isSelected ? 'selected' : ''}" id="poc-${poc._id}">
                <div class="poc-header">
                    <div class="poc-meta">
                        <span class="poc-id-copy" data-poc-id="${poc.pocId || 'N/A'}" title="Click to copy POC ID - Search value: ${poc.pocId || 'N/A'}">${poc.pocId || 'N/A'}</span>
                        <span class="poc-label sort-date">${formattedDate}</span>
                        <span class="poc-label">${poc.parentSchemaType || 'N/A'}</span>
                        <span class="poc-label">${poc.schemaType || 'N/A'}</span>
                        <span class="poc-label">${poc.contentType || 'N/A'}</span>
                    </div>
                    <div class="checkbox-container" id="checkbox-container-${poc._id}">
                        <input type="checkbox" class="poc-checkbox" id="checkbox-${poc._id}" ${isSelected ? 'checked' : ''}>
                        <label for="checkbox-${poc._id}" class="checkbox-label">Select</label>
                    </div>
                </div>
                <div class="poc-content">
                    <div class="poc-title" id="title-${poc._id}">${this.escapeHtml(poc.title || 'Untitled')}</div>
                    <div class="poc-summary" id="summary-${poc._id}">${this.escapeHtml(poc.summaryEn || poc.summary || 'No summary available')}</div>
                    <div class="poc-chunkers">
                        ${this.createChunkerAvailabilityDisplay(poc)}
                    </div>
                    <div class="chunker-assessments">
                        <div class="assessments-header">Completed Assessments:</div>
                        <div class="assessments-list">
                            ${assessmentButtonsHtml}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    createAssessmentButtonsForAllChunkers(poc) {
        // Get all chunkers from poc.chunks array
        const chunkerMap = new Map();
        
        if (poc.chunks && Array.isArray(poc.chunks)) {
            poc.chunks.forEach(chunkerEntry => {
                if (chunkerEntry.chunker) {
                    chunkerMap.set(chunkerEntry.chunker, chunkerEntry);
                }
            });
        }
        
        if (chunkerMap.size === 0) {
            return '<span class="chunk-info">No chunks available for assessment</span>';
        }
        
        // Create array of buttons with their chunker types for sorting
        const assessmentButtonsWithType = [];
        chunkerMap.forEach((chunkerEntry, chunkerType) => {
            if (chunkerEntry.assessments && Array.isArray(chunkerEntry.assessments) && chunkerEntry.assessments.length > 0) {
                // Create buttons for existing assessments
                chunkerEntry.assessments.forEach(assessment => {
                    const qualityScore = assessment.qualityScore || 0;
                    const method = assessment.method || 'basic-heuristics';
                    
                    // Convert numerical score to quality category for display
                    let quality = 'UNKNOWN';
                    if (qualityScore >= 0.8) {
                        quality = 'GOOD';
                    } else if (qualityScore >= 0.6) {
                        quality = 'MODERATE';
                    } else if (qualityScore >= 0.4) {
                        quality = 'POOR';
                    } else {
                        quality = 'BAD_CHUNKS';
                    }
                    
                    const formattedScore = qualityScore.toFixed(2);
                    const displayText = `chunker: ${chunkerType} method: ${method} quality: ${formattedScore} ${quality}`;
                    const scoreColorClass = this.getScoreColorClass(qualityScore);
                    
                    assessmentButtonsWithType.push({
                        chunkerType,
                        html: `
                        <button class="assessment-indicator ${scoreColorClass}" onclick="window.semanticChunkerApp.handleAssessmentIndicatorClick('${poc._id}', '${chunkerType}', '${quality}', '${method}')" data-chunker="${chunkerType}" data-quality="${quality}" data-method="${method}">
                            ${displayText}
                        </button>
                    `
                    });
                });
            } else {
                // Create button for chunker without assessments
                const displayText = `chunker: ${chunkerType} quality: UNKNOWN`;
                assessmentButtonsWithType.push({
                    chunkerType,
                    html: `
                    <button class="assessment-indicator score-unknown" onclick="window.semanticChunkerApp.handleAssessmentIndicatorClick('${poc._id}', '${chunkerType}', 'UNKNOWN', 'basic-heuristics')" data-chunker="${chunkerType}" data-quality="UNKNOWN">
                        ${displayText}
                    </button>
                `
                });
            }
        });
        
        // Sort alphabetically by chunker type
        assessmentButtonsWithType.sort((a, b) => a.chunkerType.localeCompare(b.chunkerType));
        
        // Extract the HTML strings
        const assessmentButtons = assessmentButtonsWithType.map(item => item.html);
        
        return assessmentButtons.length > 0 ? assessmentButtons.join('') : '<span class="chunk-info">No assessments yet</span>';
    }

    createChunkerAvailabilityDisplay(poc) {
        // Use the existing poc.chunks array to determine chunker availability
        const chunkerItems = [];
        
        // Define chunker display order and info
        const chunkerDisplayInfo = {
            'DEFAULT-1024T': { name: 'DEFAULT-1024T', description: 'Fixed length 1024 tokens with one token overlap', isActive: true },
            'READ-CONTENT-PARA': { name: 'READ-CONTENT-PARA', description: 'One paragraph per chunk - each paragraph becomes its own semantic unit', isActive: true },
            'READ-CONTENT-PARA-LLM': { name: 'READ-CONTENT-PARA-LLM', description: 'One paragraph per chunk with LLM descriptions for images, tables, and code', isActive: true },
            'READ-CONTENT-SHORT': { name: 'READ-CONTENT-SHORT', description: 'Short paragraph chunks < 512 tokens, sections split if > 1024 tokens', isActive: true },
            'READ-CONTENT-SHORT-LLM': { name: 'READ-CONTENT-SHORT-LLM', description: 'Short paragraph chunks with LLM descriptions for images, tables, and code', isActive: true }
        };

        // Process each known chunker
        Object.entries(chunkerDisplayInfo).forEach(([chunkerType, displayInfo]) => {
            // Skip inactive chunkers
            if (!displayInfo.isActive) {
                return;
            }
            
            const chunkerEntry = poc.chunks?.find(chunk => chunk.chunker === chunkerType);
            // Consider chunks to exist if there's a chunker entry (chunks were attempted)
            const hasChunks = !!chunkerEntry;
            let canProcess = true;
            
            // Check if chunker supports this content type
            if (chunkerType === 'READ-CONTENT-SHORT' || chunkerType === 'READ-CONTENT-SHORT-LLM' || 
                chunkerType === 'READ-CONTENT-PARA' || chunkerType === 'READ-CONTENT-PARA-LLM') {
                canProcess = poc.contentType === 'READ';
            }

            let statusIcon, statusText, statusClass;
            
            if (hasChunks) {
                // Use the chunker entry we already found
                const assessmentCount = chunkerEntry?.assessments?.length || 0;
                
                if (assessmentCount > 0) {
                    statusIcon = '✅';  // Keep tick for assessments
                    statusText = `${assessmentCount} assessments`;
                    statusClass = 'has-assessments';
                } else {
                    statusIcon = '';    // No icon for chunks only
                    statusText = 'Chunks created';
                    statusClass = 'has-chunks';
                }
            } else if (canProcess) {
                statusIcon = '⚪';
                statusText = 'Create Chunks';
                statusClass = 'can-process';
            } else {
                statusIcon = '❌';
                statusText = 'Not supported';
                statusClass = 'not-supported';
            }

            chunkerItems.push(`
                <button class="chunker-indicator ${statusClass}" 
                    title="${displayInfo.description}" 
                    data-chunker="${chunkerType}"
                    data-poc-id="${this.currentPocId}"
                    data-status-class="${statusClass}">
                    ${statusIcon} ${displayInfo.name}: ${statusText}
                </button>
            `);
        });

        if (chunkerItems.length === 0) {
            return '<span class="chunker-info">No chunkers available</span>';
        }

        return `
            <div class="chunker-availability">
                <div class="chunker-header">Available Chunks:</div>
                <div class="chunker-list">
                    ${chunkerItems.join('')}
                </div>
            </div>
        `;
    }

    createChunkDisplay(chunk) {
        const chunkerInfo = this.chunkerInfo.get(chunk.chunker);
        const isDefault = chunkerInfo && chunkerInfo.isDefault;
        
        // Handle assessments array
        if (chunk.assessments && Array.isArray(chunk.assessments) && chunk.assessments.length > 0) {
            // Sort assessments by updatedAt (most recent first)
            const sortedAssessments = chunk.assessments.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
            
            // Create display for each assessment
            return sortedAssessments.map(assessment => {
                const qualityScore = assessment.qualityScore || 0;
                const method = assessment.method || 'basic-heuristics';
                
                // Convert numerical score to quality category for display
                let quality = 'UNKNOWN';
                if (qualityScore >= 0.8) {
                    quality = 'GOOD';
                } else if (qualityScore >= 0.6) {
                    quality = 'MODERATE';
                } else if (qualityScore >= 0.4) {
                    quality = 'POOR';
                } else {
                    quality = 'BAD_CHUNKS';
                }
                
                const formattedScore = qualityScore.toFixed(2);
                const displayText = `chunker: ${isDefault ? 'default' : chunk.chunker || 'unknown'} method: ${method} quality: ${formattedScore} ${quality}`;
                
                // Get score color class instead of quality color class
                const scoreColorClass = this.getScoreColorClass(qualityScore);
                
                return `
                    <button class="assessment-indicator ${scoreColorClass}" onclick="window.semanticChunkerApp.handleAssessmentIndicatorClick('${this.currentPocId}', '${chunk.chunker}', '${quality}', '${method}')" data-chunker="${chunk.chunker}" data-quality="${quality}" data-method="${method}">
                        ${displayText}
                    </button>
                `;
            }).join('');
        } else {
            // Fallback for chunks without assessments
            const displayText = `chunker: ${isDefault ? 'default' : chunk.chunker || 'unknown'} quality: UNKNOWN`;
            return `
                <button class="assessment-indicator score-unknown" onclick="window.semanticChunkerApp.handleAssessmentIndicatorClick('${this.currentPocId}', '${chunk.chunker}', 'UNKNOWN', 'basic-heuristics')" data-chunker="${chunk.chunker}" data-quality="UNKNOWN">
                    ${displayText}
                </button>
            `;
        }
    }

    getQualityColorClass(quality) {
        switch(quality) {
            case 'GOOD':
                return 'quality-good';
            case 'BAD_POC':
                return 'quality-bad-poc';
            case 'BAD_CHUNKS':
                return 'quality-bad-chunks';
            case 'UNKNOWN':
            default:
                return 'quality-unknown';
        }
    }

    getScoreColorClass(score) {
        if (score >= 0.8) {
            return 'score-excellent';
        } else if (score >= 0.6) {
            return 'score-good';
        } else if (score >= 0.4) {
            return 'score-moderate';
        } else if (score >= 0.2) {
            return 'score-poor';
        } else if (score > 0) {
            return 'score-bad';
        } else {
            return 'score-unknown';
        }
    }

    async handleChunkClick(pocId, chunker, quality, method = 'basic-heuristics') {
        console.log('Chunk clicked:', { pocId, chunker, quality, method });
        
        try {
            await this.openChunkModal(pocId, chunker, quality, method);
        } catch (error) {
            console.error('Error opening chunk modal:', error);
            alert('Error loading chunk data: ' + error.message);
        }
    }

    async handleChunkerClick(pocId, chunkerType, statusClass, isLongPress = false) {
        console.log('Chunker clicked:', { pocId, chunkerType, statusClass, isLongPress });
        
        try {
            // Get POC data to access content type
            const poc = this.allPocs.find(p => p._id === pocId);
            if (!poc) {
                throw new Error('POC not found');
            }

            switch (statusClass) {
                case 'not-supported':
                    alert(`Not possible to use this chunker for the content type of this POC: ${poc.contentType}`);
                    break;
                    
                case 'can-process':
                    const confirmed = confirm(`Do you want to create chunks for this POC using ${chunkerType}?`);
                    if (confirmed) {
                        // Start chunk creation directly with this chunker
                        await this.startChunkCreationDirectly(pocId, chunkerType);
                    }
                    break;
                    
                case 'has-chunks':
                case 'has-assessments':
                    // Long press: offer to recreate chunks (not available for DEFAULT-1024T)
                    if (isLongPress) {
                        if (chunkerType === 'DEFAULT-1024T') {
                            alert(`Cannot recreate DEFAULT-1024T chunks.\n\nThese are legacy chunks that cannot be regenerated.`);
                        } else {
                            const recreate = confirm(`Recreate chunks for this POC with ${chunkerType}?\n\nThis will delete the existing chunks and create new ones.`);
                            if (recreate) {
                                await this.startChunkCreationDirectly(pocId, chunkerType);
                            }
                        }
                    } else {
                        // Normal click: open chunks modal for viewing
                        await this.openChunkerViewModal(pocId, chunkerType);
                    }
                    break;
                    
                default:
                    console.warn('Unknown chunker status:', statusClass);
            }
        } catch (error) {
            console.error('Error handling chunker click:', error);
            alert('Error: ' + error.message);
        }
    }

    async openChunkModal(pocId, chunkerType, quality, assessmentMethod = 'basic-heuristics') {
        // Show modal and loading state
        const modal = document.getElementById('chunkModal');
        const modalTitle = document.getElementById('modalTitle');
        const pocMetadataHeader = document.getElementById('pocMetadataHeader');
        const pocTextContent = document.getElementById('pocTextContent');
        const chunksContent = document.getElementById('chunksContent');
        const chunksTitle = document.getElementById('chunksTitle');

        modal.style.display = 'flex';
        modalTitle.textContent = `Chunks View - ${assessmentMethod} Assessment`;
        pocMetadataHeader.style.display = 'none';
        pocTextContent.innerHTML = '<div class="loading-spinner">Loading POC text...</div>';
        chunksContent.innerHTML = '<div class="loading-spinner">Loading chunks...</div>';
        chunksTitle.textContent = `Loading chunks...`;

        try {
            // Fetch POC and chunks data with assessment method
            const response = await fetch(`/api/pocs/${pocId}/chunks/${chunkerType}?method=${assessmentMethod}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (result.success) {
                const { poc, chunks, assessmentData } = result.data;
                
                console.log('Received assessment data:', assessmentData);
                console.log('Number of chunks:', chunks.length);
                console.log('First few chunks:', chunks.slice(0, 3));
                
                // Update chunks title with assessment method
                chunksTitle.textContent = `Chunks - ${chunks.length} total. Assessment Method: ${assessmentMethod}`;
                
                // Display POC metadata in header
                const pocMetadata = `
                    <div class="poc-metadata">
                        <div class="poc-id"><strong>POC ID:</strong> ${poc.pocId || 'N/A'}</div>
                        <div class="poc-title"><strong>Title:</strong> ${this.escapeHtml(poc.title || 'Untitled')}</div>
                    </div>
                `;
                pocMetadataHeader.innerHTML = pocMetadata;
                pocMetadataHeader.style.display = 'block';
                
                // Display POC text content
                const pocContent = poc.text || poc.abstract || poc.summaryEn || poc.summary || 'No text content available for this POC.';
                pocTextContent.innerHTML = pocContent;
                
                // Display chunks
                if (chunks && chunks.length > 0) {
                    chunksContent.innerHTML = chunks.map((chunk, index) => {
                        // Handle different data structures based on collection
                        let chunkNumber, chunkText;
                        
                        if (chunkerType === 'DEFAULT-1024T') {
                            // From pocEmbeddings collection
                            chunkNumber = chunk.index !== undefined ? chunk.index : (chunk.total || index + 1);
                            chunkText = chunk.text || chunk.abstract || chunk.summaryEn || chunk.title || 'No content';
                        } else {
                            // From chunkAuditChunks collection - chunkOrder is 1-indexed, display as 0-indexed
                            chunkNumber = chunk.chunkOrder !== undefined ? (chunk.chunkOrder - 1) : index;
                            chunkText = chunk.chunkContent || chunk.text || 'No content';
                        }
                        
                        // Get assessment data for this chunk
                        const assessment = assessmentData ? assessmentData[chunkNumber] : null;
                        let assessmentHtml = '';
                        let scoreClass = 'score-unknown';
                        
                        if (assessment) {
                            const score = assessment.qualityScore ? assessment.qualityScore.toFixed(2) : 'N/A';
                            const qualityText = assessment.quality || 'N/A';
                            const numericScore = assessment.qualityScore || 0;
                            
                            // Determine score class for color coding
                            if (numericScore >= 0.8) {
                                scoreClass = 'score-excellent';
                            } else if (numericScore >= 0.6) {
                                scoreClass = 'score-good';
                            } else if (numericScore >= 0.4) {
                                scoreClass = 'score-moderate';
                            } else if (numericScore >= 0.2) {
                                scoreClass = 'score-poor';
                            } else {
                                scoreClass = 'score-bad';
                            }
                            
                            // Split quality text - first line and rest
                            const qualityLines = qualityText.split(' - ');
                            const firstLine = qualityLines[0] || qualityText;
                            const remainingText = qualityLines.slice(1).join(' - ');
                            
                            assessmentHtml = `
                                <div class="chunk-assessment">
                                    <div class="assessment-summary">
                                        <span class="assessment-score">Score: ${score}</span>
                                        <span class="assessment-quality">Quality: ${firstLine}</span>
                                        ${remainingText ? `<button class="expand-btn" onclick="this.parentElement.nextElementSibling.style.display = this.parentElement.nextElementSibling.style.display === 'none' ? 'block' : 'none'; this.textContent = this.textContent === 'Show Details' ? 'Hide Details' : 'Show Details';">Show Details</button>` : ''}
                                    </div>
                                    ${remainingText ? `<div class="assessment-details" style="display: none;">${this.escapeHtml(remainingText)}</div>` : ''}
                                </div>
                            `;
                        }
                        
                        // Check if chunk has a caption in metadata
                        const chunkType = chunk.chunkType || 'section';
                        const metadataHtml = this.buildChunkMetadataHtml(chunk, chunkType);
                        const chunkId = chunk._id || 'N/A';
                        
                        return `
                            <div class="chunk-item-detail">
                                <div class="chunk-header ${scoreClass}">
                                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px;">
                                        <span>Chunk ${chunkNumber} (${index + 1} of ${chunks.length})</span>
                                        <span class="chunk-id-display"><strong>ID:</strong> ${chunkId}</span>
                                    </div>
                                    ${metadataHtml}
                                    ${assessmentHtml}
                                </div>
                                <div class="chunk-text">${this.escapeHtml(chunkText)}</div>
                            </div>
                        `;
                    }).join('');
                    
                    // Add expand/collapse all button
                    const toggleAllBtn = document.getElementById('toggleAllChunks');
                    if (toggleAllBtn) {
                        toggleAllBtn.style.display = 'block';
                        const arrow = toggleAllBtn.querySelector('.filter-arrow');
                        arrow.textContent = '▼';
                        toggleAllBtn.onclick = () => this.toggleAllChunks();
                    }
                    
                    chunksTitle.textContent = `Chunks (${chunkerType}) - ${chunks.length} total`;
                } else {
                    chunksContent.innerHTML = '<div class="no-chunks">No chunks found for this POC with the specified chunker.</div>';
                }
            } else {
                throw new Error(result.message || 'Failed to load chunk data');
            }
        } catch (error) {
            console.error('Error fetching chunk data:', error);
            pocTextContent.innerHTML = `<div class="error-message">Error loading POC text: ${error.message}</div>`;
            chunksContent.innerHTML = `<div class="error-message">Error loading chunks: ${error.message}</div>`;
        }
    }

    closeChunkModal() {
        const modal = document.getElementById('chunkModal');
        modal.style.display = 'none';
    }

    closeChunkerModal() {
        const modal = document.getElementById('chunkerModal');
        modal.style.display = 'none';
    }

    async handleAssessmentIndicatorClick(pocId, chunker, quality, method = 'basic-heuristics') {
        console.log('Assessment indicator clicked:', { pocId, chunker, quality, method });
        
        try {
            // First check if assessment data exists
            const response = await fetch(`/api/pocs/${pocId}/chunks/${chunker}?method=${method}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (result.success) {
                const { assessmentData } = result.data;
                
                // Check if there's any assessment data
                if (!assessmentData || Object.keys(assessmentData).length === 0) {
                    // No assessment exists
                    const confirmed = confirm(`No assessment found for ${chunker} using ${method}.\n\nWould you like to create a new assessment?`);
                    
                    if (confirmed) {
                        // Store the POC and chunker to pre-select after opening assessment method modal
                        this.pendingAssessmentSetup = { pocId, chunker, method };
                        
                        // Open Assessment Method modal - the flow will handle pre-selection
                        await this.openAssessmentMethodModal();
                    } else {
                        // Show toast that there's no assessment
                        this.showToast(`No assessment available for ${chunker}`, 'info');
                    }
                    return;
                }
                
                // Assessment exists, open the modal
                await this.openAssessmentModal(pocId, chunker, quality, method);
            } else {
                throw new Error(result.message || 'Failed to check assessment data');
            }
        } catch (error) {
            console.error('Error checking assessment:', error);
            alert('Error checking assessment data: ' + error.message);
        }
    }

    async openAssessmentModal(pocId, chunkerType, quality, assessmentMethod = 'basic-heuristics') {
        // Show modal and loading state
        const modal = document.getElementById('assessmentModal');
        const modalTitle = document.getElementById('assessmentModalTitle');
        const pocMetadataHeader = document.getElementById('assessmentPocMetadataHeader');
        const detailsContent = document.getElementById('assessmentPocTextContent');
        const chunksContent = document.getElementById('assessmentChunksContent');
        const chunksTitle = document.getElementById('assessmentChunksTitle');
        const toggleAllBtn = document.getElementById('toggleAllAssessmentChunks');

        modal.style.display = 'flex';
        modalTitle.textContent = 'Assessment View';
        pocMetadataHeader.style.display = 'none';
        detailsContent.innerHTML = '<div class="loading-spinner">Loading article content...</div>';
        chunksContent.innerHTML = '<div class="loading-spinner">Loading chunks...</div>';
        chunksTitle.textContent = `Loading chunks...`;
        
        // Store current state for this modal
        this.currentAssessmentPocId = pocId;
        this.currentAssessmentChunkerType = chunkerType;
        this.currentAssessmentChunks = [];

        try {
            // Fetch POC and chunks data with assessment method
            const response = await fetch(`/api/pocs/${pocId}/chunks/${chunkerType}?method=${assessmentMethod}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (result.success) {
                const { poc, chunks, assessmentData } = result.data;
                
                console.log('Received assessment data:', assessmentData);
                console.log('Number of chunks:', chunks.length);
                console.log('First few chunks:', chunks.slice(0, 3));
                console.log('Assessment data keys:', Object.keys(assessmentData || {}));
                
                // Store chunks for later reference
                this.currentAssessmentChunks = chunks || [];
                
                // Update chunks title with assessment method
                chunksTitle.textContent = `Chunks - ${chunks.length} total. Assessment Method: ${assessmentMethod}`;
                
                // Load article content for READ POCs (left panel with HTML)
                if (poc.contentType === 'READ') {
                    await this.populateDetailsSection(pocId, chunks, true); // true = for assessment modal
                } else {
                    detailsContent.innerHTML = '<div style="color: #666; font-style: italic;">Article view only available for READ content</div>';
                }
                
                // Display chunks on right panel with color coding
                if (chunks && chunks.length > 0) {
                    const chunksHtml = chunks.map((chunk, index) => {
                        // Handle different data structures based on collection
                        let chunkNumber, chunkText, chunkType;
                        
                        if (chunkerType === 'DEFAULT-1024T') {
                            // From pocEmbeddings collection
                            chunkNumber = chunk.index !== undefined ? chunk.index : (chunk.total || index + 1);
                            chunkText = chunk.text || chunk.abstract || chunk.summaryEn || chunk.title || 'No content';
                            chunkType = 'section';
                        } else {
                            // From chunkAuditChunks collection - chunkOrder is 1-indexed, display as 0-indexed
                            chunkNumber = chunk.chunkOrder !== undefined ? (chunk.chunkOrder - 1) : index;
                            chunkText = chunk.chunkContent || chunk.text || 'No content';
                            chunkType = chunk.chunkType || 'section';
                        }
                        
                        // Get assessment data for this chunk
                        // The assessment data is indexed by 1-based chunk order from the backend
                        let assessment = null;
                        
                        // Try multiple lookup strategies
                        if (assessmentData) {
                            // Strategy 1: Try 1-based chunk order (most common for non-DEFAULT-1024T)
                            if (chunk.chunkOrder !== undefined) {
                                assessment = assessmentData[chunk.chunkOrder];
                            }
                            
                            // Strategy 2: Try by index field if it exists
                            if (!assessment && chunk.index !== undefined) {
                                assessment = assessmentData[chunk.index];
                            }
                            
                            // Strategy 3: For DEFAULT-1024T, try 0-based index + 1
                            if (!assessment && chunkerType === 'DEFAULT-1024T') {
                                assessment = assessmentData[index + 1];
                            }
                            
                            // Strategy 4: Try direct position in array (0-based)
                            if (!assessment) {
                                assessment = assessmentData[index];
                            }
                            
                            if (assessment) {
                                console.log(`Chunk ${index} (display: ${chunkNumber}): FOUND assessment - score=${assessment.qualityScore}, quality="${assessment.quality}"`);
                            } else {
                                console.log(`Chunk ${index} (display: ${chunkNumber}): NO assessment found. Available keys: ${Object.keys(assessmentData).join(', ')}`);
                            }
                        }
                        
                        let scoreClass = 'score-unknown';
                        let scoreDisplay = 'N/A';
                        let qualityDisplay = 'N/A';
                        
                        if (assessment) {
                            const numericScore = assessment.qualityScore || 0;
                            scoreDisplay = numericScore.toFixed(2);
                            qualityDisplay = assessment.quality || 'N/A';
                            
                            // Determine score class for color coding
                            if (numericScore >= 0.8) {
                                scoreClass = 'score-excellent';
                            } else if (numericScore >= 0.6) {
                                scoreClass = 'score-good';
                            } else if (numericScore >= 0.4) {
                                scoreClass = 'score-moderate';
                            } else if (numericScore >= 0.2) {
                                scoreClass = 'score-poor';
                            } else {
                                scoreClass = 'score-bad';
                            }
                        }
                        
                        // Use chunkType already declared above and build metadata
                        const metadataHtml = this.buildChunkMetadataHtml(chunk, chunkType);
                        const chunkId = chunk._id || 'N/A';
                        
                        return `
                            <div class="chunk-item-detail assessment-chunk-item" data-chunk-index="${index}" data-chunk-text="${this.escapeHtml(chunkText).replace(/"/g, '&quot;')}">
                                <div class="chunk-header ${scoreClass}">
                                    <div class="chunk-header-main">
                                        <span class="chunk-index">Chunk ${chunkNumber} (${index + 1} of ${chunks.length})</span>
                                        <span class="chunk-id-display"><strong>ID:</strong> ${chunkId}</span>
                                        <span class="chunk-score">${scoreDisplay}</span>
                                    </div>
                                    <div class="chunk-quality">${this.escapeHtml(qualityDisplay)}</div>
                                    ${metadataHtml}
                                </div>
                                <div class="chunk-text" style="display: none;">${this.escapeHtml(chunkText)}</div>
                            </div>
                        `;
                    }).join('');
                    
                    // Add expand/collapse all button
                    if (toggleAllBtn) {
                        toggleAllBtn.style.display = 'block';
                        const arrow = toggleAllBtn.querySelector('.filter-arrow');
                        arrow.textContent = '▼';
                        toggleAllBtn.onclick = () => this.toggleAllAssessmentChunks();
                    }
                    
                    chunksContent.innerHTML = chunksHtml;
                    
                    // Add click listeners to chunks for highlighting in the article content
                    setTimeout(() => {
                        document.querySelectorAll('.assessment-chunk-item').forEach((chunkEl, index) => {
                            chunkEl.addEventListener('click', () => {
                                this.selectChunkInAssessmentModal(index);
                            });
                        });
                    }, 100);
                    
                    chunksTitle.textContent = `Chunks (${chunkerType}) - ${chunks.length} total`;
                } else {
                    chunksContent.innerHTML = '<div class="no-chunks">No chunks found for this POC with the specified chunker.</div>';
                }
            } else {
                throw new Error(result.message || 'Failed to load chunk data');
            }
        } catch (error) {
            console.error('Error fetching chunk data:', error);
            detailsContent.innerHTML = `<div class="error-message">Error loading article content: ${error.message}</div>`;
            chunksContent.innerHTML = `<div class="error-message">Error loading chunks: ${error.message}</div>`;
        }
    }

    toggleAllAssessmentChunks() {
        const btn = document.getElementById('toggleAllAssessmentChunks');
        const arrow = btn.querySelector('.filter-arrow');
        const isCollapsed = arrow.textContent === '▼';  // Down arrow means currently collapsed
        
        document.querySelectorAll('.assessment-chunk-item').forEach(chunkEl => {
            const chunkText = chunkEl.querySelector('.chunk-text');
            if (chunkText) {
                if (isCollapsed) {
                    // Expand chunks
                    chunkText.style.display = 'block';
                } else {
                    // Collapse chunks
                    chunkText.style.display = 'none';
                }
            }
        });
        
        // Toggle arrow direction: down=collapsed, up=expanded
        arrow.textContent = isCollapsed ? '▲' : '▼';
        
        // Scroll the selected chunk into view if one is selected
        const selectedChunk = document.querySelector('.assessment-chunk-item.selected');
        if (selectedChunk) {
            selectedChunk.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    toggleAllChunks() {
        const btn = document.getElementById('toggleAllChunks');
        const arrow = btn.querySelector('.filter-arrow');
        const isCollapsed = arrow.textContent === '▼';  // Down arrow means currently collapsed
        
        document.querySelectorAll('#chunksContent .chunk-item-detail').forEach(chunkEl => {
            const chunkText = chunkEl.querySelector('.chunk-text');
            if (chunkText) {
                if (isCollapsed) {
                    // Expand chunks
                    chunkText.style.display = 'block';
                } else {
                    // Collapse chunks
                    chunkText.style.display = 'none';
                }
            }
        });
        
        // Toggle arrow direction: down=collapsed, up=expanded
        arrow.textContent = isCollapsed ? '▲' : '▼';
        
        // Scroll the selected chunk into view if one is selected
        const selectedChunk = document.querySelector('#chunksContent .chunk-item-detail.selected');
        if (selectedChunk) {
            selectedChunk.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    toggleAllChunkerChunks() {
        const btn = document.getElementById('toggleAllChunkerChunks');
        const arrow = btn.querySelector('.filter-arrow');
        const isCollapsed = arrow.textContent === '▼';  // Down arrow means currently collapsed
        
        document.querySelectorAll('#chunkerChunksContent .chunk-item-detail').forEach(chunkEl => {
            const chunkText = chunkEl.querySelector('.chunk-text');
            if (chunkText) {
                if (isCollapsed) {
                    // Expand chunks
                    chunkText.style.display = 'block';
                } else {
                    // Collapse chunks
                    chunkText.style.display = 'none';
                }
            }
        });
        
        // Toggle arrow direction: down=collapsed, up=expanded
        arrow.textContent = isCollapsed ? '▲' : '▼';
        
        // Scroll the selected chunk into view if one is selected
        const selectedChunk = document.querySelector('#chunkerChunksContent .chunk-item-detail.selected');
        if (selectedChunk) {
            selectedChunk.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    selectChunkInAssessmentModal(chunkIndex) {
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
            
            // If raw HTML is visible, also highlight there
            const rawHtmlView = document.getElementById('assessmentRawHtml');
            if (rawHtmlView && rawHtmlView.style.display !== 'none') {
                this.highlightChunkInRawHtml('assessmentArticleContentViewer', 'assessmentRawHtml', true);
            }
            
            // Scroll chunk into view
            chunkEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    highlightChunkInAssessmentArticle(chunkIndex) {
        // Use the stored viewer ID for assessment modal chunk highlighting
        const viewer = document.getElementById(this.currentAssessmentViewerId || 'assessmentArticleContentViewer');
        const detailsContent = document.getElementById('assessmentPocTextContent');
        
        if (!viewer || !this.currentAssessmentChunks || chunkIndex >= this.currentAssessmentChunks.length) {
            console.log('Cannot highlight in assessment: missing data', { viewer: !!viewer, chunks: !!this.currentAssessmentChunks, viewerId: this.currentAssessmentViewerId });
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
                        figure.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                    console.log(`Highlighted image: ${currentChunk.metadata.filename}`);
                    return;
                }
            }
            console.log(`Image not found: ${currentChunk.metadata.filename}`);
            return;
        }
        
        // Check if we have the chunk positions pre-computed
        if (!this.assessmentChunkPositions || !this.assessmentArticleElementMap || !this.assessmentArticleFullText) {
            console.log('Assessment chunk positions not mapped yet');
            return;
        }
        
        const chunkPosition = this.assessmentChunkPositions[chunkIndex];
        if (!chunkPosition || !chunkPosition.found) {
            console.log(`Chunk ${chunkIndex} was not found in article`);
            return;
        }
        
        const chunkStart = chunkPosition.start;
        const chunkEnd = chunkPosition.end;
        
        console.log(`Chunk ${chunkIndex}: positions ${chunkStart}-${chunkEnd} in normalized text`);
        
        // Map back to original article positions (accounting for whitespace normalization)
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
            
            // Move through original text
            const char = this.assessmentArticleFullText[i];
            if (!/\s/.test(char)) {
                normalizedPos++;
            } else if (normalizedPos < this.assessmentNormalizedArticle.length && this.assessmentNormalizedArticle[normalizedPos] === ' ') {
                normalizedPos++;
            }
        }
        
        if (originalEnd === -1) originalEnd = this.assessmentArticleFullText.length;
        
        console.log(`Mapped to original positions: ${originalStart}-${originalEnd}`);
        
        // Find all elements that overlap with this range
        const elementsToHighlight = [];
        let firstElement = null;
        
        this.assessmentArticleElementMap.forEach(item => {
            // Check if this element overlaps with the chunk's range
            if (item.start < originalEnd && item.end > originalStart) {
                elementsToHighlight.push(item.element);
                if (!firstElement) {
                    firstElement = item.element;
                }
            }
        });
        
        console.log(`Found ${elementsToHighlight.length} elements to highlight`);
        
        // Apply highlighting
        elementsToHighlight.forEach(el => {
            el.classList.add('chunk-highlight', 'active');
        });
        
        // Scroll first element into view
        if (firstElement && detailsContent) {
            firstElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    closeAssessmentModal() {
        const modal = document.getElementById('assessmentModal');
        modal.style.display = 'none';
    }

    async populateDetailsSection(pocId, chunks, isAssessmentModal = false) {
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
                        const regex = new RegExp(`src=[\"']([^\"']*${filename}[^\"']*)['\"']`, 'g');
                        processedHtml = processedHtml.replace(regex, `src=\"${imageMap[filename]}\"`);
                    });
                }
                
                detailsContent.innerHTML = `
                    <link rel=\"stylesheet\" href=\"https://redsys-prod.s3.eu-west-1.amazonaws.com/css/main.css\">
                    <style>
                        .article-content-viewer img { max-width: 100%; height: auto; }
                        .article-content-viewer figure,
                        .article-content-viewer .commentedFigure { max-width: 100%; overflow: hidden; }
                        .raw-html-content { background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; padding: 12px; font-family: 'Monaco', 'Courier New', monospace; font-size: 12px; line-height: 1.4; color: #333; overflow: auto; max-height: 600px; white-space: pre-wrap; word-wrap: break-word; }
                    </style>
                    <div class=\"article-content-viewer\" id=\"${viewerId}\">${processedHtml}</div>
                    <div class=\"raw-html-content\" id=\"${rawHtmlId}\" style=\"display: none;\">${this.escapeHtml(processedHtml)}</div>
                `;
                
                // Setup toggle button (which is already in the HTML header)
                const toggleBtn = document.getElementById(toggleId);
                const renderedView = document.getElementById(viewerId);
                const rawHtmlView = document.getElementById(rawHtmlId);
                let isRawMode = false;
                
                // Show the toggle button
                toggleBtn.style.display = 'block';
                
                toggleBtn.addEventListener('click', () => {
                    isRawMode = !isRawMode;
                    if (isRawMode) {
                        renderedView.style.display = 'none';
                        rawHtmlView.style.display = 'block';
                        toggleBtn.textContent = 'Show Rendered';
                        toggleBtn.style.background = '#e7f3ff';
                        toggleBtn.style.borderColor = '#91d5ff';
                        
                        // Highlight the current selection in raw HTML if there is one
                        this.highlightChunkInRawHtml(viewerId, rawHtmlId, isAssessmentModal);
                    } else {
                        renderedView.style.display = 'block';
                        rawHtmlView.style.display = 'none';
                        toggleBtn.textContent = 'Show HTML Text';
                        toggleBtn.style.background = '#f0f2f5';
                        toggleBtn.style.borderColor = '#dee2e6';
                    }
                });
                
                this.markChunkBoundariesUnified(viewerId, chunks, isAssessmentModal);
                
                // Compute raw HTML chunk positions for highlighting
                const rawHtmlContent = processedHtml;
                this.computeRawHtmlChunkPositions(rawHtmlContent, chunks, isAssessmentModal);
                
                // Store the original raw HTML for highlighting
                const prefix = isAssessmentModal ? 'assessment' : '';
                this[`${prefix}OriginalRawHtml`] = rawHtmlContent;
            } else {
                throw new Error(result.error || 'Failed to load article content');
            }
        } catch (error) {
            console.error('Error loading article content:', error);
            detailsContent.innerHTML = '<div style=\"color: #999; padding: 20px;\">Article content not available</div>';
        }
    }

    markChunkBoundariesUnified(viewerId, chunks, isAssessmentModal = false) {
        console.log(`DEBUG markChunkBoundariesUnified called: viewerId=${viewerId}, chunks=${chunks?.length}, isAssessmentModal=${isAssessmentModal}`);
        
        // Check if this is DEFAULT-1024T chunker and use specialized logic
        if (this.currentModalChunkerType === 'DEFAULT-1024T' && !isAssessmentModal) {
            const viewer = document.getElementById(viewerId);
            if (viewer) {
                const htmlContent = viewer.innerHTML;
                this.markChunkBoundariesForDefault1024T(htmlContent, chunks);
            }
            return;
        }
        
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
        
        const normalize = (text) => text.replace(/\s+/g, ' ').replace(/["\"''„]/g, '"').replace(/[–—−]/g, '-').trim();
        this[`${prefix}NormalizedArticle`] = normalize(fullText);
        
        let searchStartPos = 0;
        this[`${prefix}ChunkPositions`] = chunks.map((chunk, idx) => {
            // Use originalContent for code/table chunks (for highlighting), otherwise use chunkContent
            const contentForHighlighting = chunk.metadata?.originalContent || chunk.chunkContent || chunk.text || '';
            const chunkText = contentForHighlighting.trim();
            const normalizedChunk = normalize(chunkText);
            const chunkStart200 = normalizedChunk.substring(0, Math.min(200, normalizedChunk.length));
            let chunkStartPos = this[`${prefix}NormalizedArticle`].indexOf(chunkStart200, searchStartPos);
            
            if (chunkStartPos === -1) {
                const chunkStart50 = normalizedChunk.substring(0, Math.min(50, normalizedChunk.length));
                chunkStartPos = this[`${prefix}NormalizedArticle`].indexOf(chunkStart50, searchStartPos);
            }
            
            if (chunkStartPos === -1) {
                console.warn(`Could not find chunk ${idx} in article`);
                return { index: idx, start: searchStartPos, end: searchStartPos, found: false };
            }
            
            const chunkEnd200 = normalizedChunk.length > 200 ? normalizedChunk.substring(normalizedChunk.length - 200) : normalizedChunk;
            let chunkEndPos = this[`${prefix}NormalizedArticle`].indexOf(chunkEnd200, chunkStartPos);
            
            if (chunkEndPos !== -1) chunkEndPos += chunkEnd200.length;
            else chunkEndPos = chunkStartPos + normalizedChunk.length;
            
            searchStartPos = chunkEndPos;
            return { index: idx, start: chunkStartPos, end: chunkEndPos, found: true };
        });
        
        const modalType = isAssessmentModal ? '(assessment)' : '';
        const foundCount = this[`${prefix}ChunkPositions`].filter(c => c.found).length;
        console.log(`DEBUG markChunkBoundariesUnified: prefix="${prefix}", elementMap.length=${elementMap.length}, set properties: ${prefix}ArticleElementMap, ${prefix}ChunkPositions (${foundCount}/${chunks.length} found), ${modalType}`);
        console.log(`Element map:`, elementMap.slice(0, 5).map(e => ({ tag: e.element.tagName, text: e.text.substring(0, 30), start: e.start, end: e.end })));
        console.log(`Mapped ${foundCount} of ${chunks.length} chunks to article positions ${modalType}`);
    }

    markAssessmentChunkBoundaries(htmlContent, chunks) {
        // Build a comprehensive map of chunks to article elements for assessment modal
        const viewer = document.getElementById('assessmentArticleContentViewer');
        if (!viewer || !chunks || chunks.length === 0) return;
        
        // Use the SAME approach as the chunker: get ALL text content
        const fullText = viewer.textContent || '';
        
        // Build element map by walking through DOM in order
        const elementMap = [];
        let currentPos = 0;
        
        const walkDOM = (node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
                const element = node;
                const tagName = element.tagName?.toLowerCase();
                
                const isTargetBlock = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 
                                       'blockquote', 'li', 'pre', 'code', 'table', 'figure'].includes(tagName);
                
                const hasBlockChildren = isTargetBlock && 
                    element.querySelector('p, h1, h2, h3, h4, h5, h6, blockquote, li, pre, code, table, figure');
                
                if (isTargetBlock && !hasBlockChildren) {
                    const elementText = element.textContent || '';
                    if (elementText.trim().length > 0) {
                        const startPos = currentPos;
                        currentPos += elementText.length;
                        elementMap.push({
                            element: element,
                            text: elementText,
                            start: startPos,
                            end: currentPos
                        });
                        return;
                    }
                }
                
                for (const child of element.childNodes) {
                    walkDOM(child);
                }
            } else if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent || '';
                currentPos += text.length;
            }
        };
        
        walkDOM(viewer);
        
        // Store this mapping for assessment modal
        this.assessmentArticleElementMap = elementMap;
        this.assessmentArticleFullText = fullText;
        
        // Map each chunk to article positions
        const normalize = (text) => text.replace(/\s+/g, ' ').replace(/[""''„]/g, '"').replace(/[–—−]/g, '-').trim();
        this.normalizedAssessmentArticle = normalize(fullText);
        
        let searchStartPos = 0;
        this.assessmentChunkPositions = chunks.map((chunk, idx) => {
            // Use originalContent for code/table chunks (for highlighting), otherwise use chunkContent
            const contentForHighlighting = chunk.metadata?.originalContent || chunk.chunkContent || chunk.text || '';
            const chunkText = contentForHighlighting.trim();
            const normalizedChunk = normalize(chunkText);
            
            const chunkStart200 = normalizedChunk.substring(0, Math.min(200, normalizedChunk.length));
            let chunkStartPos = this.normalizedAssessmentArticle.indexOf(chunkStart200, searchStartPos);
            
            if (chunkStartPos === -1) {
                const chunkStart50 = normalizedChunk.substring(0, Math.min(50, normalizedChunk.length));
                chunkStartPos = this.normalizedAssessmentArticle.indexOf(chunkStart50, searchStartPos);
            }
            
            if (chunkStartPos === -1) {
                console.warn(`Could not find chunk ${idx} in article`);
                return { index: idx, start: searchStartPos, end: searchStartPos, found: false };
            }
            
            const chunkEnd200 = normalizedChunk.length > 200 ? 
                normalizedChunk.substring(normalizedChunk.length - 200) : normalizedChunk;
            let chunkEndPos = this.normalizedAssessmentArticle.indexOf(chunkEnd200, chunkStartPos);
            
            if (chunkEndPos !== -1) {
                chunkEndPos += chunkEnd200.length;
            } else {
                chunkEndPos = chunkStartPos + normalizedChunk.length;
            }
            
            searchStartPos = chunkEndPos;
            
            return {
                index: idx,
                start: chunkStartPos,
                end: chunkEndPos,
                found: true
            };
        });
        
        console.log(`Mapped ${this.assessmentChunkPositions.filter(c => c.found).length} of ${chunks.length} chunks to article positions (assessment)`);
    }

    computeRawHtmlChunkPositions(rawHtml, chunks, isAssessmentModal = false) {
        const prefix = isAssessmentModal ? 'assessment' : '';
        const chunkPositions = this[`${prefix}ChunkPositions`];
        
        if (!chunkPositions || !chunks) return;
        
        // First, extract text using DOM to get proper spacing
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = rawHtml;
        const domText = tempContainer.textContent || '';
        
        // Normalization function
        const normalize = (text) => text.replace(/\s+/g, ' ').replace(/[""''„]/g, '"').replace(/[–—−]/g, '-').trim();
        const normalizedDomText = normalize(domText);
        
        console.log('Building position map: DOM text length:', domText.length, 'Normalized:', normalizedDomText.length);
        
        // Build map from raw HTML positions to DOM text positions
        const buildHtmlToDomMap = () => {
            const map = [];
            let htmlPos = 0;
            let domPos = 0;
            
            while (htmlPos < rawHtml.length) {
                if (rawHtml[htmlPos] === '<') {
                    // Skip HTML tag entirely
                    while (htmlPos < rawHtml.length && rawHtml[htmlPos] !== '>') htmlPos++;
                    htmlPos++;
                } else if (rawHtml[htmlPos] === '&') {
                    // HTML entity - maps to 1 character in DOM text
                    const entityStart = htmlPos;
                    while (htmlPos < rawHtml.length && rawHtml[htmlPos] !== ';' && htmlPos < entityStart + 10) htmlPos++;
                    if (htmlPos < rawHtml.length && rawHtml[htmlPos] === ';') htmlPos++;
                    
                    map.push({ htmlPos: entityStart, domPos });
                    domPos++;
                } else {
                    // Regular character
                    map.push({ htmlPos, domPos });
                    htmlPos++;
                    domPos++;
                }
            }
            
            return map;
        };
        
        const htmlToDomMap = buildHtmlToDomMap();
        
        // Function to find HTML position from DOM text position
        const findHtmlPosFromDom = (domPos) => {
            for (let i = 0; i < htmlToDomMap.length; i++) {
                if (htmlToDomMap[i].domPos >= domPos) {
                    return htmlToDomMap[i].htmlPos;
                }
            }
            return rawHtml.length;
        };
        
        // Map each chunk to raw HTML positions
        const rawHtmlChunkPositions = chunkPositions.map((chunkPos, idx) => {
            if (!chunkPos.found) {
                return { index: chunkPos.index, start: -1, end: -1, found: false };
            }
            
            // Get actual chunk content from database
            const chunk = chunks[idx];
            if (!chunk || !(chunk.chunkContent || chunk.text)) {
                return { index: chunkPos.index, start: -1, end: -1, found: false };
            }
            
            // Use originalContent for code/table chunks (for highlighting), otherwise use chunkContent
            const contentForHighlighting = chunk.metadata?.originalContent || chunk.chunkContent || chunk.text;
            const chunkText = contentForHighlighting.trim();
            const normalizedChunk = normalize(chunkText);
            
            // Find chunk in normalized DOM text
            const searchText = normalizedChunk.substring(0, Math.min(200, normalizedChunk.length));
            const foundNormalizedPos = normalizedDomText.indexOf(searchText);
            
            if (foundNormalizedPos === -1) {
                console.warn(`Chunk ${idx} not found. Search text:`, searchText.substring(0, 50));
                return { index: chunkPos.index, start: -1, end: -1, found: false };
            }
            
            // Now we need to map from normalized DOM position to actual DOM position
            // Walk through DOM text and track normalized position
            let domPos = 0;
            let normalizedPos = 0;
            let startDomPos = -1;
            let endDomPos = -1;
            let lastWasSpace = false;
            
            while (domPos < domText.length && normalizedPos < foundNormalizedPos + normalizedChunk.length) {
                let char = domText[domPos];
                
                // Normalize character
                const charCode = char.charCodeAt(0);
                if (charCode === 0x201C || charCode === 0x201D || charCode === 0x201E || charCode === 0x2018 || charCode === 0x2019) {
                    char = '"';
                }
                if (charCode === 0x2013 || charCode === 0x2014 || charCode === 0x2212) {
                    char = '-';
                }
                
                if (/\s/.test(char)) {
                    // Whitespace
                    if (!lastWasSpace && normalizedPos > 0) {
                        if (normalizedPos === foundNormalizedPos) {
                            startDomPos = domPos;
                        }
                        normalizedPos++;
                        lastWasSpace = true;
                    }
                    domPos++;
                } else {
                    // Regular character
                    if (normalizedPos === foundNormalizedPos) {
                        startDomPos = domPos;
                    }
                    normalizedPos++;
                    domPos++;
                    lastWasSpace = false;
                }
                
                if (startDomPos !== -1 && normalizedPos >= foundNormalizedPos + normalizedChunk.length) {
                    endDomPos = domPos;
                    break;
                }
            }
            
            if (startDomPos === -1 || endDomPos === -1) {
                console.warn(`Chunk ${idx}: Could not map normalized position to DOM position`);
                return { index: chunkPos.index, start: -1, end: -1, found: false };
            }
            
            // Map DOM positions to HTML positions
            let htmlStart = findHtmlPosFromDom(startDomPos);
            let htmlEnd = findHtmlPosFromDom(endDomPos);
            
            // Expand backwards to include opening tags (including list containers and code blocks)
            let expandedStart = htmlStart;
            let searchPos = htmlStart - 1;
            
            // Keep expanding backwards through opening tags
            let foundOpeningTag = true;
            while (foundOpeningTag && searchPos >= 0) {
                // Skip whitespace
                while (searchPos >= 0 && /\s/.test(rawHtml[searchPos])) searchPos--;
                
                if (searchPos >= 0 && rawHtml[searchPos] === '>') {
                    let tagEnd = searchPos;
                    while (searchPos >= 0 && rawHtml[searchPos] !== '<') searchPos--;
                    
                    if (searchPos >= 0 && rawHtml[searchPos + 1] !== '/') {
                        // This is an opening tag, include it
                        const tagContent = rawHtml.substring(searchPos, tagEnd + 1);
                        expandedStart = searchPos;
                        searchPos--;
                        
                        // If this is an inner structural tag, continue looking for outer containers
                        if (tagContent.match(/<(li|p|code|span|em|strong|b|i|u)[\s>]/i)) {
                            continue;
                        }
                        
                        // If this is an outer container tag, include it and stop
                        if (tagContent.match(/<(ul|ol|pre|div)[\s>]/i)) {
                            foundOpeningTag = false;
                        }
                    } else {
                        foundOpeningTag = false;
                    }
                } else {
                    foundOpeningTag = false;
                }
            }
            
            // Expand forwards to include closing tags (including list and code block closing tags)
            let expandedEnd = htmlEnd;
            while (expandedEnd < rawHtml.length && /\s/.test(rawHtml[expandedEnd])) expandedEnd++;
            
            // Keep expanding forwards through closing tags
            let foundClosingTag = true;
            while (foundClosingTag && expandedEnd < rawHtml.length) {
                if (rawHtml[expandedEnd] === '<' && expandedEnd + 1 < rawHtml.length && rawHtml[expandedEnd + 1] === '/') {
                    const tagStart = expandedEnd;
                    while (expandedEnd < rawHtml.length && rawHtml[expandedEnd] !== '>') expandedEnd++;
                    if (expandedEnd < rawHtml.length) {
                        expandedEnd++; // Include the '>'
                        const tagContent = rawHtml.substring(tagStart, expandedEnd);
                        
                        // Skip whitespace after the tag
                        while (expandedEnd < rawHtml.length && /\s/.test(rawHtml[expandedEnd])) expandedEnd++;
                        
                        // If this is a structural closing tag, continue looking for outer closing tags
                        if (tagContent.match(/<\/(li|p|code|span|em|strong|b|i|u)>/i)) {
                            continue;
                        }
                        
                        // If this is an outer structural closing tag (list container, pre, div), include it and stop
                        if (tagContent.match(/<\/(ul|ol|pre|div)>/i)) {
                            foundClosingTag = false;
                        } else {
                            // Not a structural tag, stop expanding
                            foundClosingTag = false;
                        }
                    } else {
                        foundClosingTag = false;
                    }
                } else {
                    foundClosingTag = false;
                }
            }
            
            if (idx === 1) {
                console.log(`Chunk 1: foundNormalizedPos=${foundNormalizedPos}, startDomPos=${startDomPos}, htmlStart=${expandedStart}`);
                console.log(`First 100 chars:`, rawHtml.substring(expandedStart, expandedStart + 100));
            }
            
            return { index: chunkPos.index, start: expandedStart, end: expandedEnd, found: true };
        });
        
        this[`${prefix}RawHtmlChunkPositions`] = rawHtmlChunkPositions;
    }

    async openPocViewModal(poc) {
        const modal = document.getElementById('pocViewModal');
        const modalTitle = document.getElementById('pocViewModalTitle');
        const pocViewContent = document.getElementById('pocViewContent');
        
        // Update modal title
        modalTitle.textContent = `POC View - ${poc.title || 'Untitled'}`;
        
        // Show modal
        modal.style.display = 'flex';
        
        // Check content type
        if (poc.contentType === 'READ') {
            // Load and display article content
            pocViewContent.innerHTML = '<div style="text-align: center; padding: 20px;">Loading article content...</div>';
            
            try {
                const response = await fetch(`/api/pocs/${poc._id}/article-content`);
                
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
                    
                    // Add CSS styling and display the article using S3-hosted CSS
                    pocViewContent.innerHTML = `
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
                        <div class="article-content-viewer">
                            ${processedHtml}
                        </div>
                    `;
                } else {
                    throw new Error(result.error || 'Failed to load article content');
                }
            } catch (error) {
                console.error('Error loading article content:', error);
                pocViewContent.innerHTML = `
                    <div style="color: #d32f2f; padding: 20px; text-align: center;">
                        <p>Error loading article content: ${error.message}</p>
                    </div>
                `;
            }
        } else {
            // Non-READ content type
            pocViewContent.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #666; font-size: 16px;">
                    <p>Functionality coming soon for this content type</p>
                    <p style="margin-top: 10px; font-size: 14px;">Content Type: ${poc.contentType}</p>
                </div>
            `;
        }
    }

    closePocViewModal() {
        const modal = document.getElementById('pocViewModal');
        modal.style.display = 'none';
    }

    toggleSelection(pocId) {
        const element = document.getElementById(`poc-${pocId}`);
        const checkbox = document.getElementById(`checkbox-${pocId}`);
        
        if (this.selectedPocs.has(pocId)) {
            this.selectedPocs.delete(pocId);
            element.classList.remove('selected');
            checkbox.checked = false;
        } else {
            this.selectedPocs.add(pocId);
            element.classList.add('selected');
            checkbox.checked = true;
        }
        
        this.updateSelectedCount();
    }

    selectAllPage() {
        this.allPocs.forEach(poc => {
            if (!this.selectedPocs.has(poc._id)) {
                this.selectedPocs.add(poc._id);
                const element = document.getElementById(`poc-${poc._id}`);
                const checkbox = document.getElementById(`checkbox-${poc._id}`);
                if (element && checkbox) {
                    element.classList.add('selected');
                    checkbox.checked = true;
                }
            }
        });
        this.updateSelectedCount();
    }

    async selectAllGlobal() {
        try {
            // Show loading state for the button
            const button = document.getElementById('selectAllGlobal');
            const originalText = button.textContent;
            button.textContent = 'Loading...';
            button.disabled = true;

            // Build query parameters including current filters
            const queryParams = new URLSearchParams();
            if (this.currentSearch.trim()) {
                queryParams.append('search', this.currentSearch.trim());
            }
            
            // Add content type filter parameters
            // Only add contentTypes filter if not all content types are selected
            if (this.filterState.contentTypes.size > 0 && 
                this.filterState.contentTypes.size < this.filterState.allContentTypes.size) {
                const selectedContentTypes = Array.from(this.filterState.contentTypes);
                queryParams.append('contentTypes', selectedContentTypes.join(','));
            }

            const response = await fetch(`/api/pocs/ids?${queryParams}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (result.success) {
                // Add all filtered IDs to selection
                result.data.forEach(id => {
                    this.selectedPocs.add(id);
                });

                // Update UI for currently visible POCs
                this.allPocs.forEach(poc => {
                    if (this.selectedPocs.has(poc._id)) {
                        const element = document.getElementById(`poc-${poc._id}`);
                        const checkbox = document.getElementById(`checkbox-${poc._id}`);
                        if (element && checkbox) {
                            element.classList.add('selected');
                            checkbox.checked = true;
                        }
                    }
                });

                this.updateSelectedCount();
                
                // Show success message
                const count = result.data.length;
                const hasFilters = this.currentSearch || 
                                 this.filterState.contentTypes.size > 0;
                const filterText = hasFilters ? 'matching current filters' : 'in total';
                alert(`Selected ${count} document${count !== 1 ? 's' : ''} ${filterText}`);
            } else {
                throw new Error(result.message || 'Failed to fetch POC IDs');
            }
        } catch (error) {
            console.error('Error selecting all POCs:', error);
            alert('Error selecting all documents: ' + error.message);
        } finally {
            // Restore button state
            const button = document.getElementById('selectAllGlobal');
            button.textContent = 'Select All';
            button.disabled = false;
        }
    }

    deselectAll() {
        this.selectedPocs.clear();
        this.allPocs.forEach(poc => {
            const element = document.getElementById(`poc-${poc._id}`);
            const checkbox = document.getElementById(`checkbox-${poc._id}`);
            if (element && checkbox) {
                element.classList.remove('selected');
                checkbox.checked = false;
            }
        });
        this.updateSelectedCount();
    }

    updateSelectedCount() {
        const count = this.selectedPocs.size;
        document.getElementById('selectedCount').textContent = `${count} selected`;
    }

    performSearch() {
        const searchInput = document.getElementById('searchInput');
        const searchTerm = searchInput.value.trim();
        this.selectedPocs.clear(); // Clear selections when searching
        
        // Store current filters
        const previousFilters = new Set(this.filterState.contentTypes);
        
        // Clear filters temporarily for search (search all content types)
        this.filterState.contentTypes.clear();
        
        // Update filter buttons to show no selection
        document.querySelectorAll('[data-content-type]').forEach(button => {
            button.classList.remove('active');
        });
        
        // Load with a very high limit to get all search results
        this.loadPocs(1, searchTerm, 10000);
        
        // Store previous filters for potential restoration
        this.previousFilters = previousFilters;
    }

    clearSearch() {
        document.getElementById('searchInput').value = '';
        this.selectedPocs.clear();
        
        // Restore previous filters if they were stored
        if (this.previousFilters && this.previousFilters.size > 0) {
            this.filterState.contentTypes = new Set(this.previousFilters);
            
            // Update filter buttons to show restored selection
            document.querySelectorAll('[data-content-type]').forEach(button => {
                const contentType = button.dataset.contentType;
                button.classList.toggle('active', this.filterState.contentTypes.has(contentType));
            });
            
            this.previousFilters = null;
        }
        
        // Use default limit of 20 when clearing search
        this.loadPocs(1, '', 20);
    }

    previousPage() {
        if (this.currentPage > 1) {
            this.loadPocs(this.currentPage - 1, this.currentSearch, this.currentLimit);
        }
    }

    nextPage() {
        if (this.currentPage < this.totalPages) {
            this.loadPocs(this.currentPage + 1, this.currentSearch, this.currentLimit);
        }
    }

    updatePagination(pagination) {
        document.getElementById('pageInfo').textContent = 
            `Page ${pagination.currentPage} of ${pagination.totalPages}`;
        
        // Calculate the range of documents currently displayed
        const limit = 20; // Items per page (hardcoded to match the API call)
        const startDoc = (pagination.currentPage - 1) * limit + 1;
        const endDoc = Math.min(pagination.currentPage * limit, pagination.totalDocuments);
        
        document.getElementById('paginationInfo').textContent = 
            `Showing ${startDoc}-${endDoc} of ${pagination.totalDocuments} document${pagination.totalDocuments !== 1 ? 's' : ''}`;
        
        document.getElementById('prevPage').disabled = !pagination.hasPrev;
        document.getElementById('nextPage').disabled = !pagination.hasNext;
    }

    showLoading() {
        document.getElementById('loading').style.display = 'block';
        document.getElementById('pocList').style.display = 'none';
    }

    hideLoading() {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('pocList').style.display = 'block';
    }

    showError(message) {
        document.getElementById('errorMessage').textContent = message;
        document.getElementById('error').style.display = 'block';
        document.getElementById('pocList').style.display = 'none';
    }

    hideError() {
        document.getElementById('error').style.display = 'none';
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatSortDate(dateString) {
        if (!dateString) {
            return 'No Date';
        }
        
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) {
                return 'Invalid Date';
            }
            
            const options = { 
                day: 'numeric', 
                month: 'long', 
                year: 'numeric' 
            };
            
            return date.toLocaleDateString('en-US', options);
        } catch (error) {
            console.error('Error formatting date:', error);
            return 'Invalid Date';
        }
    }

    async openQualityAssessmentModal(pocId = null, chunkerType = null) {
        if (!this.selectedAssessmentMethod) {
            alert('Please select an assessment method first.');
            return;
        }

        let selectedPocIds = pocId ? [pocId] : this.getSelectedPocIds();
        if (selectedPocIds.length === 0) {
            alert('Please select at least one POC to assess chunk quality.');
            return;
        }

        // Close method modal and show chunker selection modal
        document.getElementById('assessmentMethodModal').style.display = 'none';

        // Reset modal state
        const modal = document.getElementById('qualityAssessmentModal');
        document.getElementById('chunkerSelectionSection').style.display = 'block';
        document.getElementById('assessmentProgressSection').style.display = 'none';
        document.getElementById('assessmentResultsSection').style.display = 'none';
        
        // Clear previous selections
        document.querySelectorAll('.chunker-option').forEach(option => {
            option.classList.remove('selected');
        });
        
        // Show selected POCs count
        document.getElementById('selectedPocsCount').textContent = selectedPocIds.length;
        
        // Show loading state for chunker grid
        const chunkerGrid = document.getElementById('chunkerGrid');
        chunkerGrid.innerHTML = '<div class="loading-chunkers">Loading available chunkers...</div>';
        
        modal.style.display = 'block';

        try {
            // Fetch available chunkers for selected POCs
            const response = await fetch('/api/pocs/available-chunkers', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    pocIds: selectedPocIds
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (result.success && result.data.chunkers) {
                const availableChunkers = result.data.chunkers;
                this.populateChunkerGrid(availableChunkers, chunkerType);
                
                // If a chunker was pre-selected, automatically select it
                if (chunkerType) {
                    const chunkerOption = document.querySelector(`.chunker-option[data-chunker="${chunkerType}"]`);
                    if (chunkerOption) {
                        chunkerOption.click();
                    }
                }
            } else {
                throw new Error(result.message || 'Failed to fetch chunkers');
            }
        } catch (error) {
            console.error('Error fetching available chunkers:', error);
            alert('Error loading chunkers: ' + error.message);
        }
    }

    populateChunkerGrid(availableChunkers, preselectedChunker = null) {
        const chunkerGrid = document.getElementById('chunkerGrid');
        
        if (!availableChunkers || availableChunkers.length === 0) {
            chunkerGrid.innerHTML = `
                <div class="no-chunkers-message">
                    <p>No chunkers available for the selected POCs.</p>
                    <p>The selected POCs may not have been processed with any chunkers yet.</p>
                </div>
            `;
            return;
        }

        // Generate chunker options HTML
        const chunkerOptionsHtml = availableChunkers.map(chunker => `
            <div class="chunker-option" data-chunker="${chunker.type}" onclick="semanticChunkerApp.selectChunker('${chunker.type}')">
                <div class="chunker-name">${chunker.name}</div>
                <div class="chunker-description">${chunker.description}</div>
            </div>
        `).join('');

        chunkerGrid.innerHTML = chunkerOptionsHtml;
        
        console.log(`Populated chunker grid with ${availableChunkers.length} available chunkers`);
    }

    populateSetupChunkerGrid(availableChunkers) {
        const chunkerGrid = document.getElementById('setupChunkerGrid');
        
        if (!availableChunkers || availableChunkers.length === 0) {
            chunkerGrid.innerHTML = `
                <div class="no-chunkers-message">
                    <p>No chunkers available for the selected POCs.</p>
                    <p>The selected POCs may not have been processed with any chunkers yet.</p>
                </div>
            `;
            return;
        }

        // Sort chunkers alphabetically by type
        const sortedChunkers = [...availableChunkers].sort((a, b) => a.type.localeCompare(b.type));

        // Generate chunker options HTML for setup modal
        const chunkerOptionsHtml = sortedChunkers.map(chunker => `
            <div class="chunker-option" data-chunker-type="${chunker.type}" onclick="semanticChunkerApp.selectSetupChunker('${chunker.type}')">
                <div class="chunker-name">${chunker.name}</div>
                <div class="chunker-description">${chunker.description}</div>
            </div>
        `).join('');

        chunkerGrid.innerHTML = chunkerOptionsHtml;
        
        // If there's a pending assessment setup, auto-select the chunker
        if (this.pendingAssessmentSetup && this.pendingAssessmentSetup.chunker) {
            setTimeout(() => {
                const chunkerOption = document.querySelector(`.chunker-option[data-chunker-type="${this.pendingAssessmentSetup.chunker}"]`);
                if (chunkerOption) {
                    chunkerOption.click();
                }
            }, 100);
        }
        
        console.log(`Populated setup chunker grid with ${availableChunkers.length} available chunkers`);
    }

    async openAssessmentMethodModal() {
        console.log('openAssessmentMethodModal called');
        
        // Check if this is a pending assessment setup (from indicator click)
        let selectedPocIds;
        if (this.pendingAssessmentSetup) {
            selectedPocIds = [this.pendingAssessmentSetup.pocId];
            console.log('Opening modal for pending assessment setup:', this.pendingAssessmentSetup);
        } else {
            selectedPocIds = this.getSelectedPocIds();
        }
        
        console.log('Selected POC IDs:', selectedPocIds.length);
        
        if (selectedPocIds.length === 0) {
            alert('Please select at least one POC to assess chunk quality.');
            return;
        }

        console.log('Proceeding with assessment setup modal...');

        // Show setup modal
        const methodModal = document.getElementById('assessmentMethodModal');
        const methodGrid = document.getElementById('methodGrid');
        const chunkerGrid = document.getElementById('setupChunkerGrid');
        const pocsCount = document.getElementById('setupSelectedPocsCount');
        
        if (!methodModal || !methodGrid || !chunkerGrid) {
            console.error('Required modal elements not found!');
            alert('Error: Modal elements not found!');
            return;
        }
        
        // Clear any previous state and content
        this.selectedAssessmentMethod = null;
        this.selectedChunker = null;
        this.assessmentResults = null;
        
        // Reset the assessment modal sections to show progress instead of results
        const progressSection = document.getElementById('assessmentProgressSection');
        const resultsSection = document.getElementById('assessmentResultsSection');
        if (progressSection) {
            progressSection.style.display = 'block';
        }
        if (resultsSection) {
            resultsSection.style.display = 'none';
        }
        
        // Clear any previous assessment results data
        const totalPocsAssessedEl = document.getElementById('totalPocsAssessed');
        const totalChunksAssessedEl = document.getElementById('totalChunksAssessed');
        const averageQualityScoreEl = document.getElementById('averageQualityScore');
        const resultsTableBody = document.querySelector('#assessmentResultsTable tbody');
        
        if (totalPocsAssessedEl) totalPocsAssessedEl.textContent = '0';
        if (totalChunksAssessedEl) totalChunksAssessedEl.textContent = '0';
        if (averageQualityScoreEl) averageQualityScoreEl.textContent = '0.0';
        if (resultsTableBody) resultsTableBody.innerHTML = '';
        
        // Clear all content areas first
        methodGrid.innerHTML = '';
        chunkerGrid.innerHTML = '';
        
        // Clear any selected states
        document.querySelectorAll('.method-option.selected').forEach(el => {
            el.classList.remove('selected');
        });
        document.querySelectorAll('.chunker-option.selected').forEach(el => {
            el.classList.remove('selected');
        });
        
        // Update POCs count
        if (pocsCount) {
            pocsCount.textContent = selectedPocIds.length;
        }
        
        // Show loading state after clearing
        methodGrid.innerHTML = '<div class="loading-chunkers">Loading assessment methods...</div>';
        chunkerGrid.innerHTML = '<div class="loading-chunkers">Loading chunkers...</div>';
        methodModal.style.display = 'flex';
        
        console.log('Modal should now be visible');

        try {
            console.log('Fetching assessment methods and chunkers...');
            console.log('Using POC IDs:', selectedPocIds);
            
            // Fetch assessment methods and available chunkers for selected POCs in parallel
            const [methodsResponse, chunkersResponse] = await Promise.all([
                fetch('/api/assessment-methods'),
                fetch('/api/pocs/available-chunkers', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ pocIds: selectedPocIds })
                })
            ]);
            
            console.log('Responses received:', methodsResponse.status, chunkersResponse.status);
            
            // Check for authentication redirects
            if (methodsResponse.redirected && methodsResponse.url.includes('/auth/login')) {
                console.log('Authentication redirect detected');
                alert('Please log in to access quality assessment features.');
                window.location.href = '/auth/login';
                return;
            }
            
            if (!methodsResponse.ok || !chunkersResponse.ok) {
                throw new Error(`HTTP error! Methods: ${methodsResponse.status}, Chunkers: ${chunkersResponse.status}`);
            }

            const [methodsResult, chunkersResult] = await Promise.all([
                methodsResponse.json(),
                chunkersResponse.json()
            ]);
            
            if (!methodsResult.success || !chunkersResult.success) {
                throw new Error('Failed to fetch assessment data');
            }

            console.log('Populating grids...');
            // Populate both grids
            this.populateMethodGrid(methodsResult.data);
            this.populateSetupChunkerGrid(chunkersResult.data);
            console.log('Setup modal populated successfully');

        } catch (error) {
            console.error('Error in openAssessmentMethodModal:', error);
            
            // Check if it's an authentication error
            if (error.message.includes('401') || error.message.includes('login')) {
                alert('Please log in to access quality assessment features.');
                return;
            }
            
            methodGrid.innerHTML = `
                <div class="error-message">
                    <p>Error loading assessment methods: ${error.message}</p>
                    <p>Please try again.</p>
                </div>
            `;
            
            // Keep the modal open so user can see the error
        }
    }

    populateMethodGrid(assessmentMethods) {
        const methodGrid = document.getElementById('methodGrid');
        
        if (!assessmentMethods || assessmentMethods.length === 0) {
            methodGrid.innerHTML = `
                <div class="no-chunkers-message">
                    <p>No assessment methods available.</p>
                </div>
            `;
            return;
        }

        // Generate method options HTML
        const methodOptionsHtml = assessmentMethods.map(method => {
            const detailedDescHtml = this.generateDetailedDescriptionHtml(method.detailedDescription);
            
            return `
                <div class="method-option" data-method-id="${method.id}" onclick="semanticChunkerApp.selectAssessmentMethod('${method.id}')">
                    <div class="method-name">${method.name}</div>
                    <div class="method-version">v${method.version}</div>
                    <div class="method-description">${method.description}</div>
                    <div class="method-details-toggle" onclick="event.stopPropagation(); semanticChunkerApp.toggleMethodDetails('${method.id}')">
                        Show Details
                    </div>
                    <div class="method-detailed-description" id="details-${method.id}">
                        ${detailedDescHtml}
                    </div>
                </div>
            `;
        }).join('');

        methodGrid.innerHTML = methodOptionsHtml;
        
        // If there's a pending assessment setup, auto-select the method
        if (this.pendingAssessmentSetup && this.pendingAssessmentSetup.method) {
            // Find and click the method that matches the pending method
            const methodMap = {
                'basic-heuristics': 'basic-heuristics',
                // Add other method mappings as needed
            };
            const methodId = methodMap[this.pendingAssessmentSetup.method] || 'basic-heuristics';
            setTimeout(() => {
                const methodOption = document.querySelector(`.method-option[data-method-id="${methodId}"]`);
                if (methodOption) {
                    methodOption.click();
                }
            }, 100);
        }
        
        console.log(`Populated method grid with ${assessmentMethods.length} assessment methods`);
    }

    generateDetailedDescriptionHtml(details) {
        if (!details) return '';

        let html = `
            <div class="detail-section">
                <div class="detail-title">Overview</div>
                <div class="detail-content">${details.overview}</div>
            </div>
            
            <div class="detail-section">
                <div class="detail-title">Base Score</div>
                <div class="detail-content">${details.baseScore}</div>
            </div>
        `;

        if (details.criteria && details.criteria.length > 0) {
            html += `<div class="detail-section">
                <div class="detail-title">Assessment Criteria</div>`;
            
            details.criteria.forEach(criterion => {
                html += `
                    <div class="detail-content" style="margin-bottom: 10px;">
                        <strong>${criterion.category} (${criterion.weight})</strong><br>
                        ${criterion.description}
                        <ul class="detail-list">
                            ${criterion.rules.map(rule => `<li>${rule}</li>`).join('')}
                        </ul>
                    </div>
                `;
            });
            
            html += `</div>`;
        }

        if (details.qualityRanges && details.qualityRanges.length > 0) {
            html += `
                <div class="detail-section">
                    <div class="detail-title">Quality Score Ranges</div>
                    <table class="quality-ranges-table">
                        <thead>
                            <tr>
                                <th>Range</th>
                                <th>Score</th>
                                <th>Description</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${details.qualityRanges.map(range => `
                                <tr>
                                    <td><strong>${range.range}</strong></td>
                                    <td>${range.score}</td>
                                    <td>${range.description}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }

        if (details.existingQualityIntegration) {
            html += `
                <div class="detail-section">
                    <div class="detail-title">Existing Quality Integration</div>
                    <div class="detail-content">${details.existingQualityIntegration}</div>
                </div>
            `;
        }

        if (details.philosophy) {
            html += `
                <div class="detail-section">
                    <div class="detail-title">Assessment Philosophy</div>
                    <div class="detail-content">${details.philosophy}</div>
                </div>
            `;
        }

        return html;
    }

    selectAssessmentMethod(methodId) {
        // Clear previous selections
        document.querySelectorAll('.method-option').forEach(option => {
            option.classList.remove('selected');
        });
        
        // Select clicked method
        event.target.closest('.method-option').classList.add('selected');
        this.selectedAssessmentMethod = methodId;
        
        // Update button state for combined modal
        this.updateStartButtonState();
    }

    toggleMethodDetails(methodId) {
        const detailsElement = document.getElementById(`details-${methodId}`);
        const toggleElement = event.target;
        
        if (detailsElement.classList.contains('expanded')) {
            detailsElement.classList.remove('expanded');
            toggleElement.textContent = 'Show Details';
        } else {
            // Close all other expanded details first
            document.querySelectorAll('.method-detailed-description.expanded').forEach(el => {
                el.classList.remove('expanded');
            });
            document.querySelectorAll('.method-details-toggle').forEach(el => {
                el.textContent = 'Show Details';
            });
            
            // Open this one
            detailsElement.classList.add('expanded');
            toggleElement.textContent = 'Hide Details';
        }
    }

    closeAssessmentMethodModal() {
        document.getElementById('assessmentMethodModal').style.display = 'none';
        
        // Clear all content and state
        this.selectedAssessmentMethod = null;
        this.selectedChunker = null;
        
        // Clear content areas
        const methodGrid = document.getElementById('methodGrid');
        const chunkerGrid = document.getElementById('setupChunkerGrid');
        if (methodGrid) methodGrid.innerHTML = '';
        if (chunkerGrid) chunkerGrid.innerHTML = '';
        
        // Clear any selected states
        document.querySelectorAll('.method-option.selected').forEach(el => {
            el.classList.remove('selected');
        });
        document.querySelectorAll('.chunker-option.selected').forEach(el => {
            el.classList.remove('selected');
        });
    }

    closeQualityAssessmentModal() {
        document.getElementById('qualityAssessmentModal').style.display = 'none';
        document.getElementById('assessmentMethodModal').style.display = 'none';
        this.isAssessing = false;
        this.assessmentResults = null;
        this.selectedAssessmentMethod = null;
    }

    selectChunker(chunkerType) {
        // Clear previous selections
        document.querySelectorAll('.chunker-option').forEach(option => {
            option.classList.remove('selected');
        });
        
        // Select clicked chunker
        event.target.closest('.chunker-option').classList.add('selected');
        this.selectedChunker = chunkerType;
        
        // Note: This function is now used only for the old quality assessment modal
        // The new combined modal uses selectSetupChunker instead
    }

    selectSetupChunker(chunkerType) {
        // Clear previous selections in setup modal
        document.querySelectorAll('#setupChunkerGrid .chunker-option').forEach(option => {
            option.classList.remove('selected');
        });
        
        // Select clicked chunker
        event.target.closest('.chunker-option').classList.add('selected');
        this.selectedChunker = chunkerType;
        
        // Check if both method and chunker are selected to enable start button
        this.updateStartButtonState();
    }

    updateStartButtonState() {
        const startButton = document.getElementById('startQualityAssessmentButton');
        if (startButton) {
            startButton.disabled = !(this.selectedAssessmentMethod && this.selectedChunker);
        }
    }

    async startQualityAssessment() {
        // Check if this is from pending assessment setup or normal flow
        let selectedPocIds;
        if (this.pendingAssessmentSetup) {
            selectedPocIds = [this.pendingAssessmentSetup.pocId];
        } else {
            selectedPocIds = this.getSelectedPocIds();
        }
        
        if (!this.selectedChunker) {
            alert('Please select a chunker type.');
            return;
        }
        
        if (!this.selectedAssessmentMethod) {
            alert('Please select an assessment method.');
            return;
        }

        // Generate session ID for progress tracking
        const sessionId = `assessment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Close setup modal and open progress modal
        document.getElementById('assessmentMethodModal').style.display = 'none';
        document.getElementById('qualityAssessmentModal').style.display = 'flex';
        document.getElementById('assessmentProgressSection').style.display = 'block';
        
        // Initialize progress
        this.isAssessing = true;
        this.initialTimeEstimate = null; // Reset for new assessment
        const progressBar = document.getElementById('assessmentProgressBar');
        const progressText = document.getElementById('assessmentProgressText');
        const progressStats = document.getElementById('progressStats');
        const progressEstimate = document.getElementById('progressEstimate');
        
        progressBar.style.width = '0%';
        progressText.textContent = '0%';
        progressStats.textContent = 'Initializing assessment...';
        progressEstimate.textContent = '';

        try {
            // Get time estimate first
            progressStats.textContent = 'Calculating time estimate...';
            progressEstimate.textContent = 'Estimating processing time...';
            
            const estimateResponse = await fetch('/api/assessment-time-estimate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    selectedPocIds: selectedPocIds,
                    selectedChunkerMethods: [this.selectedChunker],
                    assessmentMethod: this.selectedAssessmentMethod
                })
            });

            let timeEstimate = null;
            if (estimateResponse.ok) {
                const estimateResult = await estimateResponse.json();
                timeEstimate = estimateResult.estimate;
                this.initialTimeEstimate = timeEstimate; // Store for countdown calculation
                console.log('Time estimate:', timeEstimate);
            }

            // Set up Server-Sent Events for progress tracking
            const eventSource = new EventSource(`/api/assessment-progress/${sessionId}`);
            this.currentEventSource = eventSource; // Store for cleanup
            let currentProgress = null;

            eventSource.onopen = () => {
                console.log('Progress tracking connected');
                progressStats.textContent = 'Connected to progress tracking...';
                if (this.initialTimeEstimate) {
                    progressEstimate.textContent = `⏱️ Estimated total time: ${this.initialTimeEstimate.estimatedTotalTimeFormatted}`;
                }
            };

            eventSource.addEventListener('connected', (event) => {
                console.log('SSE Connected:', JSON.parse(event.data));
                progressStats.textContent = 'Starting assessment...';
            });

            eventSource.addEventListener('progress', (event) => {
                currentProgress = JSON.parse(event.data);
                console.log('Progress update received:', currentProgress);
                this.updateProgressDisplay(currentProgress, timeEstimate);
            });

            eventSource.addEventListener('completed', (event) => {
                const finalProgress = JSON.parse(event.data);
                console.log('Assessment completed:', finalProgress);
                
                eventSource.close();
                this.currentEventSource = null;
                this.assessmentResults = finalProgress.finalResults;
                this.showAssessmentResults();
                
                // Refresh the POC data to show updated assessments in the main UI
                this.refreshPocData();
                
                // Clear pending assessment setup if it was used
                this.pendingAssessmentSetup = null;
            });

            eventSource.addEventListener('error', (event) => {
                const errorData = JSON.parse(event.data);
                console.error('Assessment error:', errorData);
                
                eventSource.close();
                this.currentEventSource = null;
                alert('Assessment failed: ' + errorData.error);
                this.closeQualityAssessmentModal();
            });

            eventSource.onerror = (error) => {
                console.error('SSE connection error:', error);
                eventSource.close();
                this.currentEventSource = null;
                
                // Don't automatically close modal - the assessment might still be running
                progressStats.textContent = 'Connection lost, but assessment may still be running...';
                progressEstimate.textContent = 'Please wait or check back later';
            };

            // Start the assessment
            progressStats.textContent = 'Starting assessment...';
            if (this.initialTimeEstimate) {
                progressEstimate.textContent = `⏱️ Estimated total time: ${this.initialTimeEstimate.estimatedTotalTimeFormatted}`;
            }
            
            const response = await fetch('/api/assess-chunk-quality', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    selectedPocIds: selectedPocIds,
                    selectedChunkerMethods: [this.selectedChunker],
                    assessmentMethod: this.selectedAssessmentMethod,
                    sessionId: sessionId
                })
            });

            // Check for authentication redirect
            if (response.redirected && response.url.includes('/auth/login')) {
                alert('Please log in to access quality assessment features.');
                window.location.href = '/auth/login';
                return;
            }

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // The actual result will come through SSE, but we can handle any immediate errors here
            const result = await response.json();
            console.log('Assessment initiated:', result);
            
        } catch (error) {
            console.error('Assessment failed:', error);
            alert('Assessment failed: ' + error.message);
            this.closeQualityAssessmentModal();
        }
    }

    updateProgressDisplay(progress, timeEstimate) {
        console.log('updateProgressDisplay called with:', progress);
        const progressBar = document.getElementById('assessmentProgressBar');
        const progressText = document.getElementById('assessmentProgressText');
        const progressStats = document.getElementById('progressStats');
        const progressEstimate = document.getElementById('progressEstimate');
        
        console.log('DOM elements found:', {
            progressBar: !!progressBar,
            progressText: !!progressText,
            progressStats: !!progressStats,
            progressEstimate: !!progressEstimate
        });
        
        if (!progressBar || !progressText || !progressStats || !progressEstimate) {
            console.error('Missing required progress display elements!');
            return;
        }
        
        // Calculate progress percentage
        // Use overallProgress if available (includes chunk-level progress), otherwise use POC-level progress
        let percentage;
        if (progress.overallProgress !== undefined) {
            percentage = progress.overallProgress * 100;
        } else {
            percentage = progress.totalPocs > 0 ? (progress.processedPocs / progress.totalPocs) * 100 : 0;
        }
        
        // Update progress bar with smoother animation
        progressBar.style.width = Math.max(5, percentage) + '%'; // Minimum 5% to show activity
        progressText.textContent = Math.round(percentage) + '%';
        
        // Add activity indicator class if processing but not complete
        if (progress.processedPocs < progress.totalPocs && progress.currentPocTitle) {
            progressBar.classList.add('processing');
        } else {
            progressBar.classList.remove('processing');
        }
        
        // Update detailed progress stats
        let statusText = '';
        if (progress.currentPocTitle) {
            statusText = `📄 Currently processing: ${progress.currentPocTitle}`;
            // Add chunk progress if available
            if (progress.currentChunk && progress.totalChunksInCurrentPoc) {
                statusText += ` (chunk ${progress.currentChunk}/${progress.totalChunksInCurrentPoc})`;
            }
        } else if (progress.processedPocs === progress.totalPocs) {
            statusText = `✅ Assessment complete!`;
        } else {
            statusText = `⏳ Preparing next document...`;
        }
        
        const countsText = `Document ${progress.processedPocs + (progress.currentPocTitle ? 1 : 0)} of ${progress.totalPocs} documents`;
        const resultText = `✅ ${progress.successfulPocs} successful | ⏭️ ${progress.skippedPocs} skipped | ❌ ${progress.failedPocs} failed`;
        const costText = progress.totalCost > 0 ? ` | 💰 Cost: $${progress.totalCost.toFixed(4)}` : '';
        
        progressStats.innerHTML = `
            <div style="font-weight: 600; margin-bottom: 8px;">${statusText}</div>
            <div style="color: #666; margin-bottom: 4px;">${countsText}</div>
            <div style="font-size: 0.9em; color: #666;">${resultText}${costText}</div>
        `;
        
        // Update time estimate with proper countdown
        let estimateText = '';
        if (this.initialTimeEstimate && progress.totalPocs > 0) {
            if (progress.processedPocs === progress.totalPocs) {
                estimateText = `✅ Assessment completed!`;
            } else {
                // Calculate remaining time based on progress and initial estimate
                const effectiveProgress = progress.overallProgress !== undefined ? progress.overallProgress : (progress.processedPocs / progress.totalPocs);
                const remainingRatio = 1 - effectiveProgress;
                const estimatedRemainingMs = this.initialTimeEstimate.estimatedTotalTimeMs * remainingRatio;
                
                if (estimatedRemainingMs > 0) {
                    estimateText = `⏱️ Estimated time remaining: ${this.formatTimeRemaining(estimatedRemainingMs)}`;
                } else {
                    estimateText = `⏱️ Nearly complete...`;
                }
            }
        } else if (this.initialTimeEstimate && progress.processedPocs === 0) {
            estimateText = `⏱️ Estimated total time: ${this.initialTimeEstimate.estimatedTotalTimeFormatted}`;
        } else if (progress.processedPocs < progress.totalPocs) {
            estimateText = `⏱️ Calculating time estimate...`;
        }
        
        if (progressEstimate) {
            progressEstimate.textContent = estimateText;
        }
    }

    formatTimeRemaining(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    cancelQualityAssessment() {
        this.isAssessing = false;
        
        // Close any active EventSource connections
        if (this.currentEventSource) {
            this.currentEventSource.close();
            this.currentEventSource = null;
        }
        
        this.closeQualityAssessmentModal();
    }

    showAssessmentResults() {
        if (!this.assessmentResults) return;

        // Switch to results view
        document.getElementById('assessmentProgressSection').style.display = 'none';
        document.getElementById('assessmentResultsSection').style.display = 'block';

        const results = this.assessmentResults;
        
        // Update summary statistics
        document.getElementById('totalPocsAssessed').textContent = results.totalPocs;
        document.getElementById('totalChunksAssessed').textContent = results.totalChunks;
        document.getElementById('averageQualityScore').textContent = results.averageQuality.toFixed(2);
        document.getElementById('chunkerTypeUsed').textContent = results.chunkerType;
        document.getElementById('assessmentMethodUsed').textContent = results.assessmentMethod || 'basic-heuristics';

        // Populate detailed results table
        const tbody = document.getElementById('assessmentResultsBody');
        tbody.innerHTML = '';
        
        results.pocResults.forEach(pocResult => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${pocResult.pocName}</td>
                <td>${pocResult.chunkCount}</td>
                <td class="quality-score quality-${this.getQualityLevel(pocResult.averageQuality)}">${pocResult.averageQuality.toFixed(2)}</td>
                <td>${pocResult.assessmentTime}ms</td>
            `;
            tbody.appendChild(row);
        });
    }

    getQualityLevel(score) {
        if (score >= 0.8) return 'excellent';
        if (score >= 0.6) return 'good';
        if (score >= 0.4) return 'fair';
        return 'poor';
    }

    async exportQualityReports() {
        const selectedPocIds = this.getSelectedPocIds();
        
        if (selectedPocIds.length === 0) {
            alert('Please select at least one POC to export quality reports.');
            return;
        }

        console.log(`Exporting quality reports for ${selectedPocIds.length} selected POCs`);

        try {
            const response = await fetch('/api/export-quality-reports', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ pocIds: selectedPocIds })
            });

            // Check for authentication redirect
            if (response.redirected && response.url.includes('/auth/login')) {
                alert('Please log in to export quality reports.');
                window.location.href = '/auth/login';
                return;
            }

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.message || 'Failed to fetch quality reports');
            }

            if (result.data.length === 0) {
                alert('No quality assessments found for the selected POCs. Please run quality assessments first.');
                return;
            }

            // Prompt for CSV separator
            const separator = prompt('Enter CSV separator (default is ";" for Mac/Excel):', ';');
            if (separator === null) {
                // User cancelled
                return;
            }
            const csvSeparator = separator.trim() || ';';

            // Generate and download CSV
            const csvContent = this.generateQualityReportsCSV(result.data, result.summary, csvSeparator);
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            
            // Generate filename based on number of POCs
            const dateStr = new Date().toISOString().split('T')[0];
            const pocCount = result.summary.totalPocs;
            const filename = pocCount === 1 
                ? `quality_report_poc_${result.data[0].pocId}_${dateStr}.csv`
                : `quality_report_${dateStr}.csv`;
            a.download = filename;
            
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            console.log(`Exported ${result.data.length} quality assessment records`);
            
        } catch (error) {
            console.error('Error exporting quality reports:', error);
            alert('Failed to export quality reports: ' + error.message);
        }
    }

    generateQualityReportsCSV(assessments, summary, separator = ';') {
        // Header for quality reports with camelCase - using \r\n for proper CSV compatibility
        let csv = `pocName${separator}parentSchemaType${separator}schemaType${separator}contentType${separator}chunkerType${separator}chunkIndex${separator}assessmentMethod${separator}qualityScore${separator}qualityDescription${separator}tokens${separator}assessmentDate\r\n`;
        
        // Add individual assessment records with all strings quoted and escaped
        assessments.forEach(assessment => {
            const assessmentDate = assessment.assessmentDate ? new Date(assessment.assessmentDate).toISOString().split('T')[0] : 'N/A';
            // Escape quotes in strings by doubling them (CSV standard)
            const escapedPocName = (assessment.pocName || '').replace(/"/g, '""');
            const escapedParentSchemaType = (assessment.parentSchemaType || 'N/A').replace(/"/g, '""');
            const escapedSchemaType = (assessment.schemaType || 'N/A').replace(/"/g, '""');
            const escapedContentType = (assessment.contentType || 'N/A').replace(/"/g, '""');
            const escapedChunkerType = (assessment.chunkerType || 'N/A').replace(/"/g, '""');
            const escapedAssessmentMethod = (assessment.assessmentMethod || '').replace(/"/g, '""');
            const escapedQualityDescription = (assessment.qualityDescription || '').replace(/"/g, '""');
            
            csv += `"${escapedPocName}"${separator}"${escapedParentSchemaType}"${separator}"${escapedSchemaType}"${separator}"${escapedContentType}"${separator}"${escapedChunkerType}"${separator}${assessment.chunkIndex || 0}${separator}"${escapedAssessmentMethod}"${separator}${assessment.qualityScore}${separator}"${escapedQualityDescription}"${separator}${assessment.tokens || 0}${separator}"${assessmentDate}"\r\n`;
        });
        
        // Add summary section with proper line endings
        csv += `\r\n--- SUMMARY ---\r\n`;
        csv += `"Metric"${separator}"Value"\r\n`;
        csv += `"Total POCs"${separator}${summary.totalPocs}\r\n`;
        csv += `"Total Assessments"${separator}${summary.totalAssessments}\r\n`;
        csv += `"Export Date"${separator}"${summary.exportDate.split('T')[0]}"\r\n`;
        
        return csv;
    }

    async exportAssessmentResults() {
        if (!this.assessmentResults) return;

        try {
            // Prompt for CSV separator (consistent with exportQualityReports)
            const separator = prompt('Enter CSV separator (default is ";" for Mac/Excel):', ';');
            if (separator === null) {
                // User cancelled
                return;
            }
            const csvSeparator = separator.trim() || ';';
            
            const csvContent = await this.generateAssessmentCSV(csvSeparator);
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            
            // Generate filename with correct format
            const dateStr = new Date().toISOString().split('T')[0];
            const pocCount = this.assessmentResults.totalPocs;
            
            let filename;
            if (pocCount === 1 && this.assessmentResults.pocResults.length > 0) {
                // Single POC - include the POC ID
                const pocId = this.assessmentResults.pocResults[0].pocId;
                filename = `quality_report_poc_${pocId}_${dateStr}.csv`;
            } else {
                // Multiple POCs
                filename = `quality_report_${dateStr}.csv`;
            }
            a.download = filename;
            
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error exporting assessment results:', error);
            alert('Error generating export file. Please try again.');
        }
    }

    async generateAssessmentCSV(separator = ';') {
        const results = this.assessmentResults;
        
        // Header matching generateQualityReportsCSV - using \r\n for proper CSV compatibility
        let csv = `pocName${separator}parentSchemaType${separator}schemaType${separator}contentType${separator}chunkerType${separator}chunkIndex${separator}assessmentMethod${separator}qualityScore${separator}qualityDescription${separator}tokens${separator}assessmentDate\r\n`;
        
        // Always fetch detailed chunk-level data from the database for both AI and basic heuristics
        // Get the POC IDs from the results
        const pocIds = results.pocResults.map(poc => poc.pocId);
        
        try {
            // Fetch only the current assessment data from the database (recent assessments)
            const currentTime = new Date();
            const fiveMinutesAgo = new Date(currentTime.getTime() - 5 * 60 * 1000); // 5 minutes ago
            
            const response = await fetch('/api/export-quality-reports', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    pocIds: pocIds,
                    filterByMethod: results.assessmentMethod,
                    filterByChunker: results.chunkerType,
                    filterByTimeRange: {
                        startTime: fiveMinutesAgo.toISOString(),
                        endTime: currentTime.toISOString()
                    }
                })
            });
            
            if (response.ok) {
                const dbResult = await response.json();
                if (dbResult.success && dbResult.data.length > 0) {
                    // Use the database data - with proper escaping
                    dbResult.data.forEach(assessment => {
                        const assessmentDate = assessment.assessmentDate ? new Date(assessment.assessmentDate).toISOString().split('T')[0] : 'N/A';
                        const escapedPocName = (assessment.pocName || '').replace(/"/g, '""');
                        const escapedParentSchemaType = (assessment.parentSchemaType || 'N/A').replace(/"/g, '""');
                        const escapedSchemaType = (assessment.schemaType || 'N/A').replace(/"/g, '""');
                        const escapedContentType = (assessment.contentType || 'N/A').replace(/"/g, '""');
                        const escapedChunkerType = (assessment.chunkerType || 'N/A').replace(/"/g, '""');
                        const escapedAssessmentMethod = (assessment.assessmentMethod || '').replace(/"/g, '""');
                        const escapedQualityDescription = (assessment.qualityDescription || '').replace(/"/g, '""');
                        
                        csv += `"${escapedPocName}"${separator}"${escapedParentSchemaType}"${separator}"${escapedSchemaType}"${separator}"${escapedContentType}"${separator}"${escapedChunkerType}"${separator}${assessment.chunkIndex || 0}${separator}"${escapedAssessmentMethod}"${separator}${assessment.qualityScore}${separator}"${escapedQualityDescription}"${separator}${assessment.tokens || 0}${separator}"${assessmentDate}"\r\n`;
                    });
                    
                    // Add summary section with proper line endings
                    csv += `\r\n--- SUMMARY ---\r\n`;
                    csv += `"Metric"${separator}"Value"\r\n`;
                    csv += `"Total POCs"${separator}${dbResult.summary.totalPocs}\r\n`;
                    csv += `"Total Assessments"${separator}${dbResult.summary.totalAssessments}\r\n`;
                    csv += `"Export Date"${separator}"${new Date().toISOString().split('T')[0]}"\r\n`;
                    
                    return csv;
                }
            }
        } catch (error) {
            console.error('Failed to fetch detailed assessment data:', error);
            // Fall through to use in-memory data as fallback
        }
        
        // Use in-memory data for basic heuristic assessments or as fallback
        const currentDate = new Date().toISOString().split('T')[0];
        results.pocResults.forEach(pocResult => {
            if (pocResult.chunks && pocResult.chunks.length > 0) {
                pocResult.chunks.forEach((chunk, fallbackIndex) => {
                    const chunkIndex = chunk.index !== undefined ? chunk.index : fallbackIndex;
                    const chunkerType = chunk.chunkerType || results.chunkerType || 'Unknown';
                    const assessmentMethod = chunk.assessmentMethod || results.assessmentMethod || 'basic-heuristics';
                    const qualityDescription = chunk.qualityDescription || this.getQualityLevel(chunk.quality);
                    const tokens = chunk.tokens || 0;
                    
                    // Escape quotes in strings by doubling them (CSV standard)
                    const escapedPocName = (pocResult.pocName || '').replace(/"/g, '""');
                    const escapedParentSchemaType = (pocResult.parentSchemaType || 'N/A').replace(/"/g, '""');
                    const escapedSchemaType = (pocResult.schemaType || 'N/A').replace(/"/g, '""');
                    const escapedContentType = (pocResult.contentType || 'N/A').replace(/"/g, '""');
                    const escapedChunkerType = chunkerType.replace(/"/g, '""');
                    const escapedAssessmentMethod = assessmentMethod.replace(/"/g, '""');
                    const escapedQualityDescription = qualityDescription.replace(/"/g, '""');
                    
                    csv += `"${escapedPocName}"${separator}"${escapedParentSchemaType}"${separator}"${escapedSchemaType}"${separator}"${escapedContentType}"${separator}"${escapedChunkerType}"${separator}${chunkIndex}${separator}"${escapedAssessmentMethod}"${separator}${chunk.quality.toFixed(3)}${separator}"${escapedQualityDescription}"${separator}${tokens}${separator}"${currentDate}"\r\n`;
                });
            } else {
                // Fallback for POCs without detailed chunk data
                const chunkerType = results.chunkerType || 'Unknown';
                const assessmentMethod = results.assessmentMethod || 'basic-heuristics';
                const qualityDescription = this.getQualityLevel(pocResult.averageQuality);
                
                const escapedPocName = (pocResult.pocName || '').replace(/"/g, '""');
                const escapedParentSchemaType = (pocResult.parentSchemaType || 'N/A').replace(/"/g, '""');
                const escapedSchemaType = (pocResult.schemaType || 'N/A').replace(/"/g, '""');
                const escapedContentType = (pocResult.contentType || 'N/A').replace(/"/g, '""');
                const escapedChunkerType = chunkerType.replace(/"/g, '""');
                const escapedAssessmentMethod = assessmentMethod.replace(/"/g, '""');
                const escapedQualityDescription = qualityDescription.replace(/"/g, '""');
                
                csv += `"${escapedPocName}"${separator}"${escapedParentSchemaType}"${separator}"${escapedSchemaType}"${separator}"${escapedContentType}"${separator}"${escapedChunkerType}"${separator}0${separator}"${escapedAssessmentMethod}"${separator}${pocResult.averageQuality.toFixed(3)}${separator}"${escapedQualityDescription}"${separator}0${separator}"${currentDate}"\r\n`;
            }
        });
        
        // Add summary section with proper line endings
        csv += `\r\n--- SUMMARY ---\r\n`;
        csv += `"Metric"${separator}"Value"\r\n`;
        csv += `"Total POCs"${separator}${results.totalPocs}\r\n`;
        csv += `"Total Assessments"${separator}${results.totalChunks}\r\n`;
        csv += `"Export Date"${separator}"${new Date().toISOString().split('T')[0]}"\r\n`;
        
        return csv;
    }

    closeChunkModal() {
        document.getElementById('chunkModal').style.display = 'none';
    }

    // Method to open create chunks modal
    async openCreateChunksModal(pocId) {
        console.log('openCreateChunksModal called');
        let selectedPocIds;
        if (pocId) {
            selectedPocIds = [pocId];
        } else {
            selectedPocIds = this.getSelectedPocIds();
        }
        this.chunkCreationPocIds = selectedPocIds;
        console.log('Selected POC IDs:', selectedPocIds.length);
        if (selectedPocIds.length === 0) {
            alert('Please select at least one POC to create chunks.');
            return;
        }

        console.log('Proceeding with chunk creation setup modal...');

        // Show setup modal
        const setupModal = document.getElementById('chunkCreationSetupModal');
        const chunkerGrid = document.getElementById('chunkCreationChunkerGrid');
        const pocsCount = document.getElementById('chunkCreationSelectedPocsCount');
        const pocSummary = document.getElementById('pocContentTypeSummary');
        
        if (!setupModal || !chunkerGrid || !pocsCount || !pocSummary) {
            console.error('Required chunk creation modal elements not found!');
            alert('Error: Modal elements not found!');
            return;
        }
        
        // Clear any previous state
        this.selectedChunkerForCreation = null;
        
        // Update selected POCs count
        pocsCount.textContent = selectedPocIds.length;
        
        try {
            // Get selected POCs data to show content type summary
            const response = await fetch('/api/pocs/bulk', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ ids: selectedPocIds })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.message || 'Failed to fetch POC data');
            }

            // Show content type summary
            this.populatePocContentTypeSummary(data.data);
            
            // Load available chunkers for chunk creation
            this.populateChunkCreationChunkerGrid();
            
            // Show the modal
            setupModal.style.display = 'block';
            
        } catch (error) {
            console.error('Error in openCreateChunksModal:', error);
            alert('Error: ' + error.message);
        }
    }

    populatePocContentTypeSummary(pocs) {
        const pocSummary = document.getElementById('pocContentTypeSummary');
        
        // Group POCs by content type
        const contentTypeGroups = {};
        pocs.forEach(poc => {
            const contentType = poc.contentType || 'UNKNOWN';
            if (!contentTypeGroups[contentType]) {
                contentTypeGroups[contentType] = [];
            }
            contentTypeGroups[contentType].push(poc);
        });

        // Create summary HTML
        const summaryHtml = Object.entries(contentTypeGroups).map(([contentType, pocsInType]) => {
            const supportedNote = contentType === 'READ' 
                ? '<span class="supported-indicator">✓ Supported by READ chunkers</span>'
                : '<span class="unsupported-indicator">⚠ Not supported by READ chunkers</span>';
                
            return `
                <div class="content-type-group">
                    <div class="content-type-header">
                        <strong>${contentType}</strong>: ${pocsInType.length} POCs
                        ${supportedNote}
                    </div>
                    <div class="content-type-details">
                        ${pocsInType.slice(0, 3).map(poc => `<span class="poc-preview">${poc.title || poc.pocId}</span>`).join(', ')}
                        ${pocsInType.length > 3 ? `<span class="more-indicator">... and ${pocsInType.length - 3} more</span>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        pocSummary.innerHTML = summaryHtml;
    }

    populateChunkCreationChunkerGrid() {
        const chunkerGrid = document.getElementById('chunkCreationChunkerGrid');
        
        // Define inactive chunkers that should not be displayed
        // Available chunkers for chunk creation
        const availableChunkers = [
            {
                type: 'READ-CONTENT-PARA',
                name: 'READ-CONTENT-PARA',
                description: 'One paragraph per chunk - each paragraph becomes its own semantic unit, max 2048 tokens',
                supportedContentTypes: ['READ'],
                maxTokens: 2048,
                isSemanticAware: true,
                isActive: true
            },
            {
                type: 'READ-CONTENT-PARA-LLM',
                name: 'READ-CONTENT-PARA-LLM',
                description: 'One paragraph per chunk with LLM-generated descriptions for images, tables, and code blocks',
                supportedContentTypes: ['READ'],
                maxTokens: 2048,
                isSemanticAware: true,
                isActive: true
            },
            {
                type: 'READ-CONTENT-SHORT',
                name: 'READ-CONTENT-SHORT',
                description: 'Short paragraph chunks < 512 tokens, sections split if > 1024 tokens, images/tables/code as separate chunks',
                supportedContentTypes: ['READ'],
                maxTokens: 1024,
                isSemanticAware: true,
                isActive: true
            },
            {
                type: 'READ-CONTENT-SHORT-LLM',
                name: 'READ-CONTENT-SHORT-LLM',
                description: 'Short paragraph chunks with LLM-generated descriptions for images, tables, and code blocks',
                supportedContentTypes: ['READ'],
                maxTokens: 1024,
                isSemanticAware: true,
                isActive: true
            }
        ];

        // Filter to only active chunkers
        const activeChunkers = availableChunkers.filter(c => c.isActive);

        const chunkersHtml = activeChunkers.map(chunker => `
            <div class="chunker-option" onclick="semanticChunkerApp.selectChunkerForCreation('${chunker.type}')">
                <div class="chunker-name">${chunker.name}</div>
                <div class="chunker-description">${chunker.description}</div>
                <div class="chunker-details">
                    <div class="chunker-meta">
                        <span class="chunker-tokens">Max: ${chunker.maxTokens} tokens</span>
                        <span class="chunker-semantic">${chunker.isSemanticAware ? '🧠 Semantic Aware' : '📏 Fixed Length'}</span>
                    </div>
                    <div class="supported-content-types">
                        <strong>Supported Content Types:</strong> ${chunker.supportedContentTypes.join(', ')}
                    </div>
                </div>
            </div>
        `).join('');

        chunkerGrid.innerHTML = chunkersHtml;
    }

    selectChunkerForCreation(chunkerType) {
        console.log('Selected chunker for creation:', chunkerType);
        this.selectedChunkerForCreation = chunkerType;
        
        // Update UI to show selection
        document.querySelectorAll('.chunker-option').forEach(option => {
            option.classList.remove('selected');
        });
        
        event.target.closest('.chunker-option').classList.add('selected');
        
        // Enable the start button
        const startButton = document.getElementById('startChunkCreationButton');
        if (startButton) {
            startButton.disabled = false;
        }
    }

    async startChunkCreationDirectly(pocId, chunkerType) {
        console.log('Starting chunk creation directly for POC:', pocId, 'with chunker:', chunkerType);
        
        // Set up the chunker and POC IDs
        this.selectedChunkerForCreation = chunkerType;
        this.chunkCreationPocIds = [pocId];
        this.isSinglePocChunkCreation = true; // Track that this is a single POC creation
        
        // Generate a sessionId for this chunk creation session
        const sessionId = `chunk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.currentChunkSessionId = sessionId;
        
        // Show progress modal directly (skip setup modal)
        document.getElementById('chunkCreationProgressModal').style.display = 'block';
        
        // Set flag to prevent modal closing during processing
        this.isProcessingChunks = true;
        
        // Reset progress modal
        document.getElementById('chunkCreationProgressSection').style.display = 'block';
        document.getElementById('chunkCreationResultsSection').style.display = 'none';
        document.getElementById('chunkCreationProgressBar').style.width = '0%';
        document.getElementById('chunkCreationProgressText').textContent = '0%';
        document.getElementById('currentChunkCreationPocName').textContent = 'Starting...';

        try {
            // Set up SSE for real-time progress updates
            console.log(`[FRONTEND] Creating EventSource for sessionId: ${sessionId}`);
            const eventSource = new EventSource(`/api/assessment-progress/${sessionId}`);
            this.currentChunkEventSource = eventSource;
            console.log(`[FRONTEND] EventSource created, readyState: ${eventSource.readyState}`);

            eventSource.addEventListener('progress', (event) => {
                const progress = JSON.parse(event.data);
                this.updateChunkCreationProgress(progress);
            });

            eventSource.addEventListener('llm-progress', (event) => {
                const progress = JSON.parse(event.data);
                this.updateLLMProgress(progress);
            });

            eventSource.addEventListener('chunk-progress', (event) => {
                const progress = JSON.parse(event.data);
                this.updateChunkProgress(progress);
            });

            eventSource.addEventListener('completed', (event) => {
                const result = JSON.parse(event.data);
                eventSource.close();
                this.currentChunkEventSource = null;
                this.showChunkCreationResults(result);
            });

            eventSource.onerror = () => {
                eventSource.close();
                this.currentChunkEventSource = null;
            };

            // Call the chunk creation API with sessionId
            const response = await fetch('/api/chunk-read-pocs', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'same-origin',
                body: JSON.stringify({ 
                    pocIds: [pocId],
                    chunkerType: chunkerType,
                    sessionId: sessionId
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[Chunk Creation] Error response:', response.status, response.url, errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('[Chunk Creation] Response:', result);

            // Check if this is a background job
            if (result.jobId) {
                // Large batch - poll for progress
                console.log(`[Chunk Creation] Large batch queued with jobId: ${result.jobId}`);
                document.getElementById('currentChunkCreationPocName').textContent = `Processing ${[pocId].length} POCs in background...`;
                await this.pollChunkJobProgress(result.jobId, [pocId].length);
            } else {
                // Small batch - completed immediately
                // Update progress to 100%
                document.getElementById('chunkCreationProgressBar').style.width = '100%';
                document.getElementById('chunkCreationProgressText').textContent = '100%';
                document.getElementById('currentChunkCreationPocName').textContent = 'Complete!';
                
                // Show results after a brief delay
                setTimeout(() => {
                    this.showChunkCreationResults(result);
                }, 1000);
            }

        } catch (error) {
            console.error('Error during chunk creation:', error);
            alert('Error during chunk creation: ' + error.message);
            
            // Close the progress modal on error
            document.getElementById('chunkCreationProgressModal').style.display = 'none';
        }
    }

    async startChunkCreation() {
        if (!this.selectedChunkerForCreation) {
            alert('Please select a chunker first.');
            return;
        }

        const selectedPocIds = this.chunkCreationPocIds || this.getSelectedPocIds();
        this.isSinglePocChunkCreation = false; // This is a batch operation
        console.log('Starting chunk creation for', selectedPocIds.length, 'POCs with chunker:', this.selectedChunkerForCreation);
        console.log('[Chunker Update] selectedPocIds sent to backend:', selectedPocIds);

        // Generate a sessionId for this chunk creation session
        const sessionId = `chunk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.currentChunkSessionId = sessionId;

        // Hide setup modal and show progress modal
        document.getElementById('chunkCreationSetupModal').style.display = 'none';
        document.getElementById('chunkCreationProgressModal').style.display = 'block';
        
        // Set flag to prevent modal closing during processing
        this.isProcessingChunks = true;
        
        // Reset progress modal
        document.getElementById('chunkCreationProgressSection').style.display = 'block';
        document.getElementById('chunkCreationResultsSection').style.display = 'none';
        document.getElementById('chunkCreationProgressBar').style.width = '0%';
        document.getElementById('chunkCreationProgressText').textContent = '0%';
        document.getElementById('currentChunkCreationPocName').textContent = 'Starting...';

        try {
            // Set up SSE for real-time progress updates
            console.log(`[FRONTEND] Creating EventSource for sessionId: ${sessionId}`);
            const eventSource = new EventSource(`/api/assessment-progress/${sessionId}`);
            this.currentChunkEventSource = eventSource;
            console.log(`[FRONTEND] EventSource created, readyState: ${eventSource.readyState}`);

            eventSource.addEventListener('progress', (event) => {
                const progress = JSON.parse(event.data);
                this.updateChunkCreationProgress(progress);
            });

            eventSource.addEventListener('llm-progress', (event) => {
                const progress = JSON.parse(event.data);
                this.updateLLMProgress(progress);
            });

            eventSource.addEventListener('chunk-progress', (event) => {
                const progress = JSON.parse(event.data);
                this.updateChunkProgress(progress);
            });

            eventSource.addEventListener('completed', (event) => {
                const result = JSON.parse(event.data);
                eventSource.close();
                this.currentChunkEventSource = null;
                this.showChunkCreationResults(result);
            });

            eventSource.onerror = () => {
                eventSource.close();
                this.currentChunkEventSource = null;
            };

            // Call the chunk creation API with sessionId
            const response = await fetch('/api/chunk-read-pocs', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'same-origin',
                body: JSON.stringify({ 
                    pocIds: selectedPocIds,
                    chunkerType: this.selectedChunkerForCreation,
                    sessionId: sessionId
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[Chunk Creation] Error response:', response.status, response.url, errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('[Chunk Creation] Response:', result);
            
            // Check if this is a background job
            if (result.jobId) {
                // Large batch - poll for progress
                console.log(`[Chunk Creation] Large batch queued with jobId: ${result.jobId}`);
                document.getElementById('currentChunkCreationPocName').textContent = `Processing ${selectedPocIds.length} POCs in background...`;
                await this.pollChunkJobProgress(result.jobId, selectedPocIds.length);
            } else {
                // Small batch - completed immediately
                // Update progress to 100%
                document.getElementById('chunkCreationProgressBar').style.width = '100%';
                document.getElementById('chunkCreationProgressText').textContent = '100%';
                document.getElementById('currentChunkCreationPocName').textContent = 'Complete!';
                
                // Show results after a brief delay
                setTimeout(() => {
                    this.showChunkCreationResults(result);
                }, 1000);
            }

        } catch (error) {
            console.error('Error during chunk creation:', error);
            alert('Error during chunk creation: ' + error.message);
            
            // Close the progress modal on error
            this.isProcessingChunks = false;
            document.getElementById('chunkCreationProgressModal').style.display = 'none';
        }
    }

    async pollChunkJobProgress(jobId, totalPocs) {
        // Scale timeout based on number of POCs: ~30 seconds per 100 POCs, minimum 30 minutes
        const maxAttempts = Math.max(1800, Math.ceil((totalPocs / 100) * 1800)); // More generous timeout for large batches
        let attempts = 0;
        let lastProcessedCount = 0;
        
        // Hide POC Progress line for background jobs since it doesn't display correctly
        const pocProgressContainer = document.getElementById('pocProgressInfo').parentElement;
        if (pocProgressContainer) {
            pocProgressContainer.style.display = 'none';
        }
        
        return new Promise((resolve, reject) => {
            const pollInterval = setInterval(async () => {
                attempts++;
                
                if (attempts > maxAttempts) {
                    clearInterval(pollInterval);
                    this.isProcessingChunks = false;
                    reject(new Error('Job polling timeout'));
                    return;
                }
                
                try {
                    const response = await fetch(`/api/chunk-job-status/${jobId}`);
                    
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    
                    const result = await response.json();
                    const job = result.job;
                    
                    // Calculate per-POC progress (each POC = 1/totalPocs)
                    // For 500 POCs, each = 0.2%
                    const pocsProcessedSinceLastPoll = (job.processedPocs?.length || 0) + (job.failedPocs?.length || 0);
                    
                    // Update progress UI with granular per-POC increments
                    const progressPercent = Math.min((pocsProcessedSinceLastPoll / job.totalPocs) * 100, 99.9);
                    document.getElementById('chunkCreationProgressBar').style.width = `${progressPercent}%`;
                    document.getElementById('chunkCreationProgressText').textContent = `${Math.round(progressPercent * 10) / 10}%`;
                    
                    // Update POC progress display
                    document.getElementById('pocProgressInfo').textContent = `${pocsProcessedSinceLastPoll} of ${job.totalPocs} POCs`;
                    document.getElementById('currentChunkCreationPocName').textContent = 
                        `Processing... (${pocsProcessedSinceLastPoll}/${job.totalPocs} POCs completed)`;
                    
                    console.log(`[Chunk Job] Status: ${job.status}, Processed: ${pocsProcessedSinceLastPoll}/${job.totalPocs}, Progress: ${progressPercent.toFixed(1)}%`);
                    
                    // Check if job is completed or failed
                    if (job.status === 'completed' || job.status === 'failed') {
                        clearInterval(pollInterval);
                        this.isProcessingChunks = false;
                        
                        document.getElementById('chunkCreationProgressBar').style.width = '100%';
                        document.getElementById('chunkCreationProgressText').textContent = '100%';
                        document.getElementById('currentChunkCreationPocName').textContent = 'Complete!';
                        
                        // Show results after a brief delay
                        setTimeout(() => {
                            this.showChunkCreationResults({
                                success: job.status === 'completed',
                                message: job.status === 'completed' ? 
                                    `Processed ${job.successfulCount} POCs successfully` : 
                                    `Job failed: ${job.successfulCount} succeeded, ${job.failedCount} failed`,
                                chunkerType: job.chunkerType,
                                results: {
                                    successful: job.successfulCount,
                                    failed: job.failedCount,
                                    totalChunks: 0
                                },
                                costs: {
                                    totalCost: job.totalCost || 0,
                                    details: job.costDetails || []
                                }
                            });
                        }, 1000);
                        
                        resolve();
                    }
                } catch (error) {
                    console.error('[Chunk Job] Error polling status:', error);
                    clearInterval(pollInterval);
                    this.isProcessingChunks = false;
                    reject(error);
                }
            }, 1000); // Poll every 1 second
        });
    }

    updateChunkCreationProgress(progress) {
        // Update POC-level progress
        const percentage = progress.overallProgress !== undefined 
            ? Math.round(progress.overallProgress * 100)
            : (progress.processedPocs / progress.totalPocs) * 100;
        
        document.getElementById('chunkCreationProgressBar').style.width = percentage + '%';
        document.getElementById('chunkCreationProgressText').textContent = Math.round(percentage) + '%';
        
        // Display POC/overall progress
        // For background jobs with large batches, show overall progress
        // For single/small batches, show per-POC progress
        const pocProgressEl = document.getElementById('pocProgressInfo');
        
        if (progress.totalPocs > 50) {
            // Background job - show overall progress
            const completed = progress.processedPocs || 0;
            pocProgressEl.textContent = `${completed} of ${progress.totalPocs} POCs`;
        } else {
            // Regular small batch - try to extract per-POC progress from message
            const pocMatch = progress.message?.match(/Processing POC (\d+) of (\d+)/);
            if (pocMatch) {
                const currentPoc = pocMatch[1];
                const totalPocs = pocMatch[2];
                pocProgressEl.textContent = `${currentPoc} of ${totalPocs}`;
            } else if (progress.totalPocs && progress.totalPocs > 0) {
                // Fallback: use processedPocs + 1
                const pocNum = progress.processedPocs + 1;
                pocProgressEl.textContent = `${pocNum} of ${progress.totalPocs}`;
            }
        }
        
        // Use message if available (includes POC count), otherwise fall back to title
        if (progress.message) {
            document.getElementById('currentChunkCreationPocName').textContent = progress.message;
        } else if (progress.currentPocTitle) {
            document.getElementById('currentChunkCreationPocName').textContent = progress.currentPocTitle;
        }
    }

    updateLLMProgress(progress) {
        // Update LLM processing progress
        if (progress.progress !== undefined) {
            const llmPercentage = Math.round(progress.progress * 100);
            // Update the progress bar and percentage text
            const progressBar = document.getElementById('chunkCreationProgressBar');
            const progressText = document.getElementById('chunkCreationProgressText');
            
            if (progressBar && progressText) {
                progressBar.style.width = llmPercentage + '%';
                progressText.textContent = llmPercentage + '%';
            }
            
            // Update current POC name to show LLM processing
            const pocNameElement = document.getElementById('currentChunkCreationPocName');
            if (pocNameElement) {
                pocNameElement.textContent = progress.message || `Processing LLM (${progress.current}/${progress.total})`;
            }
            
            console.log(`[LLM Progress] ${progress.current}/${progress.total} - ${llmPercentage}%`);
        }
    }

    updateChunkProgress(progress) {
        // Update chunk-level progress within a POC
        if (progress.progress !== undefined) {
            const chunkPercentage = Math.round(progress.progress * 100);
            // Update the progress bar and percentage text
            const progressBar = document.getElementById('chunkCreationProgressBar');
            const progressText = document.getElementById('chunkCreationProgressText');
            
            if (progressBar && progressText) {
                progressBar.style.width = chunkPercentage + '%';
                progressText.textContent = chunkPercentage + '%';
            }
            
            // Update current POC name to show which chunk we're on
            const pocNameElement = document.getElementById('currentChunkCreationPocName');
            if (pocNameElement) {
                pocNameElement.textContent = `${progress.message || `Chunk ${progress.chunkNumber}/${progress.totalChunks}`}`;
            }
            
            console.log(`[Chunk Progress] ${progress.chunkNumber}/${progress.totalChunks} - ${chunkPercentage}%`);
        }
    }

    showChunkCreationResults(result) {
        console.log('Chunk creation results:', result);
        console.log('Result costs field:', result.costs);
        console.log('Result costs totalCost:', result.costs?.totalCost);
        
        // Hide progress section and show results
        document.getElementById('chunkCreationProgressSection').style.display = 'none';
        document.getElementById('chunkCreationResultsSection').style.display = 'block';
        
        // Determine if this is from a background job (results are counts) or synchronous (results are arrays)
        const isBackgroundJob = typeof result.results?.successful === 'number';
        
        // Update the close button
        const closeButton = document.getElementById('closeChunkCreationResultsButton');
        closeButton.textContent = 'Close';
        
        // Update summary statistics - handle both formats
        if (isBackgroundJob) {
            // Background job: results.successful and results.failed are counts
            document.getElementById('totalPocsProcessed').textContent = result.results?.successful + result.results?.failed || 0;
            document.getElementById('totalChunksCreated').textContent = '—'; // Unknown for batch
            document.getElementById('successfulPocs').textContent = result.results?.successful || 0;
            document.getElementById('failedPocs').textContent = result.results?.failed || 0;
            this.lastChunkedPocIds = []; // For background jobs, don't update individual buttons
        } else {
            // Synchronous job: results.successful and results.failed are arrays
            document.getElementById('totalPocsProcessed').textContent = result.readPocsProcessed || 0;
            document.getElementById('totalChunksCreated').textContent = result.results?.totalChunks || 0;
            document.getElementById('successfulPocs').textContent = result.results?.successful?.length || 0;
            document.getElementById('failedPocs').textContent = result.results?.failed?.length || 0;
            // Store successful POC IDs for button updates
            this.lastChunkedPocIds = (result.results?.successful || []).map(r => r.pocId);
        }
        
        // Display the chunker type that was used
        document.getElementById('chunkerTypeUsedForCreation').textContent = result.chunkerType || '—';
        
        // Display cost information (for LLM chunkers)
        const costContainer = document.getElementById('costDisplayContainer');
        const costDisplay = document.getElementById('chunkCreationCostDisplay');
        if (costContainer && costDisplay) {
            if (result.costs && result.costs.totalCost > 0) {
                costDisplay.textContent = `$${result.costs.totalCost.toFixed(6)}`;
                costContainer.style.display = 'block';
            } else {
                costContainer.style.display = 'none';
            }
        }
        
        // Populate detailed results table - only for synchronous jobs with detailed data
        const resultsBody = document.getElementById('chunkCreationResultsBody');
        if (isBackgroundJob) {
            // Background job: show summary message instead of table
            resultsBody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; padding: 20px; color: #666;">
                        Batch processing completed successfully. 
                        ${result.results?.failed > 0 ? `${result.results?.failed} POCs failed.` : 'All POCs processed.'}
                    </td>
                </tr>
            `;
        } else {
            // Synchronous job: show detailed results
            const allResults = [
                ...(result.results?.successful || []).map(r => ({ ...r, status: 'Success' })),
                ...(result.results?.failed || []).map(r => ({ ...r, status: 'Failed' }))
            ];
            const resultsHtml = allResults.map(pocResult => `
                <tr>
                    <td>${pocResult.pocId}</td>
                    <td>READ</td>
                    <td>${pocResult.chunkCount || 0}</td>
                    <td class="${pocResult.status.toLowerCase()}">${pocResult.status}${pocResult.error ? ': ' + pocResult.error : ''}</td>
                </tr>
            `).join('');
            resultsBody.innerHTML = resultsHtml;
        }

        this.lastChunkedChunkerType = result.chunkerType || 'READ-CONTENT-PARA';
        console.log('[Chunker Update] lastChunkedPocIds set to:', this.lastChunkedPocIds);
        console.log('[Chunker Update] lastChunkedChunkerType set to:', this.lastChunkedChunkerType);
    }

    // Build query parameters for API calls
    buildQueryParams() {
        const queryParams = new URLSearchParams({
            page: this.currentPage.toString(),
            limit: '20'
        });

        if (this.currentSearch && this.currentSearch.trim()) {
            queryParams.append('search', this.currentSearch.trim());
        }
        
        // Add content type filter parameters
        // Only add contentTypes filter if not all content types are selected
        if (this.filterState.contentTypes.size > 0 && 
            this.filterState.contentTypes.size < this.filterState.allContentTypes.size) {
            const selectedContentTypes = Array.from(this.filterState.contentTypes);
            queryParams.append('contentTypes', selectedContentTypes.join(','));
        }

        return queryParams;
    }

    // Refresh POC data while preserving selections and filters
    async refreshPocData(savedScrollPosition) {
        try {
            // Save current state - INCLUDING filters!
            const currentFilters = {
                contentType: this.contentTypeFilter,
                searchQuery: this.currentSearch,
                currentPage: this.currentPage
            };
            const currentContentTypeFilters = new Set(this.filterState.contentTypes); // PRESERVE filter state
            const currentSelections = new Set(this.selectedPocs);
            
            // Use provided scroll position or get current one from content-area
            const contentArea = document.querySelector('.content-area');
            const scrollPosition = savedScrollPosition !== undefined ? savedScrollPosition : (contentArea ? contentArea.scrollTop : 0);
            console.log('[Scroll] Using content-area scroll position:', scrollPosition);
            
            // Reload POC data with current filters
            const response = await fetch(`/api/pocs?${this.buildQueryParams()}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            // Update POC data
            this.pocs = result.data || [];
            this.allPocs = result.data || []; // Keep both in sync
            this.totalPages = result.totalPages || 1;
            
            // Restore selections (only for POCs that still exist)
            this.selectedPocs.clear();
            currentSelections.forEach(pocId => {
                if (this.pocs.some(poc => poc._id === pocId)) {
                    this.selectedPocs.add(pocId);
                }
            });
            
            // Restore filters - EXPLICITLY restore content type filters
            this.filterState.contentTypes = currentContentTypeFilters;
            
            // Restore search input field
            const searchInput = document.getElementById('searchInput');
            if (searchInput && this.currentSearch) {
                searchInput.value = this.currentSearch;
            }
            
            // Restore filter button states
            this.restoreFilterButtonStates();
            
            // Re-render the POC list with updated data and restored selections
            this.renderPocs(this.pocs);
            
            // Restore content-area scroll position immediately and after DOM updates
            const contentAreaElement = document.querySelector('.content-area');
            if (contentAreaElement) {
                contentAreaElement.scrollTop = scrollPosition;
                console.log('[Scroll] Immediate restore of content-area scroll position:', scrollPosition);
                
                // Also restore after animation frames to ensure it sticks
                requestAnimationFrame(() => {
                    contentAreaElement.scrollTop = scrollPosition;
                    console.log('[Scroll] First RAF restore:', scrollPosition);
                    requestAnimationFrame(() => {
                        contentAreaElement.scrollTop = scrollPosition;
                        console.log('[Scroll] Second RAF restore:', scrollPosition);
                        // Final check after a short delay
                        setTimeout(() => {
                            contentAreaElement.scrollTop = scrollPosition;
                            console.log('[Scroll] Final restore after 100ms:', scrollPosition, 'current:', contentAreaElement.scrollTop);
                        }, 100);
                    });
                });
            }
            
        } catch (error) {
            console.error('Error refreshing POC data:', error);
            // Fallback to full reload if refresh fails
            this.loadPocs();
        }
    }

    // Restore visual state of filter buttons after refresh
    restoreFilterButtonStates() {
        // Restore content type filter buttons
        this.filterState.allContentTypes.forEach(contentType => {
            const button = document.querySelector(`[data-content-type="${contentType}"]`);
            if (button) {
                button.classList.toggle('active', this.filterState.contentTypes.has(contentType));
            }
        });
    }

    closeChunkCreationSetupModal() {
        document.getElementById('chunkCreationSetupModal').style.display = 'none';
        this.selectedChunkerForCreation = null;
    }

    async handleChunkCreationClose() {
        // Check if this was a single POC creation and if it was successful
        if (this.isSinglePocChunkCreation && this.lastChunkedPocIds && this.lastChunkedPocIds.length === 1) {
            const pocId = this.lastChunkedPocIds[0];
            const chunkerType = this.lastChunkedChunkerType;
            
            console.log('Opening chunks modal for single POC:', pocId, 'with chunker:', chunkerType);
            
            // Close the chunk creation modal first
            await this.closeChunkCreationProgressModal();
            
            // Open the chunks modal
            await this.openChunkerModal(pocId, chunkerType);
        } else {
            // For batch operations, just close the modal
            await this.closeChunkCreationProgressModal();
        }
    }

    async closeChunkCreationProgressModal() {
        console.log('[Chunker Update] closeChunkCreationProgressModal called', this.lastChunkedPocIds);
        
        // Clear the processing flag to allow modal to be closed next time
        this.isProcessingChunks = false;
        
        document.getElementById('chunkCreationProgressModal').style.display = 'none';
        
        // Update buttons in DOM without refreshing the entire page
        // This works for both single POC and batch mode
        if (this.lastChunkedPocIds && Array.isArray(this.lastChunkedPocIds) && this.lastChunkedPocIds.length > 0) {
            const chunkerType = this.lastChunkedChunkerType || 'READ-CONTENT-PARA';
            console.log('[Chunker Update] Updating buttons for', this.lastChunkedPocIds.length, 'successful chunks:', this.lastChunkedPocIds);
            console.log('[Chunker Update] Using chunker type:', chunkerType);
            
            // Update each POC's button directly in the DOM
            this.lastChunkedPocIds.forEach(pocId => {
                // 1. Update chunker availability buttons
                const selector = `button[data-chunker="${chunkerType}"][data-poc-id="${pocId}"]`;
                const buttons = document.querySelectorAll(selector);
                
                buttons.forEach(btn => {
                    btn.textContent = `✓ ${chunkerType} - Chunks available`;
                    btn.classList.remove('can-process');
                    btn.classList.add('has-chunks');
                    btn.setAttribute('data-status-class', 'has-chunks');
                });
                
                if (buttons.length > 0) {
                    console.log('[Chunker Update] Updated', buttons.length, 'button(s) for POC:', pocId, 'with chunker:', chunkerType);
                } else {
                    console.warn('[Chunker Update] No button found for POC:', pocId, 'with selector:', selector);
                }

                // 2. Add assessment button for the new chunker in "Completed Assessments" section
                this.addAssessmentButtonForChunker(pocId, chunkerType);
            });
        }
        
        this.lastChunkedPocIds = null;
        this.lastChunkedChunkerType = null;
        this.chunkCreationPocIds = null;
    }

    addAssessmentButtonForChunker(pocId, chunkerType) {
        // Find the POC element and its assessments list
        const pocElement = document.getElementById(`poc-${pocId}`);
        if (!pocElement) {
            console.warn('[Assessment Button] POC element not found for:', pocId);
            return;
        }

        // Find the assessments list within this POC
        const assessmentsList = pocElement.querySelector('.assessments-list');
        if (!assessmentsList) {
            console.warn('[Assessment Button] Assessments list not found for POC:', pocId);
            return;
        }

        // Check if button for this chunker already exists
        const existingButton = assessmentsList.querySelector(`button[data-chunker="${chunkerType}"]`);
        if (existingButton) {
            console.log('[Assessment Button] Button already exists for', chunkerType, 'in POC:', pocId);
            return;
        }

        // Create the new assessment button for the chunker without assessments
        const newButton = document.createElement('button');
        newButton.className = 'assessment-indicator score-unknown';
        newButton.setAttribute('data-chunker', chunkerType);
        newButton.setAttribute('data-quality', 'UNKNOWN');
        newButton.setAttribute('onclick', `window.semanticChunkerApp.handleAssessmentIndicatorClick('${pocId}', '${chunkerType}', 'UNKNOWN', 'basic-heuristics')`);
        newButton.innerHTML = `chunker: ${chunkerType} quality: UNKNOWN`;

        // Append to assessments list
        assessmentsList.appendChild(newButton);
        console.log('[Assessment Button] Added new assessment button for', chunkerType, 'in POC:', pocId);
    }

    cancelChunkCreation() {
        // For now, just close the modal
        // In the future, this could cancel ongoing chunk creation operations
        console.log('Chunk creation cancelled');
        this.closeChunkCreationProgressModal();
    }

    // Method to open chunker view modal (for has-chunks and has-assessments)
    async openChunkerViewModal(pocId, chunkerType) {
        // Open the new dedicated chunker modal (not the assessment modal)
        await this.openChunkerModal(pocId, chunkerType);
    }

    async openChunkerModal(pocId, chunkerType) {
        // Show modal and loading state
        const modal = document.getElementById('chunkerModal');
        const modalTitle = document.getElementById('chunkerModalTitle');
        const pocMetadataHeader = document.getElementById('chunkerPocMetadataHeader');
        const detailsContent = document.getElementById('chunkerDetailsContent');
        const chunksContent = document.getElementById('chunkerChunksContent');
        const chunksTitle = document.getElementById('chunkerChunksTitle');

        modal.style.display = 'flex';
        modalTitle.textContent = `Chunks View - ${chunkerType}`;
        pocMetadataHeader.style.display = 'none';
        detailsContent.innerHTML = '<div class="loading-spinner">Loading article content...</div>';
        chunksContent.innerHTML = '<div class="loading-spinner">Loading chunks...</div>';
        chunksTitle.textContent = `${chunkerType} Chunks`;
        
        // Store current state for this modal
        this.currentModalPocId = pocId;
        this.currentModalChunkerType = chunkerType;
        this.currentModalChunks = [];

        try {
            // Fetch POC and chunks data (without assessment method since this is chunker view)
            const response = await fetch(`/api/pocs/${pocId}/chunks/${chunkerType}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('Chunker modal API result:', result);

            if (result.success) {
                const { poc, chunks } = result.data;
                console.log('Chunks data:', chunks);
                console.log('Chunks length:', chunks ? chunks.length : 'undefined');
                if (chunks && chunks.length > 0) {
                    console.log('First chunk fields:', Object.keys(chunks[0]));
                    console.log('First chunk _id:', chunks[0]._id);
                    console.log('First chunk full object:', chunks[0]);
                }
                
                // Store chunks for later reference
                this.currentModalChunks = chunks || [];
                
                // Update modal title with POC info
                modalTitle.textContent = `Chunks View - ${chunkerType} (${chunks.length} chunks)`;
                
                // Load article content for READ POCs
                if (poc.contentType === 'READ') {
                    await this.populateDetailsSection(pocId, chunks, false);
                } else {
                    detailsContent.innerHTML = '<div style="color: #666; font-style: italic;">Article view only available for READ content</div>';
                }
                
                // Show chunks in the right panel (same format as chunk modal)
                if (chunks && chunks.length > 0) {
                    const chunksHtml = chunks.map((chunk, index) => {
                        // Handle different data structures based on collection (same logic as chunk modal)
                        let chunkNumber, chunkText, chunkType;
                        
                        if (chunkerType === 'DEFAULT-1024T') {
                            // From pocEmbeddings collection
                            chunkNumber = chunk.index !== undefined ? chunk.index : (chunk.total || index + 1);
                            chunkText = chunk.text || chunk.abstract || chunk.summaryEn || chunk.title || 'No content';
                            chunkType = 'section';
                        } else {
                            // From chunkAuditChunks collection - chunkOrder is 1-indexed, display as 0-indexed
                            chunkNumber = chunk.chunkOrder !== undefined ? (chunk.chunkOrder - 1) : index;
                            chunkText = chunk.chunkContent || chunk.text || 'No content';
                            chunkType = chunk.chunkType || 'section';
                        }
                        
                        // Build metadata display
                        const metadataHtml = this.buildChunkMetadataHtml(chunk, chunkType);
                        const chunkId = chunk._id || 'N/A';
                        
                        return `
                            <div class="chunk-item-detail" data-chunk-index="${index}" data-chunk-text="${this.escapeHtml(chunkText).replace(/"/g, '&quot;')}">
                                <div class="chunk-header">
                                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px;">
                                        <span>Chunk ${chunkNumber} (${index + 1} of ${chunks.length})</span>
                                        <span class="chunk-id-display"><strong>ID:</strong> ${chunkId}</span>
                                    </div>
                                    ${metadataHtml}
                                </div>
                                <div class="chunk-text">${this.escapeHtml(chunkText)}</div>
                            </div>
                        `;
                    }).join('');
                    
                    // Add expand/collapse all button
                    const toggleAllBtn = document.getElementById('toggleAllChunkerChunks');
                    if (toggleAllBtn) {
                        toggleAllBtn.style.display = 'block';
                        const arrow = toggleAllBtn.querySelector('.filter-arrow');
                        arrow.textContent = '▼';
                        toggleAllBtn.onclick = () => this.toggleAllChunkerChunks();
                    }
                    
                    chunksContent.innerHTML = chunksHtml;
                    
                    // Add click listeners to chunks for highlighting
                    setTimeout(() => {
                        document.querySelectorAll('.chunk-item-detail').forEach((chunkEl, index) => {
                            chunkEl.addEventListener('click', () => {
                                this.selectChunkInModal(index);
                            });
                        });
                    }, 100);
                } else {
                    chunksContent.innerHTML = '<div class="no-data">No chunks found for this chunker.</div>';
                }
            } else {
                throw new Error(result.error || 'Failed to load chunker data');
            }
        } catch (error) {
            console.error('Error loading chunker data:', error);
            chunksContent.innerHTML = `<div class="error-message">Error loading chunks: ${error.message}</div>`;
            detailsContent.innerHTML = `<div class="error-message">Error loading article content</div>`;
            modalTitle.textContent = `Chunks View - ${chunkerType} (Error)`;
        }
    }
    
    async loadArticleContent(pocId, chunks, isAssessmentModal = false) {
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
                    console.log(`Processing ${images.length} images for article display`);
                    
                    // Images array contains full S3 URLs
                    // Extract filename from URL and create a map
                    const imageMap = {};
                    images.forEach(imageUrl => {
                        // Extract filename from URL (last part after /)
                        const filename = imageUrl.split('/').pop();
                        imageMap[filename] = imageUrl;
                    });
                    
                    console.log('Image map:', imageMap);
                    
                    // Replace image src attributes in the HTML
                    // Look for img tags with src pointing to filenames we have
                    Object.keys(imageMap).forEach(filename => {
                        const regex = new RegExp(`src=["']([^"']*${filename}[^"']*)["']`, 'g');
                        processedHtml = processedHtml.replace(regex, `src="${imageMap[filename]}"`);
                    });
                }
                
                // Create article viewer with the HTML content and proper CSS
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
                
                // Mark chunk boundaries in the article content
                if (isAssessmentModal) {
                    this.markAssessmentChunkBoundaries(processedHtml, chunks);
                } else {
                    this.markChunkBoundaries(processedHtml, chunks);
                }
            } else {
                throw new Error(result.error || 'Failed to load article content');
            }
        } catch (error) {
            console.error('Error loading article content:', error);
            detailsContent.innerHTML = '<div style="color: #999; padding: 20px;">Article content not available</div>';
        }
    }
    
    markChunkBoundaries(htmlContent, chunks) {
        console.log(`markChunkBoundaries called. currentModalChunkerType: "${this.currentModalChunkerType}"`);
        // Check if this is DEFAULT-1024T chunker and use specialized logic
        if (this.currentModalChunkerType === 'DEFAULT-1024T') {
            console.log('Detected DEFAULT-1024T, calling specialized function');
            this.markChunkBoundariesForDefault1024T(htmlContent, chunks);
            return;
        }
        
        console.log('Using standard chunk boundary marking');


        // Build a comprehensive map of chunks to article elements
        const viewer = document.getElementById('articleContentViewer');
        if (!viewer || !chunks || chunks.length === 0) return;
        
        // Use the SAME approach as the chunker: get ALL text content
        const fullText = viewer.textContent || '';
        
        // Build element map by walking through DOM in order
        // This gives us the exact position of each element's text in the fullText
        const elementMap = [];
        let currentPos = 0;
        
        const walkDOM = (node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
                const element = node;
                const tagName = element.tagName?.toLowerCase();
                
                // Check if this is a LEAF block-level element (one that doesn't contain other block elements)
                const isTargetBlock = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 
                                       'blockquote', 'li', 'pre', 'code', 'table', 'figure'].includes(tagName);
                
                // Check if this element contains other block elements
                const hasBlockChildren = isTargetBlock && 
                    element.querySelector('p, h1, h2, h3, h4, h5, h6, blockquote, li, pre, code, table, figure');
                
                if (isTargetBlock && !hasBlockChildren) {
                    const elementText = element.textContent || '';
                    if (elementText.trim().length > 0) {
                        const startPos = currentPos;
                        currentPos += elementText.length;
                        elementMap.push({
                            element: element,
                            text: elementText,
                            start: startPos,
                            end: currentPos
                        });
                        return; // Don't walk children of leaf block elements
                    }
                }
                
                // Walk children for non-block or container block elements
                for (const child of element.childNodes) {
                    walkDOM(child);
                }
            } else if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent || '';
                currentPos += text.length;
            }
        };
        
        walkDOM(viewer);
        
        // Store this mapping for use when selecting chunks
        this.articleElementMap = elementMap;
        this.articleFullText = fullText;
        
        // Now map each chunk to article positions
        // Use the full text (not concatenated from selected elements) to match what the chunker saw
        const normalize = (text) => text.replace(/\s+/g, ' ').replace(/[""''„]/g, '"').replace(/[–—−]/g, '-').trim();
        this.normalizedArticle = normalize(fullText);
        
        let searchStartPos = 0;
        this.chunkPositions = chunks.map((chunk, idx) => {
            // Use originalContent for code/table chunks (for highlighting), otherwise use chunkContent
            const contentForHighlighting = chunk.metadata?.originalContent || chunk.chunkContent || chunk.text || '';
            const chunkText = contentForHighlighting.trim();
            const normalizedChunk = normalize(chunkText);
            
            // Find this chunk starting from where the last chunk ended
            const chunkStart200 = normalizedChunk.substring(0, Math.min(200, normalizedChunk.length));
            let chunkStartPos = this.normalizedArticle.indexOf(chunkStart200, searchStartPos);
            
            if (chunkStartPos === -1) {
                // Try with first 50 chars
                const chunkStart50 = normalizedChunk.substring(0, Math.min(50, normalizedChunk.length));
                chunkStartPos = this.normalizedArticle.indexOf(chunkStart50, searchStartPos);
                
                if (chunkStartPos === -1 && idx === 2) {
                    // Debug chunk 2 specifically
                    console.log('DEBUG Chunk 2:');
                    console.log('- Chunk text length:', chunkText.length);
                    console.log('- Normalized chunk length:', normalizedChunk.length);
                    console.log('- First 100 chars of normalized chunk:', normalizedChunk.substring(0, 100));
                    console.log('- Search starting from position:', searchStartPos);
                    console.log('- Article length:', this.normalizedArticle.length);
                    console.log('- Does it exist anywhere in article?', this.normalizedArticle.indexOf(chunkStart50));
                }
            }
            
            if (chunkStartPos === -1) {
                console.warn(`Could not find chunk ${idx} in article`);
                return { index: idx, start: searchStartPos, end: searchStartPos, found: false };
            }
            
            // Find end using last 200 chars of chunk
            const chunkEnd200 = normalizedChunk.length > 200 ? 
                normalizedChunk.substring(normalizedChunk.length - 200) : normalizedChunk;
            let chunkEndPos = this.normalizedArticle.indexOf(chunkEnd200, chunkStartPos);
            
            if (chunkEndPos !== -1) {
                chunkEndPos += chunkEnd200.length;
            } else {
                // Fallback: use chunk length
                chunkEndPos = chunkStartPos + normalizedChunk.length;
            }
            
            // Update search position for next chunk
            searchStartPos = chunkEndPos;
            
            return {
                index: idx,
                start: chunkStartPos,
                end: chunkEndPos,
                found: true
            };
        });
        
        console.log(`Mapped ${this.chunkPositions.filter(c => c.found).length} of ${chunks.length} chunks to article positions`);
    }

    // Specialized chunk boundary marking for DEFAULT-1024T chunker
    // DEFAULT-1024T chunks are based on token counts, not HTML structure
    // Boundaries can fall anywhere in the text (mid-sentence), so we need character-level highlighting
    markChunkBoundariesForDefault1024T(htmlContent, chunks) {
        console.log('Using specialized DEFAULT-1024T chunk boundary marking (character-level)');
        console.log('DEBUG markChunkBoundariesForDefault1024T: chunks.length =', chunks?.length);
        const viewer = document.getElementById('articleContentViewer');
        if (!viewer || !chunks || chunks.length === 0) {
            console.warn('markChunkBoundariesForDefault1024T: Missing viewer or chunks', { viewer: !!viewer, chunks: chunks?.length });
            return;
        }
        
        // Build a map of all text nodes with their positions
        const fullText = viewer.textContent || '';
        const textNodeMap = [];
        let currentPos = 0;
        
        const walkDOM = (node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent || '';
                if (text.length > 0) {
                    textNodeMap.push({
                        node: node,
                        text: text,
                        start: currentPos,
                        end: currentPos + text.length,
                        parent: node.parentElement
                    });
                    currentPos += text.length;
                }
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                for (const child of node.childNodes) {
                    walkDOM(child);
                }
            }
        };
        
        walkDOM(viewer);
        
        this.textNodeMap = textNodeMap;
        this.articleFullText = fullText;
        
        // More aggressive normalization for DEFAULT-1024T to handle text variations
        const normalize = (text) => {
            return text
                .replace(/\s+/g, ' ')  // Normalize all whitespace to single spaces
                .replace(/[""''„""]/g, '"')  // Normalize quotes
                .replace(/[–—−‐‑]/g, '-')  // Normalize dashes
                .replace(/[…]/g, '...')  // Normalize ellipsis
                .replace(/[\u00A0]/g, ' ')  // Replace nbsp with regular space
                .toLowerCase()  // Case insensitive matching for DEFAULT-1024T
                .trim();
        };
        
        this.normalizedArticle = normalize(fullText);
        
        // Map chunks with fuzzy matching
        // IMPORTANT: DEFAULT-1024T chunks overlap by ~1 token
        // Chunk 0: tokens 0-1023 (ends with e.g. "mit")
        // Chunk 1: tokens 1023-2047 (starts with "mit Vektorprozessoren")
        // For highlighting: Chunk 0 should end just before the new content of chunk 1
        
        // First pass: Find start positions for all chunks
        const chunkStarts = [];
        let searchStartPos = 0;
        
        chunks.forEach((chunk, idx) => {
            const chunkText = (chunk.text || chunk.chunkContent || '').trim();
            const normalizedChunk = normalize(chunkText);
            
            if (!normalizedChunk) {
                console.warn(`Chunk ${idx} has no text content`);
                chunkStarts.push(-1);
                return;
            }
            
            // Special case: Chunk 0 starts at beginning
            if (idx === 0) {
                chunkStarts.push(0);
                return;
            }
            
            // For chunks 1+: Find where the chunk text appears
            let chunkStartPos = -1;
            
            // Strategy 1: Try first 100 chars
            const searchLen100 = Math.min(100, normalizedChunk.length);
            const searchText100 = normalizedChunk.substring(0, searchLen100);
            chunkStartPos = this.normalizedArticle.indexOf(searchText100, searchStartPos);
            
            // Strategy 2: Try first 50 chars if 100 failed
            if (chunkStartPos === -1 && normalizedChunk.length >= 50) {
                const searchLen50 = Math.min(50, normalizedChunk.length);
                const searchText50 = normalizedChunk.substring(0, searchLen50);
                chunkStartPos = this.normalizedArticle.indexOf(searchText50, searchStartPos);
            }
            
            // Strategy 3: Try first 20 chars
            if (chunkStartPos === -1 && normalizedChunk.length >= 20) {
                const searchLen20 = Math.min(20, normalizedChunk.length);
                const searchText20 = normalizedChunk.substring(0, searchLen20);
                chunkStartPos = this.normalizedArticle.indexOf(searchText20, searchStartPos);
            }
            
            // Strategy 4: Search without sequential constraint
            if (chunkStartPos === -1) {
                const searchLen20 = Math.min(20, normalizedChunk.length);
                const searchText20 = normalizedChunk.substring(0, searchLen20);
                chunkStartPos = this.normalizedArticle.indexOf(searchText20);
                if (chunkStartPos !== -1) {
                    console.log(`Chunk ${idx}: Found match out of sequence at position ${chunkStartPos}`);
                }
            }
            
            if (chunkStartPos !== -1) {
                console.log(`Chunk ${idx}: Found start at position ${chunkStartPos}`);
                // For next chunk, search from well within current chunk (accounting for 1-token overlap)
                // Move forward by 80% of chunk length to avoid finding duplicate patterns too early
                searchStartPos = chunkStartPos + Math.floor(normalizedChunk.length * 0.8);
            } else {
                console.warn(`Chunk ${idx}: Could not find start position`);
            }
            
            chunkStarts.push(chunkStartPos);
        });
        
        // Second pass: Find end positions using next chunk's start as target
        this.chunkPositions = chunks.map((chunk, idx) => {
            const chunkText = (chunk.text || chunk.chunkContent || '').trim();
            const normalizedChunk = normalize(chunkText);
            const chunkStartPos = chunkStarts[idx];
            
            if (!normalizedChunk || chunkStartPos === -1) {
                console.warn(`Could not find chunk ${idx} in article`);
                return { index: idx, start: 0, end: 0, found: false, endWasFound: false };
            }
            
            // Determine expected end position from next chunk's start
            const nextChunkStart = idx < chunks.length - 1 ? chunkStarts[idx + 1] : this.normalizedArticle.length;
            const expectedEnd = nextChunkStart > 0 ? nextChunkStart : chunkStartPos + normalizedChunk.length;
            
            // Search for end text near the expected position
            const searchLen = Math.min(80, normalizedChunk.length);
            const chunkEndText = normalizedChunk.substring(normalizedChunk.length - searchLen);
            
            // Search window: narrow window around expected end to find closest occurrence
            // Use smaller forward buffer to avoid finding later duplicates of repeated text
            const searchStart = Math.max(chunkStartPos, expectedEnd - 200);
            const searchEnd = Math.min(expectedEnd + 500, this.normalizedArticle.length);
            
            const articleSegment = this.normalizedArticle.substring(searchStart, searchEnd);
            // Use indexOf to find the first occurrence in window (closest to expected end)
            const foundAt = articleSegment.indexOf(chunkEndText);
            
            let chunkEndPos;
            let endWasFound = false;
            
            if (foundAt !== -1) {
                chunkEndPos = searchStart + foundAt + searchLen;
                endWasFound = true;
                console.log(`Chunk ${idx}: Found end text at ${chunkEndPos}`);
            } else {
                // Fallback: try shorter end text
                const shortSearchLen = Math.min(30, normalizedChunk.length);
                const shortEndText = normalizedChunk.substring(normalizedChunk.length - shortSearchLen);
                // Use indexOf to find first occurrence in window
                const shortFoundAt = articleSegment.indexOf(shortEndText);
                
                if (shortFoundAt !== -1) {
                    chunkEndPos = searchStart + shortFoundAt + shortSearchLen;
                    endWasFound = true;
                    console.log(`Chunk ${idx}: Found end text with shorter match at ${chunkEndPos}`);
                } else {
                    // Use expected end based on next chunk's start
                    chunkEndPos = expectedEnd;
                    endWasFound = false;
                    console.log(`Chunk ${idx}: Could not find end text, using next chunk's start ${chunkEndPos}`);
                }
            }
            
            console.log(`Chunk ${idx}: Mapped to positions ${chunkStartPos}-${chunkEndPos}`);
            
            return {
                index: idx,
                start: chunkStartPos,
                end: chunkEndPos,
                found: true,
                endWasFound: endWasFound
            };
        });
        
        const foundCount = this.chunkPositions.filter(c => c.found).length;
        console.log(`DEFAULT-1024T: Mapped ${foundCount} of ${chunks.length} chunks to article positions`);
        console.log('DEBUG: Set this.chunkPositions =', this.chunkPositions?.length, 'items');
        console.log('DEBUG: Set this.textNodeMap =', this.textNodeMap?.length, 'items');
        console.log('DEBUG: Set this.articleFullText = ', this.articleFullText?.length, 'chars');
        console.log('DEBUG: Set this.normalizedArticle =', this.normalizedArticle?.length, 'chars');
    }
    
    selectChunkInModal(chunkIndex) {
        console.log('Selecting chunk:', chunkIndex);
        
        // Remove selection from all chunks
        document.querySelectorAll('.chunk-item-detail').forEach(el => {
            el.classList.remove('selected');
        });
        
        // Add selection to clicked chunk
        const chunkEl = document.querySelector(`.chunk-item-detail[data-chunk-index="${chunkIndex}"]`);
        if (chunkEl) {
            chunkEl.classList.add('selected');
            
            // Highlight this chunk in the article viewer using the improved method
            this.highlightChunkByIndex(chunkIndex);
            
            // If raw HTML is visible, also highlight there
            const rawHtmlView = document.getElementById('chunkerRawHtml');
            if (rawHtmlView && rawHtmlView.style.display === 'block') {
                console.log('Raw HTML is visible, highlighting chunk', chunkIndex);
                this.highlightChunkInRawHtml('articleContentViewer', 'chunkerRawHtml', false);
            }
            
            // Scroll chunk into view
            chunkEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
    
    highlightChunkByIndex(chunkIndex) {
        // Use the stored viewer ID for chunk highlighting
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
        
        // Remove any <mark> tags from previous DEFAULT-1024T highlighting
        const marksToRemove = viewer.querySelectorAll('mark.chunk-highlight-mark');
        console.log(`DEBUG: Removing ${marksToRemove.length} previous highlight marks`);
        marksToRemove.forEach(mark => {
            const parent = mark.parentNode;
            while (mark.firstChild) {
                parent.insertBefore(mark.firstChild, mark);
            }
            parent.removeChild(mark);
            parent.normalize(); // Merge adjacent text nodes
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
                        figure.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                    console.log(`Highlighted image: ${currentChunk.metadata.filename}`);
                    return;
                }
            }
            console.log(`Image not found: ${currentChunk.metadata.filename}`);
            return;
        }
        
        // Check if we have the chunk positions pre-computed (use correct property name from unified function)
        // Note: markChunkBoundariesUnified sets properties with dynamic names:
        // For chunker modal: ArticleElementMap, ChunkPositions, ArticleFullText, NormalizedArticle  
        // For assessment modal: assessmentArticleElementMap, assessmentChunkPositions, assessmentArticleFullText, assessmentNormalizedArticle
        // For DEFAULT-1024T: textNodeMap (instead of elementMap), chunkPositions, articleFullText, normalizedArticle
        const isDefault1024T = this.currentModalChunkerType === 'DEFAULT-1024T';
        console.log('DEBUG highlightChunkByIndex: isDefault1024T =', isDefault1024T, ', currentModalChunkerType =', this.currentModalChunkerType);
        const chunkPositions = this.ChunkPositions || this.chunkPositions;
        const articleElementMap = this.ArticleElementMap || this.articleElementMap;
        const textNodeMap = this.textNodeMap;
        const articleFullText = this.ArticleFullText || this.articleFullText;
        const normalizedArticle = this.NormalizedArticle || this.normalizedArticle;
        
        console.log('DEBUG highlightChunkByIndex properties:', {
            chunkPositions: chunkPositions?.length,
            articleElementMap: articleElementMap?.length,
            textNodeMap: textNodeMap?.length,
            articleFullText: articleFullText?.length,
            normalizedArticle: normalizedArticle?.length,
            ChunkPositions: this.ChunkPositions?.length,
            ArticleElementMap: this.ArticleElementMap?.length
        });
        
        // For DEFAULT-1024T, we need textNodeMap instead of articleElementMap
        if (isDefault1024T) {
            if (!chunkPositions || !textNodeMap || !articleFullText) {
                console.log('DEFAULT-1024T: Chunk positions not mapped yet', { positions: !!chunkPositions, textNodeMap: !!textNodeMap, fullText: !!articleFullText });
                return;
            }
        } else {
            if (!chunkPositions || !articleElementMap || !articleFullText) {
                console.log('Chunk positions not mapped yet', { positions: !!chunkPositions, elementMap: !!articleElementMap, fullText: !!articleFullText });
                return;
            }
        }
        
        const chunkPosition = chunkPositions[chunkIndex];
        if (!chunkPosition || !chunkPosition.found) {
            console.log(`Chunk ${chunkIndex} was not found in article`);
            return;
        }
        
        const chunkStart = chunkPosition.start;
        const chunkEnd = chunkPosition.end;
        
        console.log(`Chunk ${chunkIndex}: positions ${chunkStart}-${chunkEnd} in normalized text`);
        
        // For DEFAULT-1024T, use character-level highlighting with text nodes
        if (isDefault1024T && textNodeMap) {
            console.log('Using character-level highlighting for DEFAULT-1024T');
            
            // Rebuild the text node map to account for any previous DOM modifications
            const viewer = document.getElementById(this.currentModalViewerId || 'articleContentViewer');
            const freshTextNodeMap = [];
            const freshFullText = viewer.textContent || '';
            console.log(`DEBUG: Rebuilding text node map, viewer has ${freshFullText.length} chars of text`);
            let currentPos = 0;
            
            const walkDOM = (node) => {
                if (node.nodeType === Node.TEXT_NODE) {
                    const text = node.textContent || '';
                    if (text.length > 0) {
                        freshTextNodeMap.push({
                            node: node,
                            text: text,
                            start: currentPos,
                            end: currentPos + text.length,
                            parent: node.parentElement
                        });
                        currentPos += text.length;
                    }
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    for (const child of node.childNodes) {
                        walkDOM(child);
                    }
                }
            };
            
            walkDOM(viewer);
            
            console.log(`DEBUG: Built fresh text node map with ${freshTextNodeMap.length} text nodes`);
            
            // Build map efficiently in O(n): process each character once
            const normalizedToOriginalMap = [];
            let normalizedPos = 0;
            let lastWasSpace = true; // Start true to handle leading whitespace
            
            for (let origPos = 0; origPos < freshFullText.length; origPos++) {
                let char = freshFullText[origPos];
                
                // Handle whitespace collapse
                if (/\s/.test(char) || char === '\u00A0') {
                    if (!lastWasSpace) {
                        normalizedToOriginalMap[normalizedPos] = origPos;
                        normalizedPos++;
                        lastWasSpace = true;
                    }
                } else {
                    lastWasSpace = false;
                    
                    // Transform special characters
                    if (/[""''„""]/.test(char)) {
                        char = '"';
                    } else if (/[–—−‐‑]/.test(char)) {
                        char = '-';
                    } else if (char === '…') {
                        // Ellipsis expands to 3 chars
                        normalizedToOriginalMap[normalizedPos] = origPos;
                        normalizedToOriginalMap[normalizedPos + 1] = origPos;
                        normalizedToOriginalMap[normalizedPos + 2] = origPos;
                        normalizedPos += 3;
                        continue;
                    } else {
                        char = char.toLowerCase();
                    }
                    
                    normalizedToOriginalMap[normalizedPos] = origPos;
                    normalizedPos++;
                }
            }
            
            // Map normalized chunk positions to original positions
            const originalStart = normalizedToOriginalMap[chunkStart] || 0;
            const originalEnd = (normalizedToOriginalMap[chunkEnd - 1] || freshFullText.length - 1) + 1;
            
            console.log(`Mapped to original text positions: ${originalStart}-${originalEnd}`);
            console.log(`DEBUG: normalizedToOriginalMap.length = ${normalizedToOriginalMap.length}, chunkEnd = ${chunkEnd}`);
            console.log(`DEBUG: normalizedToOriginalMap[chunkEnd-1] = ${normalizedToOriginalMap[chunkEnd - 1]}`);
            console.log(`DEBUG: Will highlight text START (50 chars): "${freshFullText.substring(originalStart, Math.min(originalStart + 50, originalEnd))}..."`);
            console.log(`DEBUG: Will highlight text END (50 chars): "...${freshFullText.substring(Math.max(originalStart, originalEnd - 50), originalEnd)}"`);
            console.log(`DEBUG: Next 10 chars after end: "${freshFullText.substring(originalEnd, originalEnd + 10)}"`);


            
            // Find text nodes that overlap with this range and wrap them in <mark>
            let firstMark = null;
            let highlightedNodesCount = 0;
            freshTextNodeMap.forEach(nodeInfo => {
                if (nodeInfo.start < originalEnd && nodeInfo.end > originalStart) {
                    // This text node overlaps with the chunk
                    const node = nodeInfo.node;
                    const parent = node.parentNode;
                    
                    // Skip if node was already removed from DOM
                    if (!parent) return;
                    
                    const nodeStart = Math.max(0, originalStart - nodeInfo.start);
                    const nodeEnd = Math.min(nodeInfo.text.length, originalEnd - nodeInfo.start);
                    
                    if (nodeStart < nodeEnd && nodeStart >= 0 && nodeEnd <= nodeInfo.text.length) {
                        highlightedNodesCount++;
                        
                        // Split the text node and wrap the highlighted part in <mark>
                        const textBefore = nodeInfo.text.substring(0, nodeStart);
                        const textHighlight = nodeInfo.text.substring(nodeStart, nodeEnd);
                        const textAfter = nodeInfo.text.substring(nodeEnd);
                        
                        // Create the new nodes
                        const mark = document.createElement('mark');
                        mark.className = 'chunk-highlight-mark chunk-highlight active';
                        mark.textContent = textHighlight;
                        
                        // Save reference to the first mark element
                        if (!firstMark) firstMark = mark;
                        
                        // Replace the text node with the split version
                        if (textBefore) {
                            parent.insertBefore(document.createTextNode(textBefore), node);
                        }
                        parent.insertBefore(mark, node);
                        if (textAfter) {
                            parent.insertBefore(document.createTextNode(textAfter), node);
                        }
                        parent.removeChild(node);
                    }
                }
            });
            
            console.log(`DEBUG: Highlighted ${highlightedNodesCount} text nodes`);
            
            // Scroll to the first highlighted mark element
            if (firstMark && detailsContent) {
                firstMark.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        }
        
        // For other chunkers, use element-based highlighting
        let normalizedPos = 0;
        let originalStart = -1;
        let originalEnd = -1;
        
        for (let i = 0; i < articleFullText.length && normalizedPos <= chunkEnd; i++) {
            if (normalizedPos === chunkStart) {
                originalStart = i;
            }
            if (normalizedPos === chunkEnd) {
                originalEnd = i;
                break;
            }
            
            const char = articleFullText[i];
            if (!/\s/.test(char)) {
                normalizedPos++;
            } else if (normalizedPos < normalizedArticle.length && normalizedArticle[normalizedPos] === ' ') {
                normalizedPos++;
            }
        }
        
        if (originalEnd === -1) originalEnd = articleFullText.length;
        
        console.log(`Mapped to original positions: ${originalStart}-${originalEnd}`);
        
        // Find all elements that overlap with this range
        const elementsToHighlight = [];
        let firstElement = null;
        
        articleElementMap.forEach((item) => {
            if (item.start < originalEnd && item.end > originalStart) {
                elementsToHighlight.push(item.element);
                if (!firstElement) {
                    firstElement = item.element;
                }
            }
        });
        
        console.log(`Found ${elementsToHighlight.length} elements to highlight`);
        
        // Apply highlighting
        elementsToHighlight.forEach(el => {
            el.classList.add('chunk-highlight', 'active');
        });
        
        // Scroll first element into view
        if (firstElement && detailsContent) {
            firstElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
    
    highlightChunkInRawHtml(viewerId, rawHtmlId, isAssessmentModal = false) {
        console.log('DEBUG highlightChunkInRawHtml called:', { viewerId, rawHtmlId, isAssessmentModal });
        // Find and highlight the chunk in the raw HTML view using precomputed positions
        const rawHtmlView = document.getElementById(rawHtmlId);
        if (!rawHtmlView) {
            console.warn('Raw HTML view not found:', rawHtmlId);
            return;
        }
        
        // Determine which chunk is currently selected
        let selectedChunkIndex = -1;
        if (isAssessmentModal) {
            // Assessment modal uses different selectors
            const chunkItems = document.querySelectorAll('.assessment-chunk-item');
            chunkItems.forEach((item, idx) => {
                if (item.classList.contains('selected')) {
                    selectedChunkIndex = idx;
                }
            });
        } else {
            // Regular modals use .chunk-item-detail
            const chunkItems = document.querySelectorAll('.chunk-item-detail');
            chunkItems.forEach((item, idx) => {
                if (item.classList.contains('selected')) {
                    selectedChunkIndex = idx;
                }
            });
        }
        
        console.log('DEBUG selected chunk index:', selectedChunkIndex);
        if (selectedChunkIndex === -1) {
            console.warn('No chunk selected');
            return;
        }
        
        // Check if this is an image chunk
        const currentChunks = isAssessmentModal ? this.currentAssessmentChunks : this.currentModalChunks;
        const currentChunk = currentChunks[selectedChunkIndex];
        if (currentChunk.chunkType === 'IMAGE' && currentChunk.metadata && currentChunk.metadata.filename) {
            console.log('Highlighting image chunk in raw HTML:', currentChunk.metadata.filename);
            // For image chunks, search for the filename in the raw HTML
            const rawHtmlContent = this[`${isAssessmentModal ? 'assessment' : ''}OriginalRawHtml`] || '';
            const filename = currentChunk.metadata.filename;
            const filenamePos = rawHtmlContent.indexOf(filename);
            
            if (filenamePos === -1) {
                console.warn('Image filename not found in raw HTML:', filename);
                return;
            }
            
            // Find the figure/img tag that contains this filename
            let figureStart = rawHtmlContent.lastIndexOf('<figure', filenamePos);
            if (figureStart === -1) {
                figureStart = rawHtmlContent.lastIndexOf('<img', filenamePos);
            }
            
            if (figureStart === -1) {
                console.warn('Could not find image tag for:', filename);
                return;
            }
            
            // Find the end of the figure/img tag
            let figureEnd = rawHtmlContent.indexOf('</figure>', filenamePos);
            if (figureEnd !== -1) {
                figureEnd += '</figure>'.length;
            } else {
                // Single img tag, find the end
                figureEnd = rawHtmlContent.indexOf('>', filenamePos) + 1;
            }
            
            // Split and highlight
            const before = rawHtmlContent.substring(0, figureStart);
            const highlighted = rawHtmlContent.substring(figureStart, figureEnd);
            const after = rawHtmlContent.substring(figureEnd);
            
            rawHtmlView.innerHTML = `${this.escapeHtml(before)}<mark class="raw-html-highlight">${this.escapeHtml(highlighted)}</mark>${this.escapeHtml(after)}`;
            
            // Scroll to the mark
            const firstMark = rawHtmlView.querySelector('mark');
            if (firstMark) {
                firstMark.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            return;
        }
        
        // For non-image chunks, use precomputed positions
        const prefix = isAssessmentModal ? 'assessment' : '';
        const rawHtmlChunkPositions = this[`${prefix}RawHtmlChunkPositions`];
        
        console.log('DEBUG rawHtmlChunkPositions:', rawHtmlChunkPositions ? `array of ${rawHtmlChunkPositions.length}` : 'undefined');
        if (!rawHtmlChunkPositions) {
            console.warn('RawHtmlChunkPositions not computed yet');
            return;
        }
        
        const chunkPos = rawHtmlChunkPositions[selectedChunkIndex];
        console.log(`DEBUG chunk ${selectedChunkIndex} position:`, chunkPos);
        if (!chunkPos || !chunkPos.found) {
            console.warn(`Chunk ${selectedChunkIndex} position not found in raw HTML`);
            return;
        }
        
        // Get the original raw HTML content from stored value
        const rawHtmlContent = this[`${prefix}OriginalRawHtml`] || '';
        console.log('DEBUG using raw HTML content length:', rawHtmlContent.length);
        console.log('DEBUG substring from', chunkPos.start, 'to', chunkPos.end);
        console.log('DEBUG first 100 chars at start position:', rawHtmlContent.substring(chunkPos.start, chunkPos.start + 100));
        
        // Split at the chunk boundaries and wrap in <mark>
        const before = rawHtmlContent.substring(0, chunkPos.start);
        const highlighted = rawHtmlContent.substring(chunkPos.start, chunkPos.end);
        const after = rawHtmlContent.substring(chunkPos.end);
        
        // Update the view with highlighted content
        rawHtmlView.innerHTML = `${this.escapeHtml(before)}<mark class="raw-html-highlight">${this.escapeHtml(highlighted)}</mark>${this.escapeHtml(after)}`;
        
        // Scroll to the first mark
        const firstMark = rawHtmlView.querySelector('mark');
        if (firstMark) {
            firstMark.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Legacy method - kept for compatibility but now uses highlightChunkByIndex
    highlightChunkInArticle(chunkText) {
        // This method is deprecated - find the chunk index and use the new method
        const chunkIndex = this.currentModalChunks?.findIndex(c => 
            (c.chunkContent || c.text) === chunkText
        );
        if (chunkIndex !== -1) {
            this.highlightChunkByIndex(chunkIndex);
        }
        
        // Get the first 50 and last 50 characters to find the chunk boundaries
        const startText = cleanChunkText.substring(0, Math.min(50, cleanChunkText.length));
        const endText = cleanChunkText.length > 50 ? 
            cleanChunkText.substring(cleanChunkText.length - 50) : '';
        
        console.log('Looking for start text:', startText.substring(0, 30) + '...');
        console.log('Looking for end text:', endText ? endText.substring(0, 30) + '...' : 'N/A');
        
        // Build a list of all text content with their elements
        const walker = document.createTreeWalker(
            viewer,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );
        
        const textNodes = [];
        let node;
        while (node = walker.nextNode()) {
            if (node.textContent.trim().length > 0) {
                textNodes.push(node);
            }
        }
        
        console.log('Found text nodes:', textNodes.length);
        
        // Combine all text to find chunk position
        let fullText = '';
        const elementMap = [];
        textNodes.forEach(textNode => {
            const start = fullText.length;
            const text = textNode.textContent;
            fullText += text;
            elementMap.push({
                node: textNode,
                element: textNode.parentElement,
                start: start,
                end: start + text.length,
                text: text
            });
        });
        
        console.log('Full text length:', fullText.length);
        
        // Normalize whitespace for matching (compress multiple spaces/newlines to single space)
        // Also normalize quotes and dashes for better matching
        const normalizeText = (text) => {
            return text
                .replace(/\s+/g, ' ')  // Normalize whitespace
                .replace(/[""]/g, '"')  // Normalize quotes
                .replace(/[–—−]/g, '-')  // Normalize dashes (en-dash, em-dash, minus)
                .replace(/['']/g, "'")  // Normalize apostrophes
                .trim();
        };
        
        const normalizedFullText = normalizeText(fullText);
        const normalizedChunkText = normalizeText(cleanChunkText);
        const normalizedStartText = normalizeText(startText);
        const normalizedEndText = endText ? normalizeText(endText) : '';
        
        // Find where the chunk starts - use scoring to handle multiple occurrences
        let chunkStart = -1;
        let matchQuality = 'none';
        
        // Strategy 1: Try exact match first, but validate if there are multiple occurrences
        let firstExactMatch = normalizedFullText.indexOf(normalizedStartText);
        if (firstExactMatch !== -1) {
            // Check if there are multiple occurrences
            let secondMatch = normalizedFullText.indexOf(normalizedStartText, firstExactMatch + 1);
            if (secondMatch === -1) {
                // Only one occurrence, use it
                chunkStart = firstExactMatch;
                matchQuality = 'exact-unique';
                console.log('Found unique exact match at position', chunkStart);
            } else {
                // Multiple occurrences - need to score them
                console.log('Multiple exact matches found, scoring them...');
            }
        }
        
        // Strategy 2: If we need to score (multiple matches or no exact match), use word-based search with scoring
        if (chunkStart === -1) {
            const words = normalizedStartText.split(/\s+/);
            // Try progressively smaller segments starting with first 10 words
            for (let wordCount = Math.min(10, words.length); wordCount >= 3; wordCount--) {
                const shorterStart = words.slice(0, wordCount).join(' ');
                let pos = 0;
                let bestMatch = -1;
                let bestMatchScore = 0;
                
                // Find all occurrences and score them
                while ((pos = normalizedFullText.indexOf(shorterStart, pos)) !== -1) {
                    // Score this match by checking how much of the following text matches
                    const contextAfter = normalizedFullText.substring(pos + shorterStart.length, pos + shorterStart.length + 200);
                    const chunkAfter = normalizedStartText.substring(shorterStart.length, Math.min(shorterStart.length + 200, normalizedStartText.length));
                    
                    // Count matching words in the following context
                    const contextWords = contextAfter.split(/\s+/).filter(w => w).slice(0, 20);
                    const chunkWords = chunkAfter.split(/\s+/).filter(w => w).slice(0, 20);
                    let matchingWords = 0;
                    for (let i = 0; i < Math.min(contextWords.length, chunkWords.length); i++) {
                        if (contextWords[i] === chunkWords[i]) {
                            matchingWords++;
                        } else {
                            break; // Stop at first non-match
                        }
                    }
                    
                    console.log(`  Position ${pos}: "${shorterStart.substring(0, 30)}..." score: ${matchingWords}`);
                    
                    if (matchingWords > bestMatchScore) {
                        bestMatchScore = matchingWords;
                        bestMatch = pos;
                    }
                    
                    pos++;
                }
                
                if (bestMatch !== -1 && bestMatchScore >= 5) {
                    console.log(`Found best match using ${wordCount} words with score ${bestMatchScore} at position ${bestMatch}`);
                    chunkStart = bestMatch;
                    matchQuality = `scored-${wordCount}w-${bestMatchScore}pts`;
                    break;
                }
            }
        }
        
        // If still not found, try to find key words and use their position
        if (chunkStart === -1) {
            const firstWords = normalizedStartText.split(/\s+/).slice(0, 3).join(' ');
            const firstWord = normalizedStartText.split(/\s+/)[0];
            const secondWord = normalizedStartText.split(/\s+/)[1];
            
            console.log('Could not find exact chunk start in article');
            console.log('Start text:', normalizedStartText.substring(0, 50));
            console.log('Searching for first 3 words:', firstWords);
            
            // Try to find the first distinctive word
            let position = normalizedFullText.indexOf(firstWord);
            if (position !== -1) {
                console.log(`Found first word "${firstWord}" at position ${position}`);
                // Check if the second word appears nearby
                const textAfterFirst = normalizedFullText.substring(position, position + 100);
                if (textAfterFirst.includes(secondWord)) {
                    console.log(`Second word "${secondWord}" found nearby, using this position`);
                    chunkStart = position;
                } else {
                    console.log(`Second word "${secondWord}" not found nearby, searching further...`);
                    // Look for both words appearing close together
                    let searchPos = position;
                    while (searchPos < normalizedFullText.length && searchPos !== -1) {
                        const nextPos = normalizedFullText.indexOf(firstWord, searchPos + 1);
                        if (nextPos === -1) break;
                        const snippet = normalizedFullText.substring(nextPos, nextPos + 100);
                        if (snippet.includes(secondWord)) {
                            console.log(`Found both words together at position ${nextPos}`);
                            chunkStart = nextPos;
                            break;
                        }
                        searchPos = nextPos;
                    }
                }
            }
            
            if (chunkStart === -1) {
                console.log('Full text sample:', normalizedFullText.substring(0, 200));
                console.log(`Full text contains "${firstWord}"?`, normalizedFullText.includes(firstWord));
                console.log(`Full text contains "${secondWord}"?`, normalizedFullText.includes(secondWord));
                return;
            }
        }
        
        let chunkEnd;
        if (normalizedEndText) {
            // Search for end text starting from the chunk start position
            const maxSearchDistance = chunkStart + normalizedChunkText.length + 200; // Allow some flexibility
            chunkEnd = normalizedFullText.indexOf(normalizedEndText, chunkStart);
            
            // If not found or too far away, use chunk length as fallback
            if (chunkEnd === -1 || chunkEnd > maxSearchDistance) {
                console.log('Could not find chunk end nearby, using start + normalized chunk length');
                // Use the normalized chunk length which accounts for whitespace normalization
                chunkEnd = chunkStart + normalizedChunkText.length;
            } else {
                console.log('Found chunk end text at position', chunkEnd);
                chunkEnd += normalizedEndText.length;
            }
        } else {
            chunkEnd = chunkStart + normalizedChunkText.length;
        }
        
        // Double-check: ensure chunk end is reasonable (not more than 10% over expected length)
        const maxReasonableEnd = chunkStart + Math.floor(normalizedChunkText.length * 1.1);
        if (chunkEnd > maxReasonableEnd) {
            console.log(`Chunk end ${chunkEnd} exceeds reasonable bound ${maxReasonableEnd}, capping it`);
            chunkEnd = maxReasonableEnd;
        }
        
        console.log(`Found chunk position (normalized): ${chunkStart} to ${chunkEnd}`);
        
        // Map back to original text positions (approximate)
        // Since we normalized, we need to account for whitespace differences
        let originalStart = 0;
        let originalEnd = fullText.length;
        let normalizedPos = 0;
        
        for (let i = 0; i < fullText.length; i++) {
            if (normalizedPos === chunkStart) {
                originalStart = i;
            }
            if (normalizedPos === chunkEnd) {
                originalEnd = i;
                break;
            }
            if (!/\s/.test(fullText[i])) {
                normalizedPos++;
            } else if (normalizedPos < normalizedFullText.length && normalizedFullText[normalizedPos] === ' ') {
                normalizedPos++;
            }
        }
        
        console.log(`Mapped to original positions: ${originalStart} to ${originalEnd}`);
        
        // Find all elements that contain any part of the chunk
        const elementsToHighlight = new Set();
        let firstElement = null;
        
        elementMap.forEach(item => {
            // Check if this element overlaps with the chunk range
            if (item.start < originalEnd && item.end > originalStart) {
                // Check if the element itself is already a block-level element
                const elementTag = item.element.tagName ? item.element.tagName.toLowerCase() : '';
                if (elementTag === 'p' || elementTag === 'div' || elementTag.match(/^h[1-6]$/)) {
                    elementsToHighlight.add(item.element);
                    if (!firstElement) {
                        firstElement = item.element;
                    }
                } else {
                    // Find the block-level parent element
                    let parent = item.element.parentElement;
                    while (parent && parent !== viewer) {
                        const tag = parent.tagName ? parent.tagName.toLowerCase() : '';
                        if (tag === 'p' || tag === 'div' || tag.match(/^h[1-6]$/)) {
                            elementsToHighlight.add(parent);
                            if (!firstElement) {
                                firstElement = parent;
                            }
                            break;
                        }
                        parent = parent.parentElement;
                    }
                }
            }
        });
        
        console.log('Elements to highlight:', elementsToHighlight.size);
        if (elementsToHighlight.size > 0) {
            console.log('First element tag:', firstElement ? firstElement.tagName : 'none');
            console.log('Element tags:', Array.from(elementsToHighlight).map(el => el.tagName).join(', '));
        }
        
        // Filter out heading elements that appear after the first few elements
        // Headings at the end are likely the start of the next chunk
        const elementsArray = Array.from(elementsToHighlight);
        const filteredElements = [];
        let foundHeadingAfterContent = false;
        
        for (let i = 0; i < elementsArray.length; i++) {
            const el = elementsArray[i];
            const tag = el.tagName.toLowerCase();
            const isHeading = tag.match(/^h[1-6]$/);
            
            // If we find a heading after we've already added some content (not the first 2 elements)
            if (isHeading && i > 2 && filteredElements.length > 2) {
                console.log(`Stopping at heading ${tag.toUpperCase()} at position ${i} - likely next chunk`);
                foundHeadingAfterContent = true;
                break;
            }
            
            filteredElements.push(el);
        }
        
        if (foundHeadingAfterContent) {
            console.log(`Filtered out ${elementsArray.length - filteredElements.length} trailing elements`);
        }
        
        // Apply highlighting to filtered elements
        filteredElements.forEach(el => {
            el.classList.add('chunk-highlight', 'active');
        });
        
        // Scroll the first highlighted element into view in the details panel
        if (firstElement && detailsContent) {
            console.log('Scrolling first element into view');
            // Calculate the position relative to the scrollable container
            const containerRect = detailsContent.getBoundingClientRect();
            const elementRect = firstElement.getBoundingClientRect();
            const scrollOffset = elementRect.top - containerRect.top - 50; // 50px padding from top
            
            detailsContent.scrollBy({
                top: scrollOffset,
                behavior: 'smooth'
            });
        } else {
            console.log('No first element to scroll to');
        }
    }

    // Method to get selected POC IDs (for future bulk operations)
    getSelectedPocIds() {
        return Array.from(this.selectedPocs);
    }

    // Method to get selected POC data (for future bulk operations)
    getSelectedPocs() {
        return this.allPocs.filter(poc => this.selectedPocs.has(poc._id));
    }

    // Copy text to clipboard and show toast notification
    async copyToClipboard(text, label = 'POC ID') {
        try {
            await navigator.clipboard.writeText(text);
            this.showToast(`${label} copied: ${text}`, 'success');
        } catch (err) {
            console.error('Failed to copy:', err);
            this.showToast(`Failed to copy ${label}`, 'error');
        }
    }

    // Show toast notification
    showToast(message, type = 'info') {
        // Remove any existing toast
        const existingToast = document.querySelector('.toast-notification');
        if (existingToast) {
            existingToast.remove();
        }

        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast-notification toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        // Trigger animation
        setTimeout(() => toast.classList.add('show'), 10);

        // Auto-remove after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    buildChunkMetadataHtml(chunk, chunkType) {
        // Build metadata display based on chunk type and available metadata
        const metadata = chunk.metadata || {};
        const metadataParts = [];
        
        // 1. Display chunk type badge FIRST (on the left)
        if (chunkType && chunkType !== 'section') {
            const typeEmoji = {
                'image': '🖼️',
                'table': '📊',
                'code': '💻',
                'section-part': '📑'
            }[chunkType] || '📝';
            metadataParts.push(`<span class="chunk-type-badge">${typeEmoji} ${chunkType}</span>`);
        }
        
        // 2. Display token count (if available)
        const tokenCount = chunk.tokenCount || chunk.tokens || 0;
        if (tokenCount > 0) {
            metadataParts.push(`<span class="chunk-metadata-item">📊 ${tokenCount} tokens</span>`);
        }
        
        // 3. Display other metadata to the right
        
        // Display filename for images
        if (chunkType === 'IMAGE' && metadata.filename) {
            metadataParts.push(`<span class="chunk-metadata-item">📷 ${this.escapeHtml(metadata.filename)}</span>`);
        }
        
        // Display caption for images, tables, and code blocks
        if (metadata.caption && ['IMAGE', 'TABLE', 'CODE'].includes(chunkType)) {
            metadataParts.push(`<span class="chunk-metadata-item">💬 ${this.escapeHtml(metadata.caption)}</span>`);
        }
        
        // Display part numbers for split sections
        if (metadata.partNumber !== undefined && metadata.totalParts !== undefined) {
            metadataParts.push(`<span class="chunk-metadata-item">📄 Part ${metadata.partNumber} of ${metadata.totalParts}</span>`);
        }
        
        return metadataParts.length > 0 
            ? `<div class="chunk-metadata">${metadataParts.join('')}</div>`
            : '';
    }
}

// RAG Screen Manager
class RAGScreen {
    constructor(app) {
        this.app = app;
        this.isLoading = false;
        this.currentResults = null;
        this.initializeRAGScreen();
    }

    initializeRAGScreen() {
        // Get references to RAG screen elements
        this.questionInput = document.getElementById('ragQuestionInput');
        this.chunkerSelect = document.getElementById('ragChunkerSelect');
        this.pageSizeInput = document.getElementById('ragPageSizeInput');
        this.submitButton = document.getElementById('ragSubmitButton');
        this.downloadCSVButton = document.getElementById('ragDownloadCSVButton');
        this.chunksList = document.getElementById('ragChunksList');
        this.auditedPocsToggle = document.getElementById('ragAuditedPocsToggle');
        this.auditedPocsToggleContainer = document.getElementById('auditedPocsToggleContainer');
        this.llmToggle = document.getElementById('ragLLMToggle');

        // Add event listeners
        if (this.submitButton) {
            this.submitButton.addEventListener('click', () => this.performRAGSearch());
        }

        if (this.downloadCSVButton) {
            this.downloadCSVButton.addEventListener('click', () => this.downloadSearchResultsCSV());
        }

        if (this.questionInput) {
            // Submit on Enter key
            this.questionInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.performRAGSearch();
                }
            });
        }

        // Add chunker select change listener to show/hide toggle
        if (this.chunkerSelect) {
            this.chunkerSelect.addEventListener('change', () => this.handleChunkerChange());
            // Initialize toggle visibility
            this.handleChunkerChange();
        }
    }

    handleChunkerChange() {
        const selectedChunker = this.chunkerSelect.value;

        // Get page size container
        const pageSizeContainer = document.getElementById('pageSizeContainer');

        // Update page size visibility and placeholder based on chunker type
        if (selectedChunker === 'DEFAULT-1024T') {
            // Hide page size config for DEFAULT-1024T
            if (pageSizeContainer) {
                pageSizeContainer.style.display = 'none';
            }
            // Show audited POCs toggle for DEFAULT-1024T
            if (this.auditedPocsToggleContainer) {
                this.auditedPocsToggleContainer.style.display = 'flex';
            }
        } else {
            // Show page size config for non-default chunkers
            if (pageSizeContainer) {
                pageSizeContainer.style.display = 'flex';
            }
            // Hide audited POCs toggle for non-default chunkers
            if (this.auditedPocsToggleContainer) {
                this.auditedPocsToggleContainer.style.display = 'none';
            }

            // Update page size placeholder for non-default chunkers
            if (this.pageSizeInput) {
                const pageSizeLimits = {
                    'READ-CONTENT-PARA': 160,
                    'READ-CONTENT-PARA-LLM': 160,
                    'READ-CONTENT-SHORT': 160,
                    'READ-CONTENT-SHORT-LLM': 160
                };
                const defaultPageSize = pageSizeLimits[selectedChunker] || 160;
                this.pageSizeInput.placeholder = `Default: ${defaultPageSize}`;
                this.pageSizeInput.title = `Override default page size limit for ${selectedChunker} (default: ${defaultPageSize})`;
            }
        }
    }

    async performRAGSearch() {
        const question = this.questionInput.value.trim();
        const chunker = this.chunkerSelect.value;
        const useAuditedPocsOnly = this.auditedPocsToggle ? this.auditedPocsToggle.checked : false;
        const enableLLM = this.llmToggle ? this.llmToggle.checked : false;

        // Get custom page size limit if provided
        const customPageSize = this.pageSizeInput && this.pageSizeInput.value.trim()
            ? parseInt(this.pageSizeInput.value, 10)
            : null;

        if (!question) {
            this.showError('Please enter a question');
            return;
        }

        if (!chunker) {
            this.showError('Please select a chunker');
            return;
        }

        // Validate custom page size
        if (customPageSize !== null && (isNaN(customPageSize) || customPageSize < 1 || customPageSize > 500)) {
            this.showError('Page size must be between 1 and 500');
            return;
        }

        if (this.isLoading) {
            return; // Prevent multiple simultaneous searches
        }

        try {
            this.isLoading = true;
            this.showLoading();
            this.submitButton.disabled = true;

            console.log(`Performing RAG search: "${question}" with chunker: ${chunker}, auditedPocsOnly: ${useAuditedPocsOnly}, enableLLM: ${enableLLM}${customPageSize !== null ? `, pageSize: ${customPageSize}` : ''}`);

            const requestBody = {
                question: question,
                chunker: chunker,
                model: '41m', // Use 41m model for keyword extraction
                useAuditedPocsOnly: useAuditedPocsOnly,
                enableLLM: enableLLM
            };

            // Add custom page size if provided
            if (customPageSize !== null) {
                requestBody.pageSize = customPageSize;
            }

            const response = await fetch('/api/rag-search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.success) {
                this.currentResults = data.data;
                this.displayResults(data.data);
            } else {
                this.showError(data.message || 'Search failed');
            }

        } catch (error) {
            console.error('Error performing RAG search:', error);
            this.showError(`Error: ${error.message}`);
        } finally {
            this.isLoading = false;
            this.submitButton.disabled = false;
        }
    }

    showLoading() {
        this.chunksList.innerHTML = `
            <div class="rag-loading">
                <div class="spinner"></div>
                <p>Searching...</p>
            </div>
        `;
    }

    showError(message) {
        this.chunksList.innerHTML = `
            <div class="rag-error">
                <p>⚠️ ${message}</p>
            </div>
        `;
    }

    displayResults(data) {
        const { combined, keywords, total, totalRetrieval, totalEmbeddings, llmAnswer } = data;

        if (!combined || combined.length === 0) {
            // Hide download button when no results
            if (this.downloadCSVButton) {
                this.downloadCSVButton.style.display = 'none';
            }

            this.chunksList.innerHTML = `
                <div class="rag-no-results">
                    <p>No results found</p>
                    ${keywords ? `<p class="rag-keywords">Keywords extracted: ${keywords}</p>` : ''}
                </div>
            `;
            return;
        }

        // Show download button when results are available
        if (this.downloadCSVButton) {
            this.downloadCSVButton.style.display = 'flex';
        }

        let html = '';

        // Display LLM answer if available
        if (llmAnswer) {
            html += `
                <div class="rag-llm-answer">
                    <div class="rag-llm-header">
                        <h2>🤖 AI-Generated Answer</h2>
                    </div>
                    <div class="rag-llm-content">
                        ${this.formatLLMAnswer(llmAnswer)}
                    </div>
                </div>
            `;
        }

        // Display summary
        html += `
            <div class="rag-summary">
                <div class="rag-summary-stats">
                    <span class="rag-stat">
                        <strong>${total}</strong> total results
                    </span>
                    <span class="rag-stat">
                        <strong>${totalRetrieval}</strong> from retrieval
                    </span>
                    <span class="rag-stat">
                        <strong>${totalEmbeddings}</strong> from embeddings
                    </span>
                </div>
            </div>
        `;

        // Display results
        html += '<div class="rag-results-list">';
        combined.forEach((result, index) => {
            const source = result.from === 'vector' ? '🔷 Vector' : '📑 Index';
            const score = result.normalizedScore ? result.normalizedScore.toFixed(3) : result.score.toFixed(3);

            html += `
                <div class="rag-result-item" data-index="${index}">
                    <div class="rag-result-header">
                        <div class="rag-result-meta">
                            <span class="rag-result-source ${result.from}">${source}</span>
                            <span class="rag-result-score">Score: ${score}</span>
                            ${result.chunkerType ? `<span class="rag-result-chunker">${result.chunkerType}</span>` : ''}
                        </div>
                        <div class="rag-result-info">
                            <span class="rag-result-type">${result.contentType || 'N/A'}</span>
                            ${result.sortDate ? `<span class="rag-result-date">${new Date(result.sortDate).toLocaleDateString()}</span>` : ''}
                        </div>
                    </div>
                    <div class="rag-result-content">
                        <h3 class="rag-result-title">${this.escapeHtml(result.title || 'Untitled')}</h3>
                        ${result.subtitle ? `<p class="rag-result-subtitle">${this.escapeHtml(result.subtitle)}</p>` : ''}
                        ${result.abstract ? `<p class="rag-result-abstract">${this.escapeHtml(result.abstract)}</p>` : ''}
                        ${result.text ? `<p class="rag-result-text">${this.escapeHtml(this.truncateText(result.text, 300))}</p>` : ''}
                    </div>
                    <div class="rag-result-footer">
                        ${result.pocId ? `<span class="rag-result-poc-id">POC: ${result.pocId}</span>` : ''}
                        ${result._id ? `<span class="rag-result-chunk-id">Chunk: ${result._id}</span>` : ''}
                    </div>
                </div>
            `;
        });
        html += '</div>';

        this.chunksList.innerHTML = html;
        
        // Attach click-to-copy event listeners to POC IDs and Chunk IDs
        this.attachRAGResultEventListeners();
    }
    
    attachRAGResultEventListeners() {
        // Add click handlers for POC IDs
        const pocIdElements = document.querySelectorAll('.rag-result-poc-id');
        pocIdElements.forEach(element => {
            element.style.cursor = 'pointer';
            element.addEventListener('click', (e) => {
                e.stopPropagation();
                const text = element.textContent;
                // Extract just the ID (remove "POC: " prefix)
                const pocId = text.replace('POC: ', '').trim();
                this.app.copyToClipboard(pocId, 'POC ID');
            });
        });
        
        // Add click handlers for Chunk IDs
        const chunkIdElements = document.querySelectorAll('.rag-result-chunk-id');
        chunkIdElements.forEach(element => {
            element.style.cursor = 'pointer';
            element.addEventListener('click', (e) => {
                e.stopPropagation();
                const text = element.textContent;
                // Extract just the ID (remove "Chunk: " prefix)
                const chunkId = text.replace('Chunk: ', '').trim();
                this.app.copyToClipboard(chunkId, 'Chunk ID');
            });
        });
    }

    downloadSearchResultsCSV() {
        if (!this.currentResults) {
            console.error('No search results available to download');
            return;
        }

        const { combined } = this.currentResults;

        if (!combined || combined.length === 0) {
            console.error('No combined results available to download');
            return;
        }

        // Prepare CSV data
        const csvRows = [];

        // Add CSV header with rank
        csvRows.push(['rank', 'type', 'poc_id', 'chunk_id', 'name', 'chunk_text', 'date', 'score'].join(','));

        // Helper function to escape CSV values
        const escapeCSV = (value) => {
            if (value === null || value === undefined) {
                return '';
            }
            const stringValue = String(value);
            // Escape double quotes by doubling them, and wrap in quotes if contains comma, quote, or newline
            if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
                return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return stringValue;
        };

        // Helper function to format date
        const formatDate = (dateStr) => {
            if (!dateStr) return '';
            try {
                const date = new Date(dateStr);
                return date.toISOString().split('T')[0]; // Format as YYYY-MM-DD
            } catch (e) {
                return dateStr;
            }
        };

        // Add all combined search results with rank
        combined.forEach((result, index) => {
            const row = [
                escapeCSV(index + 1), // Rank (1-based)
                escapeCSV(result.from || ''), // type (vector or retrieval)
                escapeCSV(result.pocId || ''),
                escapeCSV(result._id || ''),
                escapeCSV(result.title || ''),
                escapeCSV(result.text || ''),
                escapeCSV(formatDate(result.sortDate)),
                escapeCSV(result.normalizedScore !== undefined ? result.normalizedScore : result.score)
            ];
            csvRows.push(row.join(','));
        });

        // Create CSV content
        const csvContent = csvRows.join('\n');

        // Create blob and download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        // Generate filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const question = this.questionInput.value.trim().substring(0, 30).replace(/[^a-zA-Z0-9]/g, '_');
        link.download = `rag-search-results_${question}_${timestamp}.csv`;

        link.href = url;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        console.log(`Downloaded CSV with ${combined.length} combined results`);
    }

    formatLLMAnswer(answer) {
        // Use marked.js to convert markdown to HTML if available
        if (typeof marked !== 'undefined') {
            try {
                // Configure marked options for better rendering
                marked.setOptions({
                    breaks: true,  // Convert \n to <br>
                    gfm: true,     // GitHub Flavored Markdown
                    headerIds: false,
                    mangle: false
                });
                return marked.parse(answer);
            } catch (error) {
                console.error('Error parsing markdown:', error);
                // Fallback to basic formatting
            }
        }

        // Fallback: Convert line breaks to HTML
        const escaped = this.escapeHtml(answer);
        return escaped.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }
}

// Screen Navigation Manager
class ScreenManager {
    constructor(app) {
        this.app = app;
        this.currentScreen = 'chunker';
        this.initializeScreenNavigation();
    }

    initializeScreenNavigation() {
        // RAG screen button (on chunker screen)
        const ragScreenButton = document.getElementById('ragScreenButton');
        if (ragScreenButton) {
            ragScreenButton.addEventListener('click', () => this.switchScreen('rag'));
        }

        // Chunker screen button (on RAG screen)
        const chunkerScreenButton = document.getElementById('chunkerScreenButton');
        if (chunkerScreenButton) {
            chunkerScreenButton.addEventListener('click', () => this.switchScreen('chunker'));
        }

        // Handle second logout button on RAG screen
        const logoutButton2 = document.getElementById('logoutButton2');
        if (logoutButton2) {
            logoutButton2.addEventListener('click', () => {
                if (this.app && this.app.logout) {
                    this.app.logout();
                }
            });
        }

        // Sync user welcome message to RAG screen
        this.syncUserInfo();
    }

    syncUserInfo() {
        const userWelcome = document.getElementById('userWelcome');
        const userWelcome2 = document.getElementById('userWelcome2');
        
        if (userWelcome && userWelcome2) {
            // Initial sync
            userWelcome2.textContent = userWelcome.textContent;
            
            // Watch for changes
            const observer = new MutationObserver(() => {
                userWelcome2.textContent = userWelcome.textContent;
            });
            observer.observe(userWelcome, { childList: true, characterData: true, subtree: true });
        }
    }

    switchScreen(screenName) {
        // Hide all screens
        const screens = document.querySelectorAll('.screen');
        screens.forEach(screen => screen.classList.remove('active'));

        // Show selected screen
        const targetScreen = document.getElementById(`${screenName}Screen`);
        if (targetScreen) {
            targetScreen.classList.add('active');
            this.currentScreen = screenName;
            console.log(`Switched to ${screenName} screen`);
        }
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.semanticChunkerApp = new SemanticChunkerApp();
    window.screenManager = new ScreenManager(window.semanticChunkerApp);
    window.ragScreen = new RAGScreen(window.semanticChunkerApp);
});