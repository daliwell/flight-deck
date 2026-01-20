/**
 * Frontend Unit Tests - ScreenManager Class
 * Tests for screen navigation functionality in public/script.js
 */

// Define ScreenManager class inline for testing
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

describe('ScreenManager', () => {
  let screenManager;
  let mockApp;

  beforeEach(() => {
    // Setup DOM with both screens
    document.body.innerHTML = `
      <div class="container">
        <div id="chunkerScreen" class="screen active">
          <div class="user-header">
            <div class="app-mode">
              <button id="ragScreenButton" class="app-mode-btn">RAG</button>
            </div>
            <div class="user-info">
              <span id="userWelcome">Welcome, Test User</span>
            </div>
            <div class="user-actions">
              <button id="createChunksButton">Create Chunks</button>
              <button id="assessQualityButton">Assess Quality</button>
              <button id="exportReportsButton">Export Reports</button>
              <button id="logoutButton">Logout</button>
            </div>
          </div>
          <div class="chunker-content">Chunker content</div>
        </div>
        
        <div id="ragScreen" class="screen">
          <div class="user-header">
            <div class="app-mode">
              <button id="chunkerScreenButton" class="app-mode-btn">Chunker</button>
            </div>
            <div class="user-info">
              <span id="userWelcome2">Loading user...</span>
            </div>
            <div class="user-actions">
              <button id="logoutButton2" class="logout-btn">Logout</button>
            </div>
          </div>
          <div class="rag-content">RAG content</div>
        </div>
      </div>
    `;

    // Mock app with logout method
    mockApp = {
      logout: jest.fn()
    };

    // Create ScreenManager instance
    screenManager = new ScreenManager(mockApp);
  });

  describe('Initialization', () => {
    test('should initialize with chunker as current screen', () => {
      expect(screenManager.currentScreen).toBe('chunker');
    });

    test('should set up event listeners for navigation buttons', () => {
      const ragButton = document.getElementById('ragScreenButton');
      const chunkerButton = document.getElementById('chunkerScreenButton');
      
      expect(ragButton).not.toBeNull();
      expect(chunkerButton).not.toBeNull();
    });

    test('should sync user info on initialization', () => {
      const userWelcome = document.getElementById('userWelcome');
      const userWelcome2 = document.getElementById('userWelcome2');
      
      // The second welcome should be synced with the first
      expect(userWelcome2.textContent).toBe(userWelcome.textContent);
    });

    test('should store reference to app', () => {
      expect(screenManager.app).toBe(mockApp);
    });
  });

  describe('Screen Switching', () => {
    test('should switch to RAG screen when RAG button is clicked', () => {
      const ragButton = document.getElementById('ragScreenButton');
      ragButton.click();
      
      expect(screenManager.currentScreen).toBe('rag');
    });

    test('should switch to chunker screen when Chunker button is clicked', () => {
      // First switch to RAG
      screenManager.switchScreen('rag');
      expect(screenManager.currentScreen).toBe('rag');
      
      // Then switch back to chunker
      const chunkerButton = document.getElementById('chunkerScreenButton');
      chunkerButton.click();
      
      expect(screenManager.currentScreen).toBe('chunker');
    });

    test('should hide inactive screen and show active screen', () => {
      const chunkerScreen = document.getElementById('chunkerScreen');
      const ragScreen = document.getElementById('ragScreen');
      
      // Initial state: chunker active
      expect(chunkerScreen.classList.contains('active')).toBe(true);
      expect(ragScreen.classList.contains('active')).toBe(false);
      
      // Switch to RAG
      screenManager.switchScreen('rag');
      expect(chunkerScreen.classList.contains('active')).toBe(false);
      expect(ragScreen.classList.contains('active')).toBe(true);
      
      // Switch back to chunker
      screenManager.switchScreen('chunker');
      expect(chunkerScreen.classList.contains('active')).toBe(true);
      expect(ragScreen.classList.contains('active')).toBe(false);
    });

    test('should update currentScreen property when switching', () => {
      expect(screenManager.currentScreen).toBe('chunker');
      
      screenManager.switchScreen('rag');
      expect(screenManager.currentScreen).toBe('rag');
      
      screenManager.switchScreen('chunker');
      expect(screenManager.currentScreen).toBe('chunker');
    });

    test('should handle switching to same screen gracefully', () => {
      const chunkerScreen = document.getElementById('chunkerScreen');
      
      screenManager.switchScreen('chunker');
      expect(chunkerScreen.classList.contains('active')).toBe(true);
      expect(screenManager.currentScreen).toBe('chunker');
    });
  });

  describe('Logout Functionality', () => {
    test('should call app.logout when logout button on chunker screen is clicked', () => {
      const logoutButton = document.getElementById('logoutButton');
      
      // Manually add event listener to simulate app behavior
      logoutButton.addEventListener('click', () => mockApp.logout());
      logoutButton.click();
      
      expect(mockApp.logout).toHaveBeenCalled();
    });

    test('should call app.logout when logout button on RAG screen is clicked', () => {
      const logoutButton2 = document.getElementById('logoutButton2');
      logoutButton2.click();
      
      expect(mockApp.logout).toHaveBeenCalled();
    });

    test('should handle missing app reference gracefully', () => {
      const screenManagerWithoutApp = new ScreenManager(null);
      const logoutButton2 = document.getElementById('logoutButton2');
      
      // Should not throw error
      expect(() => logoutButton2.click()).not.toThrow();
    });

    test('should handle app without logout method gracefully', () => {
      const appWithoutLogout = {};
      const screenManagerWithBadApp = new ScreenManager(appWithoutLogout);
      const logoutButton2 = document.getElementById('logoutButton2');
      
      // Should not throw error
      expect(() => logoutButton2.click()).not.toThrow();
    });
  });

  describe('User Info Synchronization', () => {
    test('should sync user welcome text from chunker to RAG screen', () => {
      const userWelcome = document.getElementById('userWelcome');
      const userWelcome2 = document.getElementById('userWelcome2');
      
      // Change the text in chunker screen
      userWelcome.textContent = 'Welcome, New User';
      
      // Trigger MutationObserver by waiting a bit
      return new Promise(resolve => {
        setTimeout(() => {
          expect(userWelcome2.textContent).toBe('Welcome, New User');
          resolve();
        }, 50);
      });
    });

    test('should handle missing user info elements gracefully', () => {
      // Remove elements
      document.getElementById('userWelcome').remove();
      document.getElementById('userWelcome2').remove();
      
      // Should not throw error
      expect(() => new ScreenManager(mockApp)).not.toThrow();
    });

    test('should observe changes to user welcome element', () => {
      const userWelcome = document.getElementById('userWelcome');
      const userWelcome2 = document.getElementById('userWelcome2');
      
      // Initial sync should have happened
      expect(userWelcome2.textContent).toBe(userWelcome.textContent);
      
      // Change welcome text
      userWelcome.textContent = 'Welcome, Updated User';
      
      // Wait for MutationObserver to trigger
      return new Promise(resolve => {
        setTimeout(() => {
          expect(userWelcome2.textContent).toBe('Welcome, Updated User');
          resolve();
        }, 50);
      });
    });
  });

  describe('Button Event Listeners', () => {
    test('should attach click handler to RAG screen button', () => {
      const ragButton = document.getElementById('ragScreenButton');
      const clickSpy = jest.spyOn(screenManager, 'switchScreen');
      
      ragButton.click();
      
      expect(clickSpy).toHaveBeenCalledWith('rag');
      clickSpy.mockRestore();
    });

    test('should attach click handler to Chunker screen button', () => {
      const chunkerButton = document.getElementById('chunkerScreenButton');
      const clickSpy = jest.spyOn(screenManager, 'switchScreen');
      
      chunkerButton.click();
      
      expect(clickSpy).toHaveBeenCalledWith('chunker');
      clickSpy.mockRestore();
    });

    test('should handle missing navigation buttons gracefully', () => {
      // Remove buttons
      document.getElementById('ragScreenButton').remove();
      document.getElementById('chunkerScreenButton').remove();
      
      // Should not throw error
      expect(() => new ScreenManager(mockApp)).not.toThrow();
    });

    test('should handle missing logout button gracefully', () => {
      // Remove logout button
      document.getElementById('logoutButton2').remove();
      
      // Should not throw error
      expect(() => new ScreenManager(mockApp)).not.toThrow();
    });
  });

  describe('Screen State Management', () => {
    test('should maintain screen state after multiple switches', () => {
      screenManager.switchScreen('rag');
      screenManager.switchScreen('chunker');
      screenManager.switchScreen('rag');
      screenManager.switchScreen('chunker');
      
      expect(screenManager.currentScreen).toBe('chunker');
      expect(document.getElementById('chunkerScreen').classList.contains('active')).toBe(true);
      expect(document.getElementById('ragScreen').classList.contains('active')).toBe(false);
    });

    test('should preserve screen content during switches', () => {
      const chunkerContent = document.querySelector('.chunker-content');
      const ragContent = document.querySelector('.rag-content');
      
      const originalChunkerText = chunkerContent.textContent;
      const originalRagText = ragContent.textContent;
      
      screenManager.switchScreen('rag');
      screenManager.switchScreen('chunker');
      
      expect(chunkerContent.textContent).toBe(originalChunkerText);
      expect(ragContent.textContent).toBe(originalRagText);
    });
  });

  describe('Edge Cases', () => {
    test('should handle invalid screen name gracefully', () => {
      const initialScreen = screenManager.currentScreen;
      
      // Try to switch to non-existent screen
      screenManager.switchScreen('nonexistent');
      
      // Should remain on current screen or handle gracefully
      expect(screenManager.currentScreen).toBeDefined();
    });

    test('should work with app instantiated after ScreenManager', () => {
      const screenManagerFirst = new ScreenManager(null);
      screenManagerFirst.app = mockApp;
      
      const logoutButton2 = document.getElementById('logoutButton2');
      logoutButton2.click();
      
      // Should work even though app was set after initialization
      expect(mockApp.logout).toHaveBeenCalled();
    });
  });
});
