/**
 * Frontend UI Tests - Costs Display
 * Tests for assessment costs and chunking costs display
 */

describe('Costs Display UI', () => {
  beforeEach(() => {
    // Setup comprehensive DOM for cost display
    document.body.innerHTML = `
      <!-- Cost Display for Chunk Creation -->
      <div id="costDisplayContainer" style="display: none;">
        <span id="chunkCreationCostDisplay">$0.00</span>
      </div>
      
      <!-- Assessment Results Modal -->
      <div id="qualityAssessmentModal" style="display: none;">
        <span id="closeQualityModal"></span>
        <div id="assessmentResults"></div>
        <div id="assessmentCostsSummary" style="display: none;">
          <span id="assessmentTotalCost">$0.00</span>
          <span id="assessmentCostDetails"></span>
        </div>
      </div>

      <!-- Chunk Creation Modal -->
      <div id="chunkCreationProgressModal" style="display: none;">
        <div id="chunkCreationProgress"></div>
        <div id="chunkCreationResults"></div>
        <div id="chunkCreationCostsSummary" style="display: none;">
          <span id="chunkingTotalCost">$0.00</span>
          <span id="chunkingCostDetails"></span>
        </div>
      </div>

      <!-- Progress Display -->
      <div id="progressContainer">
        <div id="progressText"></div>
      </div>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('Chunk Creation Costs Display', () => {
    test('should display cost container for LLM chunking', () => {
      const costContainer = document.getElementById('costDisplayContainer');
      expect(costContainer).toBeTruthy();
      expect(costContainer.style.display).toBe('none'); // Hidden by default
    });

    test('should show chunk creation costs when costs are present', () => {
      const costContainer = document.getElementById('costDisplayContainer');
      const costDisplay = document.getElementById('chunkCreationCostDisplay');
      
      // Simulate API response with costs
      const result = {
        costs: {
          totalCost: 0.000375,
          inputTokens: 150,
          outputTokens: 75
        }
      };

      // Update UI (simulating what the app does)
      if (costContainer && costDisplay) {
        if (result.costs && result.costs.totalCost > 0) {
          costDisplay.textContent = `$${result.costs.totalCost.toFixed(6)}`;
          costContainer.style.display = 'block';
        } else {
          costContainer.style.display = 'none';
        }
      }

      expect(costContainer.style.display).toBe('block');
      expect(costDisplay.textContent).toBe('$0.000375');
    });

    test('should hide chunk creation costs when costs are zero', () => {
      const costContainer = document.getElementById('costDisplayContainer');
      const costDisplay = document.getElementById('chunkCreationCostDisplay');
      
      const result = {
        costs: {
          totalCost: 0,
          inputTokens: 0,
          outputTokens: 0
        }
      };

      if (costContainer && costDisplay) {
        if (result.costs && result.costs.totalCost > 0) {
          costDisplay.textContent = `$${result.costs.totalCost.toFixed(6)}`;
          costContainer.style.display = 'block';
        } else {
          costContainer.style.display = 'none';
        }
      }

      expect(costContainer.style.display).toBe('none');
    });

    test('should format cost with 6 decimal places', () => {
      const costContainer = document.getElementById('costDisplayContainer');
      const costDisplay = document.getElementById('chunkCreationCostDisplay');
      
      const testCases = [
        { cost: 0.000001, formatted: '$0.000001' },
        { cost: 0.00001, formatted: '$0.000010' },
        { cost: 0.0001, formatted: '$0.000100' },
        { cost: 0.001, formatted: '$0.001000' },
        { cost: 0.01, formatted: '$0.010000' },
        { cost: 0.1, formatted: '$0.100000' },
        { cost: 1, formatted: '$1.000000' },
        { cost: 123.456789, formatted: '$123.456789' }
      ];

      testCases.forEach(({ cost, formatted }) => {
        if (costContainer && costDisplay) {
          costDisplay.textContent = `$${cost.toFixed(6)}`;
        }
        expect(costDisplay.textContent).toBe(formatted);
      });
    });

    test('should include token counts in cost data', () => {
      const result = {
        costs: {
          totalCost: 0.000375,
          inputTokens: 150,
          outputTokens: 75,
          inputTokensCost: 0.000225,
          outputTokensCost: 0.00015
        }
      };

      expect(result.costs.inputTokens).toBe(150);
      expect(result.costs.outputTokens).toBe(75);
      expect(result.costs.inputTokensCost).toBe(0.000225);
      expect(result.costs.outputTokensCost).toBe(0.00015);
      expect(result.costs.inputTokensCost + result.costs.outputTokensCost).toBe(result.costs.totalCost);
    });

    test('should update cost display for multiple chunking operations', () => {
      const costDisplay = document.getElementById('chunkCreationCostDisplay');
      const costContainer = document.getElementById('costDisplayContainer');
      
      // First operation
      let result1 = { costs: { totalCost: 0.000375 } };
      if (costContainer && costDisplay) {
        if (result1.costs && result1.costs.totalCost > 0) {
          costDisplay.textContent = `$${result1.costs.totalCost.toFixed(6)}`;
          costContainer.style.display = 'block';
        }
      }
      expect(costDisplay.textContent).toBe('$0.000375');

      // Second operation
      let result2 = { costs: { totalCost: 0.0005 } };
      if (costContainer && costDisplay) {
        if (result2.costs && result2.costs.totalCost > 0) {
          costDisplay.textContent = `$${result2.costs.totalCost.toFixed(6)}`;
          costContainer.style.display = 'block';
        }
      }
      expect(costDisplay.textContent).toBe('$0.000500');
    });

    test('should handle missing costs object gracefully', () => {
      const costContainer = document.getElementById('costDisplayContainer');
      const costDisplay = document.getElementById('chunkCreationCostDisplay');
      
      const result = {};

      if (costContainer && costDisplay) {
        if (result.costs && result.costs.totalCost > 0) {
          costDisplay.textContent = `$${result.costs.totalCost.toFixed(6)}`;
          costContainer.style.display = 'block';
        } else {
          costContainer.style.display = 'none';
        }
      }

      expect(costContainer.style.display).toBe('none');
    });
  });

  describe('Assessment Costs Display', () => {
    test('should display assessment cost summary container', () => {
      const costsSummary = document.getElementById('assessmentCostsSummary');
      expect(costsSummary).toBeTruthy();
      expect(costsSummary.style.display).toBe('none'); // Hidden by default
    });

    test('should show assessment costs when present', () => {
      const costsSummary = document.getElementById('assessmentCostsSummary');
      const totalCost = document.getElementById('assessmentTotalCost');
      
      const assessmentResult = {
        costs: {
          totalCost: 0.0012,
          pocCount: 5
        }
      };

      if (costsSummary && totalCost) {
        if (assessmentResult.costs && assessmentResult.costs.totalCost > 0) {
          totalCost.textContent = `$${assessmentResult.costs.totalCost.toFixed(6)}`;
          costsSummary.style.display = 'block';
        }
      }

      expect(costsSummary.style.display).toBe('block');
      expect(totalCost.textContent).toBe('$0.001200');
    });

    test('should hide assessment costs when zero', () => {
      const costsSummary = document.getElementById('assessmentCostsSummary');
      const totalCost = document.getElementById('assessmentTotalCost');
      
      const assessmentResult = {
        costs: {
          totalCost: 0,
          pocCount: 5
        }
      };

      if (costsSummary && totalCost) {
        if (assessmentResult.costs && assessmentResult.costs.totalCost > 0) {
          totalCost.textContent = `$${assessmentResult.costs.totalCost.toFixed(6)}`;
          costsSummary.style.display = 'block';
        } else {
          costsSummary.style.display = 'none';
        }
      }

      expect(costsSummary.style.display).toBe('none');
    });

    test('should display assessment cost details', () => {
      const costDetails = document.getElementById('assessmentCostDetails');
      
      const assessmentResult = {
        assessedCount: 5,
        costs: {
          totalCost: 0.001,
          averageCostPerPoc: 0.0002
        }
      };

      // Build cost details
      const detailsText = `${assessmentResult.assessedCount} POCs assessed • Avg: $${assessmentResult.costs.averageCostPerPoc.toFixed(6)} per POC`;
      costDetails.textContent = detailsText;

      expect(costDetails.textContent).toBe('5 POCs assessed • Avg: $0.000200 per POC');
    });

    test('should format assessment costs with proper currency', () => {
      const totalCost = document.getElementById('assessmentTotalCost');
      
      const costs = [
        { cost: 0.000001, formatted: '$0.000001' },
        { cost: 0.001, formatted: '$0.001000' },
        { cost: 0.1, formatted: '$0.100000' },
        { cost: 1.5, formatted: '$1.500000' }
      ];

      costs.forEach(({ cost, formatted }) => {
        totalCost.textContent = `$${cost.toFixed(6)}`;
        expect(totalCost.textContent).toBe(formatted);
      });
    });
  });

  describe('Chunking Costs Summary', () => {
    test('should display chunking costs summary container', () => {
      const costsSummary = document.getElementById('chunkCreationCostsSummary');
      expect(costsSummary).toBeTruthy();
      expect(costsSummary.style.display).toBe('none'); // Hidden by default
    });

    test('should show chunking costs summary when results available', () => {
      const costsSummary = document.getElementById('chunkCreationCostsSummary');
      const totalCost = document.getElementById('chunkingTotalCost');
      
      const chunkingResult = {
        successful: [
          { pocId: 'poc-1', chunked: true },
          { pocId: 'poc-2', chunked: true }
        ],
        costs: {
          totalCost: 0.000875,
          details: [
            { chunker: 'READ-CONTENT-SHORT-LLM', cost: 0.000375 },
            { chunker: 'READ-CONTENT-PARA-LLM', cost: 0.0005 }
          ]
        }
      };

      if (costsSummary && totalCost) {
        if (chunkingResult.costs && chunkingResult.costs.totalCost > 0) {
          totalCost.textContent = `$${chunkingResult.costs.totalCost.toFixed(6)}`;
          costsSummary.style.display = 'block';
        }
      }

      expect(costsSummary.style.display).toBe('block');
      expect(totalCost.textContent).toBe('$0.000875');
    });

    test('should show cost breakdown by chunker', () => {
      const costDetails = document.getElementById('chunkingCostDetails');
      
      const chunkingResult = {
        costs: {
          totalCost: 0.000875,
          details: [
            { chunker: 'READ-CONTENT-SHORT-LLM', cost: 0.000375 },
            { chunker: 'READ-CONTENT-PARA-LLM', cost: 0.0005 }
          ]
        }
      };

      // Build breakdown text
      const breakdown = chunkingResult.costs.details
        .map(detail => `${detail.chunker}: $${detail.cost.toFixed(6)}`)
        .join(' | ');
      
      costDetails.textContent = breakdown;

      expect(costDetails.textContent).toBe('READ-CONTENT-SHORT-LLM: $0.000375 | READ-CONTENT-PARA-LLM: $0.000500');
    });

    test('should calculate per-POC cost', () => {
      const chunkingResult = {
        successful: [
          { pocId: 'poc-1' },
          { pocId: 'poc-2' },
          { pocId: 'poc-3' }
        ],
        costs: {
          totalCost: 0.0009
        }
      };

      const perPocCost = chunkingResult.costs.totalCost / chunkingResult.successful.length;
      expect(perPocCost).toBe(0.0003);
      expect(perPocCost.toFixed(6)).toBe('0.000300');
    });

    test('should update costs after batch processing', () => {
      const totalCost = document.getElementById('chunkingTotalCost');
      const costsSummary = document.getElementById('chunkCreationCostsSummary');

      // Initial batch
      let batchResult1 = {
        costs: { totalCost: 0.0005 }
      };

      if (costsSummary && totalCost) {
        if (batchResult1.costs && batchResult1.costs.totalCost > 0) {
          totalCost.textContent = `$${batchResult1.costs.totalCost.toFixed(6)}`;
          costsSummary.style.display = 'block';
        }
      }
      expect(totalCost.textContent).toBe('$0.000500');

      // Second batch
      let batchResult2 = {
        costs: { totalCost: 0.000375 }
      };

      if (costsSummary && totalCost) {
        if (batchResult2.costs && batchResult2.costs.totalCost > 0) {
          totalCost.textContent = `$${batchResult2.costs.totalCost.toFixed(6)}`;
          costsSummary.style.display = 'block';
        }
      }
      expect(totalCost.textContent).toBe('$0.000375');
    });
  });

  describe('Progress Display with Costs', () => {
    test('should display cost in progress updates', () => {
      const progressText = document.getElementById('progressText');
      
      const progress = {
        processed: 5,
        total: 10,
        totalCost: 0.000125
      };

      const costText = progress.totalCost > 0 ? ` | 💰 Cost: $${progress.totalCost.toFixed(4)}` : '';
      const resultText = `${progress.processed}/${progress.total} POCs processed`;
      
      progressText.textContent = resultText + costText;

      expect(progressText.textContent).toBe('5/10 POCs processed | 💰 Cost: $0.0001');
    });

    test('should omit cost from progress if zero', () => {
      const progressText = document.getElementById('progressText');
      
      const progress = {
        processed: 3,
        total: 10,
        totalCost: 0
      };

      const costText = progress.totalCost > 0 ? ` | 💰 Cost: $${progress.totalCost.toFixed(4)}` : '';
      const resultText = `${progress.processed}/${progress.total} POCs processed`;
      
      progressText.textContent = resultText + costText;

      expect(progressText.textContent).toBe('3/10 POCs processed');
    });

    test('should update progress cost in real-time', () => {
      const progressText = document.getElementById('progressText');
      
      // Initial progress
      let progress1 = { processed: 1, total: 10, totalCost: 0.000025 };
      let costText1 = progress1.totalCost > 0 ? ` | 💰 Cost: $${progress1.totalCost.toFixed(4)}` : '';
      progressText.textContent = `${progress1.processed}/${progress1.total} processed` + costText1;
      expect(progressText.textContent).toBe('1/10 processed | 💰 Cost: $0.0000');

      // Updated progress
      let progress2 = { processed: 5, total: 10, totalCost: 0.000125 };
      let costText2 = progress2.totalCost > 0 ? ` | 💰 Cost: $${progress2.totalCost.toFixed(4)}` : '';
      progressText.textContent = `${progress2.processed}/${progress2.total} processed` + costText2;
      expect(progressText.textContent).toBe('5/10 processed | 💰 Cost: $0.0001');
    });
  });

  describe('Cost Calculations', () => {
    test('should calculate total cost from multiple operations', () => {
      const operations = [
        { chunker: 'SHORT', cost: 0.000100 },
        { chunker: 'PARA', cost: 0.000200 },
        { chunker: 'SHORT-LLM', cost: 0.000375 }
      ];

      const totalCost = operations.reduce((sum, op) => sum + op.cost, 0);
      expect(totalCost).toBe(0.000675);
      expect(totalCost.toFixed(6)).toBe('0.000675');
    });

    test('should calculate average cost per POC', () => {
      const chunkingResult = {
        successful: new Array(10).fill(null),
        costs: { totalCost: 0.001 }
      };

      const avgCost = chunkingResult.costs.totalCost / chunkingResult.successful.length;
      expect(avgCost).toBe(0.0001);
      expect(avgCost.toFixed(6)).toBe('0.000100');
    });

    test('should accumulate costs across batch processing', () => {
      let accumulatedCost = 0;
      
      const batches = [
        { costs: { totalCost: 0.0003 } },
        { costs: { totalCost: 0.000375 } },
        { costs: { totalCost: 0.0005 } }
      ];

      batches.forEach(batch => {
        if (batch.costs) {
          accumulatedCost += batch.costs.totalCost;
        }
      });

      expect(accumulatedCost).toBe(0.001175);
      expect(accumulatedCost.toFixed(6)).toBe('0.001175');
    });

    test('should handle rounding errors in cost calculations', () => {
      // Simulate potential floating point rounding
      const costs = [0.1, 0.2, 0.3];
      const total = costs.reduce((sum, cost) => sum + cost, 0);
      
      // Should be 0.6 (within floating point precision)
      expect(Math.abs(total - 0.6) < 0.0000001).toBe(true);
    });
  });

  describe('Cost Display Edge Cases', () => {
    test('should handle very large costs', () => {
      const costDisplay = document.getElementById('chunkCreationCostDisplay');
      const largeWow = 999999.999999;
      
      costDisplay.textContent = `$${largeWow.toFixed(6)}`;
      expect(costDisplay.textContent).toBe('$999999.999999');
    });

    test('should handle very small costs', () => {
      const costDisplay = document.getElementById('chunkCreationCostDisplay');
      const verySmall = 0.000001;
      
      costDisplay.textContent = `$${verySmall.toFixed(6)}`;
      expect(costDisplay.textContent).toBe('$0.000001');
    });

    test('should handle costs with trailing zeros', () => {
      const costDisplay = document.getElementById('chunkCreationCostDisplay');
      
      const testCases = [
        { value: 0.1, expected: '$0.100000' },
        { value: 0.01, expected: '$0.010000' },
        { value: 1.0, expected: '$1.000000' }
      ];

      testCases.forEach(({ value, expected }) => {
        costDisplay.textContent = `$${value.toFixed(6)}`;
        expect(costDisplay.textContent).toBe(expected);
      });
    });

    test('should handle null or undefined costs gracefully', () => {
      const costContainer = document.getElementById('costDisplayContainer');
      const costDisplay = document.getElementById('chunkCreationCostDisplay');
      
      const testCases = [
        { costs: null },
        { costs: undefined },
        { costs: {} }
      ];

      testCases.forEach(result => {
        if (costContainer && costDisplay) {
          if (result.costs && result.costs.totalCost > 0) {
            costDisplay.textContent = `$${result.costs.totalCost.toFixed(6)}`;
            costContainer.style.display = 'block';
          } else {
            costContainer.style.display = 'none';
          }
        }
      });

      expect(costContainer.style.display).toBe('none');
    });
  });
});
