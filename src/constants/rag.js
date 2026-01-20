/**
 * RAG (Retrieval-Augmented Generation) Constants
 *
 * Shared configuration constants for RAG-related services.
 */

// Default page size limit for both retrieval and embedded search
const DEFAULT_PAGE_SIZE_LIMIT = 20;

// Page size limits by chunker type
const PAGE_SIZE_LIMITS = {
  'DEFAULT-1024T': 20,
  'READ-CONTENT-PARA': 160,
  'READ-CONTENT-PARA-LLM': 160,
  'READ-CONTENT-SHORT': 160,
  'READ-CONTENT-SHORT-LLM': 160
};

// RAG Configuration Defaults
const RAG_DEFAULTS = {
  PAGE_SIZE_LIMIT: DEFAULT_PAGE_SIZE_LIMIT,
  KEYWORD_CUTOFF: 23,
  EMBEDDING_CUTOFF: 0.693,
  LLM_MAX_TOKENS: 2000,
  LLM_TEMPERATURE: 0.0,
  NUM_CANDIDATES_MULTIPLIER: 3,
  MAX_CANDIDATES: 150
};

/**
 * Get page size limit based on chunker type
 * @param {string} chunker - The chunker type
 * @returns {number} Page size limit for the chunker
 */
const getPageSizeLimit = (chunker) => {
  if (!chunker) {
    return DEFAULT_PAGE_SIZE_LIMIT;
  }
  return PAGE_SIZE_LIMITS[chunker] || DEFAULT_PAGE_SIZE_LIMIT;
};

module.exports = {
  DEFAULT_PAGE_SIZE_LIMIT,
  PAGE_SIZE_LIMITS,
  RAG_DEFAULTS,
  getPageSizeLimit
};

