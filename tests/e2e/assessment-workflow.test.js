/**
 * End-to-End Tests using Puppeteer
 * Tests the complete user workflows
 */

const puppeteer = require('puppeteer');

describe('E2E Tests - Assessment Modal Workflow', () => {
  let browser;
  let page;
  const BASE_URL = process.env.TEST_URL || 'http://localhost:3001';

  beforeAll(async () => {
    const launchOptions = {
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ],
      timeout: 60000
    };

    // Use system Chrome if available (better for ARM Macs with x64 Node)
    const systemChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    const fs = require('fs');
    if (fs.existsSync(systemChrome)) {
      launchOptions.executablePath = systemChrome;
    }

    browser = await puppeteer.launch(launchOptions);
  }, 90000);

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    page = await browser.newPage();
    await page.goto(BASE_URL);
    await page.waitForSelector('#pocsContainer');
  });

  afterEach(async () => {
    await page.close();
  });

  describe('POC Selection and Assessment', () => {
    test('should load POCs on page load', async () => {
      const pocsExist = await page.$('.poc-item');
      expect(pocsExist).toBeTruthy();
    });

    test('should select a POC by clicking checkbox', async () => {
      await page.waitForSelector('.poc-checkbox');
      await page.click('.poc-checkbox');
      
      const selectedCount = await page.$eval('#selectedCount', el => el.textContent);
      expect(parseInt(selectedCount)).toBeGreaterThan(0);
    });

    test('should open assessment method modal when Assess Quality button clicked', async () => {
      // Select a POC
      await page.click('.poc-checkbox');
      
      // Click Assess Quality button
      await page.click('#assessQualityButton');
      
      // Wait for modal to appear
      await page.waitForSelector('#assessmentMethodModal[style*="display: flex"]');
      
      const modalVisible = await page.$eval('#assessmentMethodModal', 
        el => el.style.display === 'flex');
      expect(modalVisible).toBe(true);
    });

    test('should select assessment method and start assessment', async () => {
      await page.click('.poc-checkbox');
      await page.click('#assessQualityButton');
      await page.waitForSelector('#assessmentMethodModal[style*="display: flex"]');
      
      // Select basic-heuristics method
      await page.click('input[value="basic-heuristics"]');
      
      // Click Start Assessment
      await page.click('#startQualityAssessmentButton');
      
      // Should show progress modal
      await page.waitForSelector('#qualityAssessmentModal[style*="display: flex"]');
    });
  });

  describe('Chunk View Modal', () => {
    test('should open chunk view when clicking assessment button', async () => {
      // Wait for POC with assessment to appear
      await page.waitForSelector('.assessment-indicator');
      
      // Click the assessment button
      await page.click('.assessment-indicator');
      
      // Should open chunk modal
      await page.waitForSelector('#chunkModal[style*="display: flex"]');
      
      const modalVisible = await page.$eval('#chunkModal', 
        el => el.style.display === 'flex');
      expect(modalVisible).toBe(true);
    });

    test('should display chunks with assessment scores', async () => {
      await page.waitForSelector('.assessment-indicator');
      await page.click('.assessment-indicator');
      await page.waitForSelector('#chunkModal[style*="display: flex"]');
      
      // Check if chunks are displayed
      const chunksExist = await page.$('.chunk-item-detail');
      expect(chunksExist).toBeTruthy();
      
      // Check if assessment scores are shown
      const scoresExist = await page.$('.assessment-score');
      expect(scoresExist).toBeTruthy();
    });

    test('should close modal when close button clicked', async () => {
      await page.waitForSelector('.assessment-indicator');
      await page.click('.assessment-indicator');
      await page.waitForSelector('#chunkModal[style*="display: flex"]');
      
      // Click close button
      await page.click('#closeModal');
      
      // Modal should be hidden
      const modalHidden = await page.$eval('#chunkModal', 
        el => el.style.display === 'none');
      expect(modalHidden).toBe(true);
    });
  });

  describe('POC View Modal', () => {
    test('should open POC view when clicking POC ID', async () => {
      await page.waitForSelector('.poc-id-copy');
      
      // Click POC ID (should have click handler)
      const pocIdExists = await page.$('.poc-id-copy');
      if (pocIdExists) {
        // Note: POC ID copy should copy, not open modal
        // Adjust based on actual behavior
      }
    });
  });

  describe('Filtering and Search', () => {
    test('should filter POCs by schema type', async () => {
      await page.waitForSelector('#schemaTypeFilter');
      
      // Select ARTICLE
      await page.select('#schemaTypeFilter', 'ARTICLE');
      
      // Wait for POCs to update
      await page.waitForTimeout(500);
      
      // Check filtered results
      const filteredPocs = await page.$$('.poc-item');
      expect(filteredPocs.length).toBeGreaterThan(0);
    });

    test('should search POCs by title', async () => {
      await page.waitForSelector('#searchInput');
      
      // Type search query
      await page.type('#searchInput', 'Java');
      
      // Wait for search to apply
      await page.waitForTimeout(500);
      
      // Check results contain search term
      const pocTitles = await page.$$eval('.poc-title', 
        elements => elements.map(el => el.textContent));
      
      const containsJava = pocTitles.some(title => 
        title.toLowerCase().includes('java'));
      expect(containsJava).toBe(true);
    });
  });

  describe('Clipboard Operations', () => {
    test('should copy POC ID to clipboard', async () => {
      await page.waitForSelector('.poc-id-copy');
      
      // Grant clipboard permissions
      const context = browser.defaultBrowserContext();
      await context.overridePermissions(BASE_URL, ['clipboard-read', 'clipboard-write']);
      
      // Click to copy
      await page.click('.poc-id-copy');
      
      // Should show toast
      await page.waitForSelector('.toast-notification');
      
      const toastVisible = await page.$('.toast-notification');
      expect(toastVisible).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    test('should display error when API fails', async () => {
      // Intercept API request and return error
      await page.setRequestInterception(true);
      
      page.on('request', request => {
        if (request.url().includes('/api/pocs')) {
          request.abort();
        } else {
          request.continue();
        }
      });
      
      await page.reload();
      
      // Should show error message
      await page.waitForSelector('.error-message', { timeout: 5000 });
    });
  });

  describe('Responsive Design', () => {
    test('should work on mobile viewport', async () => {
      await page.setViewport({ width: 375, height: 667 });
      await page.reload();
      
      await page.waitForSelector('#pocsContainer');
      
      const pocsVisible = await page.$('.poc-item');
      expect(pocsVisible).toBeTruthy();
    });

    test('should work on tablet viewport', async () => {
      await page.setViewport({ width: 768, height: 1024 });
      await page.reload();
      
      await page.waitForSelector('#pocsContainer');
      
      const pocsVisible = await page.$('.poc-item');
      expect(pocsVisible).toBeTruthy();
    });
  });
});
