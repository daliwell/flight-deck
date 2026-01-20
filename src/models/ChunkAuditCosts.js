const mongoose = require('mongoose');

const chunkAuditCostsSchema = new mongoose.Schema({
  pocId: {
    type: String,
    required: true,
    index: true
  },
  inputTokens: {
    type: Number,
    required: true,
    min: 0
  },
  inputTokensCost: {
    type: Number,
    required: true,
    min: 0
  },
  outputTokens: {
    type: Number,
    required: true,
    min: 0
  },
  outputTokensCost: {
    type: Number,
    required: true,
    min: 0
  },
  totalCost: {
    type: Number,
    required: true,
    min: 0
  },
  updatedAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  collection: 'chunkAuditCosts',
  timestamps: { createdAt: true, updatedAt: true }
});

// Index for efficient querying
chunkAuditCostsSchema.index({ pocId: 1, updatedAt: -1 });

// Virtual for formatted cost display
chunkAuditCostsSchema.virtual('formattedTotalCost').get(function() {
  return `$${this.totalCost.toFixed(6)}`;
});

// Static method to get total costs for a POC
chunkAuditCostsSchema.statics.getTotalCostForPoc = async function(pocId) {
  const result = await this.aggregate([
    { $match: { pocId } },
    { 
      $group: {
        _id: null,
        totalInputTokens: { $sum: '$inputTokens' },
        totalOutputTokens: { $sum: '$outputTokens' },
        totalCost: { $sum: '$totalCost' },
        callCount: { $sum: 1 },
        lastCall: { $max: '$updatedAt' }
      }
    }
  ]);
  
  return result.length > 0 ? result[0] : {
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCost: 0,
    callCount: 0,
    lastCall: null
  };
};

// Static method to get costs within date range
chunkAuditCostsSchema.statics.getCostsInDateRange = async function(startDate, endDate) {
  return this.aggregate([
    { 
      $match: { 
        updatedAt: { 
          $gte: new Date(startDate), 
          $lte: new Date(endDate) 
        } 
      } 
    },
    { 
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$updatedAt' } },
        dailyInputTokens: { $sum: '$inputTokens' },
        dailyOutputTokens: { $sum: '$outputTokens' },
        dailyCost: { $sum: '$totalCost' },
        callCount: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);
};

module.exports = mongoose.model('ChunkAuditCosts', chunkAuditCostsSchema);