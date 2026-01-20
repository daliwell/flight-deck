const mongoose = require('mongoose');
const { CHUNK_TYPES, ChunkerUtils } = require('../constants/chunkers');

// New Chunk model for the 'chunks' collection
// This is the new standardized schema that will replace ChunkAuditChunk
const chunkSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true
  },
  pocId: {
    type: String,
    required: true
  },
  index: {
    type: Number,
    required: true  // 0-based index (different from chunkOrder which is 1-based)
  },
  total: {
    type: Number,
    required: true
  },
  isSlide: {
    type: Boolean,
    default: false
  },
  contentType: {
    type: String
  },
  title: {
    type: String
  },
  subtitle: {
    type: String
  },
  abstract: {
    type: String
  },
  text: {
    type: String,
    required: true
  },
  chunker: {
    type: String,
    required: true  // The chunker type used to create this chunk
  },
  chunkType: {
    type: String,
    enum: Object.values(CHUNK_TYPES),
    required: true,
    validate: {
      validator: function(value) {
        return ChunkerUtils.isValidChunkType(value);
      },
      message: 'Invalid chunk type'
    }
  },
  primaryCategoryNames: {
    type: String
  },
  secondaryCategoryNames: {
    type: String
  },
  tertiaryCategoryNames: {
    type: String
  },
  language: {
    type: String
  },
  similarities: {
    type: [Number]  // FloatArray
  },
  experts: {
    type: [{
      name: String,
      // Add other expert fields as needed
    }]
  },
  expertSearchNames: {
    type: String
  },
  sortYear: {
    type: String
  },
  sortDate: {
    type: Date
  },
  supportedApps: {
    type: [String]
  },
  isArchetype: {
    type: Boolean,
    default: false
  },
  parentId: {
    type: String
  },
  parentName: {
    type: String
  },
  parentDescription: {
    type: String
  },
  indexBrandName: {
    type: String
  },
  indexSeriesName: {
    type: String
  },
  summaryDe: {
    type: String
  },
  summaryEn: {
    type: String
  },
  summaryNl: {
    type: String
  },
  start: {
    type: String
  },
  end: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  collection: 'chunks',
  _id: false  // We're managing _id manually as a string
});

// Add indexes
chunkSchema.index({ pocId: 1, index: 1 });
chunkSchema.index({ pocId: 1 });

const Chunk = mongoose.model('Chunk', chunkSchema);

module.exports = Chunk;
