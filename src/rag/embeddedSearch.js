const AzureOpenAIService = require('../services/azureOpenAI');
const AzureOpenAIEmbeddingsService = require('../services/azureOpenAIEmbeddings');
const retrievalHelper = require('./retrievalHelper');
const { RAG_DEFAULTS } = require('../constants/rag');

/**
 * RAG Embedded Search Service
 *
 * Provides vector similarity search functionality using Azure OpenAI embeddings
 * and MongoDB Atlas Vector Search.
 */
class EmbeddedSearchService {
  constructor() {
    // Initialize Azure OpenAI for chat completions (for RAG generation)
    try {
      this.azureOpenAI = new AzureOpenAIService();
    } catch (error) {
      console.warn('Azure OpenAI chat service not initialized.');
      this.azureOpenAI = null;
    }

    // Initialize Azure OpenAI Embeddings service (separate deployment)
    try {
      this.embeddingsService = new AzureOpenAIEmbeddingsService();
      if (!this.embeddingsService.hasValidConfig) {
        console.warn('Azure OpenAI Embeddings not initialized. Embedding generation will not be available.');
        console.warn('Set AZURE_OPENAI_EMBEDDINGS_ENDPOINT and AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT_NAME to enable embeddings.');
        this.embeddingsService = null;
      }
    } catch (error) {
      console.warn('Azure OpenAI Embeddings service initialization failed:', error.message);
      this.embeddingsService = null;
    }

    // Configuration with defaults
    this.config = {
      VECTOR_SEARCH_INDEX: global.appConfig?.VECTOR_SEARCH_INDEX ||
                           process.env.VECTOR_SEARCH_INDEX ||
                           'embedded',
      NUM_CANDIDATES_MULTIPLIER: RAG_DEFAULTS.NUM_CANDIDATES_MULTIPLIER,
      MAX_CANDIDATES: RAG_DEFAULTS.MAX_CANDIDATES
    };
  }

  /**
   * Generate embedding for a query using Azure OpenAI Embeddings
   * @param {string} text - Text to generate embedding for
   * @param {string} chunker - Chunker type (to determine which embedding model to use)
   * @returns {Promise<Array<number>>} Embedding vector
   */
  async generateEmbedding(text, chunker = null) {
    if (!text || typeof text !== 'string') {
      throw new Error('Text must be a non-empty string');
    }

    if (!this.embeddingsService) {
      throw new Error('Azure OpenAI Embeddings service not initialized. Check your configuration.');
    }

    try {
      // Use text-embedding-3-large for non-default chunkers (3072 dimensions)
      const isDefaultChunker = !chunker || chunker === 'DEFAULT-1024T';

      if (!isDefaultChunker) {
        // Non-default chunkers require text-embedding-3-large
        if (!this.embeddingsService.has3LargeConfig) {
          throw new Error(`text-embedding-3-large not configured. Required for chunker: ${chunker}. Please set AZURE_OPENAI_EMBEDDINGS_3_LARGE_ENDPOINT`);
        }
        console.log(`Using text-embedding-3-large (3072D) for chunker: ${chunker}`);
        return await this.embeddingsService.generateEmbedding3Large(text.trim());
      } else {
        // Use text-embedding-ada-002 for default chunker (1536 dimensions)
        return await this.embeddingsService.generateEmbedding(text.trim());
      }
    } catch (error) {
      console.error('Error generating embedding:', error.message);
      throw error;
    }
  }

  /**
   * Create filter object for MongoDB query
   * @param {Array<string>} contentTypes - Content types to filter by
   * @param {string} chunker - Chunker type to filter by (optional)
   * @returns {Object} MongoDB filter object
   */
  getFilter(contentTypes = [], chunker = null) {
    const defaultTypes = ['CAMP', 'COURSE', 'FLEX_CAMP', 'FSLE', 'READ', 'RHEINGOLD', 'TUTORIAL'];
    const types = (contentTypes && contentTypes.length > 0) ? contentTypes : defaultTypes;

    const filter = {
      contentType: { $in: types },
      $or: [
        { contentType: { $ne: 'READ' } },
        { contentType: 'READ', isArchetype: true }
      ]
    };

    // Add chunker filter if specified
    if (chunker && chunker.trim() !== '') {
      filter.chunker = chunker;
    }

    return filter;
  }

  /**
   * Normalize search result scores with time-based penalty
   * @param {Array<Object>} results - Search results
   * @returns {Array<Object>} Results with normalized scores
   */
  normalizeScores(results) {
    if (!results || results.length === 0) {
      return results;
    }

    return results.map(result => {
      const datePenalty = this.timeCorrectionFactor(result.sortDate);
      const normalized = result.score - datePenalty;

      return {
        ...result,
        normalizedScore: normalized
      };
    });
  }

  /**
   * Calculate time-based correction factor for search relevance
   * Older content gets a penalty to favor more recent content
   * @param {Date|string} date - Date to calculate penalty for
   * @returns {number} Penalty value (0 to 1)
   */
  timeCorrectionFactor(date) {
    if (!date) return 0;

    try {
      const contentDate = new Date(date);
      const now = new Date();
      const ageInDays = (now - contentDate) / (1000 * 60 * 60 * 24);

      // Apply exponential decay: older content gets higher penalty
      // Content older than 365 days gets maximum penalty of ~0.3
      const penalty = Math.min(0.3, (1 - Math.exp(-ageInDays / 365)) * 0.3);

      return penalty;
    } catch (error) {
      console.error('Error calculating time correction factor:', error.message);
      return 0;
    }
  }

  /**
   * Create MongoDB aggregation pipeline for vector search
   * @param {Array<number>} embeddedQuery - Query embedding vector
   * @param {Object} filter - MongoDB filter object
   * @param {Object} $project - Projection object
   * @param {number} page - Page number (1-based)
   * @param {number} size - Page size
   * @returns {Array<Object>} MongoDB aggregation pipeline
   */
  createEmbeddedSearchQuery(embeddedQuery, filter, $project, page = 1, size) {
    const pageSize = size;
    const skip = (page - 1) * pageSize;

    const searchQuery = [
      {
        $vectorSearch: {
          index: this.config.VECTOR_SEARCH_INDEX,
          path: 'similarities',
          queryVector: embeddedQuery,
          numCandidates: pageSize * this.config.NUM_CANDIDATES_MULTIPLIER,
          limit: pageSize,
          filter: filter,
        }
      },
    ];

    const addScoreField = [
      { $addFields: { score: { $meta: 'vectorSearchScore' } } }
    ];

    const project = [{ $project }];

    // Handle pagination by skipping results if not on first page
    const pipeline = [...searchQuery, ...addScoreField];

    if (skip > 0) {
      pipeline.push({ $skip: skip });
    }

    pipeline.push(...project);

    return pipeline;
  }

  /**
   * Execute database query using aggregation pipeline
   * @param {Object} db - MongoDB database connection
   * @param {string} collectionName - Name of collection to query
   * @param {Array<Object>} pipeline - Aggregation pipeline
   * @returns {Promise<Array<Object>>} Query results
   */
  async runQuery(db, collectionName, pipeline) {
    try {
      const collection = db.collection(collectionName);
      const results = await collection.aggregate(pipeline).toArray();
      return results;
    } catch (error) {
      console.error(`Error running query on ${collectionName}:`, error.message);
      throw error;
    }
  }

  /**
   * Perform embedded search on the database
   * @param {Object} db - MongoDB database connection
   * @param {string} query - Search query text
   * @param {Object} context - Additional context (unused currently, for future expansion)
   * @param {Object} filters - Filter options
   * @param {Array<string>} filters.contentTypes - Content types to filter by
   * @param {string} filters.chunker - Chunker type to filter by (optional)
   * @param {string} filters.indexBrandName - Brand name filter (unused currently)
   * @param {Array<string>} filters.indexSeriesNames - Series names filter (unused currently)
   * @param {Array<string>} filters.categories - Categories filter (unused currently)
   * @param {Array<number>} filters.years - Years filter (unused currently)
   * @param {Array<string>} filters.designations - Designations filter (unused currently)
   * @param {Array<string>} filters.parentIds - Parent IDs filter (unused currently)
   * @param {number} page - Page number (1-based, default: 1)
   * @param {number} size - Page size (default: from config)
   * @returns {Promise<Array<Object>|null>} Search results with normalized scores, or null if invalid input
   */
  async embeddedSearch(db, query, context = {}, filters = {}, page = 1, size) {
    // Validate input
    if (!db || !query) {
      console.warn('EmbeddedSearch: Missing required parameters (db or query)');
      return null;
    }

    try {
      // Extract filters first (we need chunker to determine which embedding model to use)
      const { contentTypes, chunker } = filters;

      // Generate embedding for the query using appropriate model based on chunker
      const embeddedQuery = await this.generateEmbedding(query.trim(), chunker);

      // Special handling for DEFAULT-1024T: use pocEmbeddings collection and skip chunker filter
      const isDefault1024T = chunker && (chunker === 'DEFAULT-1024T' || chunker === 'DEFAULT-1024T');
      const collectionName = isDefault1024T ? 'pocEmbeddings' : 'chunks';
      const chunkerFilter = isDefault1024T ? null : chunker;

      // For DEFAULT-1024T: get pocIds from chunkAuditPocs collection if useAuditedPocsOnly is true
      const useAuditedPocsOnly = filters.useAuditedPocsOnly !== undefined ? filters.useAuditedPocsOnly : true;
      const auditedPocIds = await retrievalHelper.getAuditedPocIds(db, chunker, useAuditedPocsOnly);

      // Create MongoDB filter (no chunker filter for DEFAULT-1024T)
      const filter = this.getFilter(contentTypes, chunkerFilter);

      // Add pocId filter for DEFAULT-1024T chunker (using audited pocIds)
      if (auditedPocIds.length > 0) {
        filter.pocId = { $in: auditedPocIds };
      }

      // Define projection (exclude the embedding vector from results)
      const $project = { similarities: 0 };

      // Create aggregation pipeline
      const aggregations = this.createEmbeddedSearchQuery(embeddedQuery, filter, $project, page, size);

      // Execute query on appropriate collection
      const results = await this.runQuery(db, collectionName, aggregations);

      // Normalize scores with time-based penalty
      return this.normalizeScores(results);
    } catch (error) {
      console.error('Error in embeddedSearch:', error.message);
      throw error;
    }
  }
}

// Export singleton instance
const embeddedSearchService = new EmbeddedSearchService();

module.exports = embeddedSearchService;

