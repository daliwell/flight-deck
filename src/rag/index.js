/**
 * RAG (Retrieval-Augmented Generation) Services
 *
 * This module exports all RAG-related search services:
 * - ragSearch: Combines retrieval and embedded search for hybrid results
 * - retrievalSearch: Keyword-based search using MongoDB Atlas Search
 * - embeddedSearch: Vector similarity search using embeddings
 * - retrievalHelper: Helper functions for filters and keyword extraction
 * - ragHelper: RAG answer generation with citations and references
 * - prompt: Prompt generation service for keyword extraction, language detection, and RAG responses
 */

const ragSearch = require('./ragSearch');
const retrievalSearch = require('./retrievalSearch');
const embeddedSearch = require('./embeddedSearch');
const retrievalHelper = require('./retrievalHelper');
const ragHelper = require('./ragHelper');
const prompt = require('./prompt');

module.exports = {
  ragSearch,
  retrievalSearch,
  embeddedSearch,
  retrievalHelper,
  ragHelper,
  prompt
};

