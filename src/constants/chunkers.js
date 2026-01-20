/**
 * Chunker Constants and Enums
 * 
 * This file defines the active chunker types in use.
 */

// Chunker Types Enum
const CHUNKER_TYPES = {
  DEFAULT_1024T: 'DEFAULT-1024T',
  READ_CONTENT_PARA: 'READ-CONTENT-PARA',
  READ_CONTENT_PARA_LLM: 'READ-CONTENT-PARA-LLM',
  READ_CONTENT_SHORT: 'READ-CONTENT-SHORT',
  READ_CONTENT_SHORT_LLM: 'READ-CONTENT-SHORT-LLM'
};

// Chunk Types Enum
const CHUNK_TYPES = {
  PARAGRAPH: 'PARAGRAPH',
  SECTION: 'SECTION',
  CODE: 'CODE',
  IMAGE: 'IMAGE',
  TABLE: 'TABLE'
};

// POC Quality Enum
const POC_QUALITY = {
  GOOD: 'GOOD',
  BAD_POC: 'BAD_POC',
  BAD_CHUNKS: 'BAD_CHUNKS',
  UNKNOWN: 'UNKNOWN'
};

// POC Quality colors for UI display
const POC_QUALITY_COLORS = {
  [POC_QUALITY.GOOD]: '#28a745',        // Green
  [POC_QUALITY.BAD_POC]: '#dc3545',     // Red
  [POC_QUALITY.BAD_CHUNKS]: '#ffc107',  // Amber
  [POC_QUALITY.UNKNOWN]: '#6c757d'      // Default gray
};

// Default chunker used for pocEmbeddings collection
const DEFAULT_CHUNKER = CHUNKER_TYPES.DEFAULT_1024T;

// Collection associations
const COLLECTION_CHUNKER_MAPPING = {
  [CHUNKER_TYPES.DEFAULT_1024T]: 'pocEmbeddings',
  [CHUNKER_TYPES.READ_CONTENT_PARA]: 'chunkAuditChunks',
  [CHUNKER_TYPES.READ_CONTENT_PARA_LLM]: 'chunkAuditChunks',
  [CHUNKER_TYPES.READ_CONTENT_SHORT]: 'chunkAuditChunks',
  [CHUNKER_TYPES.READ_CONTENT_SHORT_LLM]: 'chunkAuditChunks'
};

// Helper functions
const ChunkerUtils = {
  /**
   * Get all available chunker types
   * @returns {string[]} Array of chunker type values
   */
  getAllChunkerTypes() {
    return Object.values(CHUNKER_TYPES);
  },

  /**
   * Get the default chunker
   * @returns {string} Default chunker value
   */
  getDefaultChunker() {
    return DEFAULT_CHUNKER;
  },

  /**
   * Get associated collection for a chunker type
   * @param {string} chunkerType - The chunker type
   * @returns {string|null} Associated collection name or null
   */
  getAssociatedCollection(chunkerType) {
    return COLLECTION_CHUNKER_MAPPING[chunkerType] || null;
  },

  /**
   * Check if a chunker type is valid
   * @param {string} chunkerType - The chunker type to validate
   * @returns {boolean} True if valid, false otherwise
   */
  isValidChunkerType(chunkerType) {
    return Object.values(CHUNKER_TYPES).includes(chunkerType);
  },

  /**
   * Check if a chunk type is valid
   * @param {string} chunkType - The chunk type to validate
   * @returns {boolean} True if valid, false otherwise
   */
  isValidChunkType(chunkType) {
    return Object.values(CHUNK_TYPES).includes(chunkType);
  }
};

module.exports = {
  CHUNKER_TYPES,
  CHUNK_TYPES,
  DEFAULT_CHUNKER,
  COLLECTION_CHUNKER_MAPPING,
  POC_QUALITY,
  POC_QUALITY_COLORS,
  ChunkerUtils
};