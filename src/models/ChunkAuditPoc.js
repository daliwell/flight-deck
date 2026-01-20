const mongoose = require('mongoose');
const { CHUNKER_TYPES, DEFAULT_CHUNKER, POC_QUALITY, ChunkerUtils } = require('../constants/chunkers');

const chunkAuditPocsSchema = new mongoose.Schema({
  pocId: {
    type: String,
    required: true
  },
  sortDate: {
    type: Date,
    default: Date.now
  },
  parentSchemaType: {
    type: String,
    required: true
  },
  schemaType: {
    type: String,
    required: true
  },
  contentType: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  summary: {
    type: String,
    default: ''
  },
  summaryEn: {
    type: String,
    default: ''
  },
  chunks: [{
    chunker: {
      type: String,
      enum: Object.values(CHUNKER_TYPES),
      default: DEFAULT_CHUNKER,
      validate: {
        validator: function(value) {
          return ChunkerUtils.isValidChunkerType(value);
        },
        message: 'Invalid chunker type'
      }
    },
    assessments: [{
      method: {
        type: String,
        enum: ['basic-heuristics', 'ai-advanced'],
        default: 'basic-heuristics'
      },
      qualityScore: {
        type: Number,
        min: 0,
        max: 1,
        default: 0
      },
      assessmentCost: {
        type: Number,
        min: 0,
        default: 0
      },
      updatedAt: {
        type: Date,
        default: Date.now
      },
      qualityAssessments: [{
        index: {
          type: Number,
          required: true
        },
        quality: {
          type: String,
          required: true
        },
        qualityScore: {
          type: Number,
          required: true,
          min: 0,
          max: 1
        },
        _id: false
      }],
      _id: false // Disable _id for assessment subdocuments
    }],
    _id: false // Disable _id for subdocuments to keep it simple
  }],
  text: {
    type: String,
    default: ''
  },
  rawText: {
    type: String,
    default: ''
  },
  qualityAssessments: [{
    method: {
      type: String,
      required: true
    },
    chunker: {
      type: String,
      required: false
    },
    index: {
      type: Number,
      required: true
    },
    quality: {
      type: String,
      required: true
    },
    qualityScore: {
      type: Number,
      required: true,
      min: 0,
      max: 1
    },
    updatedAt: {
      type: Date,
      default: Date.now
    },
    _id: false // Disable _id for subdocuments
  }]
}, {
  timestamps: true,
  collection: 'chunkAuditPocs'
});

// Create indexes for search functionality
chunkAuditPocsSchema.index({
  pocId: 'text',
  parentSchemaType: 'text',
  schemaType: 'text',
  contentType: 'text',
  title: 'text',
  summary: 'text',
  summaryEn: 'text',
  text: 'text',
  'chunks.chunker': 'text',
  'chunks.assessments.method': 'text'
});

// Add index on sortDate for efficient sorting
chunkAuditPocsSchema.index({ sortDate: -1 });

module.exports = mongoose.model('ChunkAuditPoc', chunkAuditPocsSchema);