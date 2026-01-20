const mongoose = require('mongoose');
const { CHUNKER_TYPES, CHUNK_TYPES, DEFAULT_CHUNKER, POC_QUALITY, ChunkerUtils } = require('../constants/chunkers');

const chunkAuditChunksSchema = new mongoose.Schema({
  // Define schema based on your data structure
  // This is a placeholder - adjust fields based on actual data
  chunkId: {
    type: String,
    required: true
  },
  pocId: {
    type: String,
    required: true,
    ref: 'ChunkAuditPoc'
  },
  chunkContent: {
    type: String,
    required: true
  },
  chunkOrder: {
    type: Number,
    default: 0
  },
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
  quality: {
    type: String,
    enum: Object.values(POC_QUALITY),
    default: POC_QUALITY.UNKNOWN,
    validate: {
      validator: function(value) {
        return Object.values(POC_QUALITY).includes(value);
      },
      message: 'Invalid quality value'
    }
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
  tokenCount: {
    type: Number,
    default: 0
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true,
  collection: 'chunkAuditChunks'
});

module.exports = mongoose.model('ChunkAuditChunk', chunkAuditChunksSchema);