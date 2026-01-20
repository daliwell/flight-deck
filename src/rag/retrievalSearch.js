const retrievalHelper = require('./retrievalHelper');
const { RAG_DEFAULTS } = require('../constants/rag');

/**
 * Retrieval Search Service
 *
 * Provides keyword-based search functionality using MongoDB Atlas Search
 * with text indexing and phrase matching.
 */
class RetrievalSearchService {
  constructor() {
    // Configuration with defaults
    this.config = {
      RETRIEVAL_NORMALIZATION_RANGE: global.appConfig?.RETRIEVAL_NORMALIZATION_RANGE ||
                                      process.env.RETRIEVAL_NORMALIZATION_RANGE ||
                                      100,
      RETRIEVAL_SEARCH_INDEX: global.appConfig?.RETRIEVAL_SEARCH_INDEX ||
                              process.env.RETRIEVAL_SEARCH_INDEX ||
                              'retrieval'
    };
  }

  /**
   * Perform retrieval search on the database
   * @param {Object} db - MongoDB database connection
   * @param {Object} args - Search arguments
   * @param {string} args.question - Search question/query
   * @param {number} args.PAGE - Page number (default: 1)
   * @param {number} args.PAGE_SIZE - Page size (default: from config)
   * @param {Object} context - Application context (app, platform, user)
   * @param {Object} filters - Filter options
   * @param {Array<string>} filters.contentTypes - Content types to filter by
   * @param {Array<number>} filters.years - Years to filter by
   * @param {Array<string>} filters.parentIds - Parent IDs to filter by
   * @param {Array<string>} filters.excludedPocIds - POC IDs to exclude
   * @param {string} filters.indexBrandName - Brand name filter
   * @param {Array<string>} filters.indexBrandContentTypes - Brand content types filter
   * @param {Array<string>} filters.indexSeriesNames - Series names filter
   * @param {Array<string>} filters.categories - Categories filter
   * @param {Array<string>} filters.primaryVersions - Primary versions filter
   * @param {Array<string>} filters.secondaryVersions - Secondary versions filter
   * @param {boolean} filters.extraAttendeeFilters - Whether to apply attendee filters
   * @returns {Promise<Array<Object>|null>} Search results with normalized scores
   */
  async retrieval(db, args, context = {}, filters = {}) {
    try {
      let question = args.question.toLowerCase();
      const {
        indexBrandName,
        indexBrandContentTypes = [],
        indexSeriesNames,
        categories,
        contentTypes,
        years = [],
        primaryVersions = [],
        secondaryVersions = [],
        designations,
        parentIds,
        excludedPocIds,
        extraAttendeeFilters,
        chunker
      } = filters;

      // For DEFAULT-1024T: get pocIds from chunkAuditPocs collection if useAuditedPocsOnly is true
      const useAuditedPocsOnly = filters.useAuditedPocsOnly !== undefined ? filters.useAuditedPocsOnly : true;
      const auditedPocIds = await retrievalHelper.getAuditedPocIds(db, chunker, useAuditedPocsOnly);

      // Special handling for DEFAULT-1024T: skip chunker filter
      const chunkerFilter = (chunker === 'DEFAULT-1024T') ? null : chunker;

      // Build query components with chunker filter (null for DEFAULT-1024T)
      const mustArray = this.createMustArray(
        contentTypes,
        years,
        parentIds,
        [],
        indexBrandContentTypes,
        chunkerFilter
      );

      let mustNotArray;
      if (excludedPocIds && excludedPocIds.length > 0) {
        mustNotArray = this.createMustNotArray(excludedPocIds);
      }

      const shouldArray = this.createShouldArray(
        question,
        indexBrandName,
        indexSeriesNames,
        categories,
        primaryVersions,
        secondaryVersions
      );

      // Return null if no valid query components
      if (mustArray.length === 0 && (!mustNotArray || mustNotArray.length === 0) && shouldArray.length === 0) {
        return null;
      }

      // Define projection (exclude the embedding vector from results)
      const $project = { similarities: 0 };

      // Create aggregation pipeline
      const page = args.PAGE || 1;
      const pageSize = args.PAGE_SIZE;
      const aggregations = this.createRetrievalSearchQuery(
        question,
        mustArray,
        mustNotArray,
        shouldArray,
        $project,
        page,
        pageSize,
        context,
        !!extraAttendeeFilters,
        chunkerFilter,
        auditedPocIds
      );

      // Special handling for DEFAULT-1024T: use pocEmbeddings collection
      const collectionName = (chunker === 'DEFAULT-1024T') ? 'pocEmbeddings' : 'chunks';

      // Execute query on appropriate collection
      const results = await this.runQuery(db, collectionName, aggregations);

      // Reorder results: chunk by 12, sort each chunk by date descending
      const chunks = this.chunkArray(results, 12);
      const reorderedResults = [];
      for (const chunk of chunks) {
        const sorted = chunk.sort((a, b) => {
          const dateA = new Date(a.sortDate);
          const dateB = new Date(b.sortDate);
          return dateB - dateA; // Descending order
        });
        reorderedResults.push(...sorted);
      }

      // Normalize scores
      return this.normalizeScores(reorderedResults);
    } catch (error) {
      console.error('Error in retrieval search:', error.message);
      throw error;
    }
  }

  /**
   * Create must array for MongoDB compound query
   * @param {Array<string>} contentTypes - Content types
   * @param {Array<number>} years - Years
   * @param {Array<string>} parentIds - Parent IDs
   * @param {Array<string>} expertIds - Expert IDs
   * @param {Array<string>} indexBrandContentTypes - Brand content types
   * @param {string} chunker - Chunker type to filter by (optional)
   * @returns {Array<Object>} Must array for compound query
   */
  createMustArray(contentTypes, years, parentIds, expertIds, indexBrandContentTypes = [], chunker = null) {
    const mustArray = [];

    if (contentTypes && contentTypes.length > 0) {
      mustArray.push({
        text: {
          query: contentTypes,
          path: 'contentType',
        }
      });
    }

    if (years && years.length > 0) {
      mustArray.push({
        text: {
          query: years.map(String),
          path: 'sortYear',
        }
      });
    }

    if (expertIds && expertIds.length > 0) {
      mustArray.push({
        text: {
          query: expertIds,
          path: 'experts._id',
        }
      });
    }


    if (parentIds && parentIds.length > 0) {
      mustArray.push({
        text: {
          query: parentIds,
          path: 'parentId',
        }
      });
    }

    if ((!contentTypes || contentTypes.length === 0) && indexBrandContentTypes.length > 0) {
      mustArray.push({
        text: {
          query: indexBrandContentTypes,
          path: 'contentType',
        }
      });
    }

    return mustArray;
  }

  /**
   * Create must not array for MongoDB compound query
   * @param {Array<string>} excludedPocIds - POC IDs to exclude
   * @returns {Array<Object>} Must not array for compound query
   */
  createMustNotArray(excludedPocIds) {
    const mustNotArray = [];

    if (excludedPocIds && excludedPocIds.length > 0) {
      mustNotArray.push({
        text: {
          query: excludedPocIds,
          path: 'pocId',
        }
      });
    }

    return mustNotArray;
  }

  /**
   * Create should array for MongoDB compound query
   * @param {string} question - Search question
   * @param {string} indexBrandName - Brand name
   * @param {Array<string>} indexSeriesNames - Series names
   * @param {Array<string>} categories - Categories
   * @param {Array<string>} primaryVersions - Primary versions
   * @param {Array<string>} secondaryVersions - Secondary versions
   * @returns {Array<Object>} Should array for compound query
   */
  createShouldArray(question, indexBrandName, indexSeriesNames, categories, primaryVersions = [], secondaryVersions = []) {
    const shouldArray = [];

    if (question) {
      shouldArray.push(...[
        {
          text: {
            query: question,
            path: 'expertSearchNames',
            fuzzy: { maxEdits: 1 },
            score: { boost: { value: 14.0 } }
          }
        },
        {
          text: {
            query: question,
            path: ['title', 'subtitle', 'abstract'],
            fuzzy: { maxEdits: 1 },
            score: { boost: { value: 6.0 } }
          }
        },
        {
          text: {
            query: question,
            path: 'parentDescription',
            fuzzy: { maxEdits: 1 },
            score: { boost: { value: 1.2 } }
          }
        },
        {
          text: {
            query: question,
            path: 'text',
            fuzzy: { maxEdits: 1 },
            score: { boost: { value: 1.0 } }
          }
        },
        {
          phrase: {
            query: question,
            path: ['title', 'subtitle', 'abstract'],
            slop: 9,
            score: { boost: { value: 6.0 } }
          }
        },
        {
          phrase: {
            query: question,
            path: 'parentDescription',
            slop: 9,
            score: { boost: { value: 1.2 } }
          }
        },
        {
          phrase: {
            query: question,
            path: 'expertSearchNames',
            slop: 1,
            score: { boost: { value: 14.0 } }
          }
        },
        {
          phrase: {
            query: question,
            path: 'text',
            slop: 9,
            score: { boost: { value: 1.0 } }
          }
        }
      ]);
    }

    if (indexBrandName) {
      shouldArray.push({
        text: {
          query: indexBrandName,
          path: 'indexBrandName',
          score: { boost: { value: 100.0 } }
        }
      });
    }

    if (indexSeriesNames && indexSeriesNames.length > 0) {
      for (const seriesName of indexSeriesNames) {
        shouldArray.push({
          text: {
            query: seriesName,
            path: 'indexSeriesName',
            score: { boost: { value: 55.0 } }
          }
        });
      }
    }

    if (categories && categories.length > 0) {
      shouldArray.push({
        text: {
          query: categories,
          path: 'primaryCategoryNames',
          score: { boost: { value: 6.0 } }
        }
      });
      shouldArray.push({
        phrase: {
          query: categories,
          path: 'primaryCategoryNames',
          slop: 9,
          score: { boost: { value: 6.0 } }
        }
      });
      shouldArray.push({
        text: {
          query: categories,
          path: 'secondaryCategoryNames',
          score: { boost: { value: 2.0 } }
        }
      });
      shouldArray.push({
        phrase: {
          query: categories,
          path: 'secondaryCategoryNames',
          slop: 9,
          score: { boost: { value: 2.0 } }
        }
      });
      shouldArray.push({
        text: {
          query: categories,
          path: 'tertiaryCategoryNames',
          score: { boost: { value: 1.0 } }
        }
      });
      shouldArray.push({
        phrase: {
          query: categories,
          path: 'tertiaryCategoryNames',
          slop: 9,
          score: { boost: { value: 1.0 } }
        }
      });
    }

    if (primaryVersions && primaryVersions.length > 0) {
      shouldArray.push({
        text: {
          query: primaryVersions,
          path: ['title', 'subtitle', 'abstract'],
          score: { boost: { value: 5.0 } }
        }
      });
    }

    if (secondaryVersions && secondaryVersions.length > 0) {
      shouldArray.push({
        text: {
          query: secondaryVersions,
          path: ['title', 'subtitle', 'abstract'],
          score: { boost: { value: 5.0 } }
        }
      });
    }

    return shouldArray;
  }

  /**
   * Create MongoDB aggregation pipeline for retrieval search
   * @param {string} question - Search question
   * @param {Array<Object>} mustArray - Must array for compound query
   * @param {Array<Object>} mustNotArray - Must not array for compound query
   * @param {Array<Object>} shouldArray - Should array for compound query
   * @param {Object} $project - Projection object
   * @param {number} page - Page number
   * @param {number} size - Page size
   * @param {Object} context - Application context
   * @param {boolean} extraAttendeeFilters - Whether to apply attendee filters
   * @param {string} chunker - Chunker type to filter by (optional, null to skip)
   * @param {Array<string>} auditedPocIds - Array of pocIds from pocAuditPocs collection (for DEFAULT-1024T)
   * @returns {Array<Object>} MongoDB aggregation pipeline
   */
  createRetrievalSearchQuery(question, mustArray, mustNotArray, shouldArray, $project, page, size, context, extraAttendeeFilters = false, chunker = null, auditedPocIds = []) {
    const compound = {
      must: mustArray,
      should: shouldArray,
      minimumShouldMatch: shouldArray.length === 0 ? 0 : 1
    };

    if (mustNotArray && mustNotArray.length > 0) {
      compound.mustNot = mustNotArray;
    }

    const searchQuery = [
      {
        $search: {
          index: this.config.RETRIEVAL_SEARCH_INDEX,
          compound
        }
      }
    ];

    // Add exact match filter for chunker after search (not indexed in Atlas Search)
    const chunkerFilter = [];
    if (chunker && chunker.trim() !== '') {
      chunkerFilter.push({ $match: { chunker: chunker } });
    }

    // Add pocId filter for DEFAULT-1024T chunker (using audited pocIds)
    const pocIdFilter = [];
    if (auditedPocIds.length > 0) {
      pocIdFilter.push({ $match: { pocId: { $in: auditedPocIds } } });
    }

    const supportedAppsFilter = this.getSupportedAppsFilter(context);
    const archetypeOnlyFilter = this.getArchetypeOnlyFilter(context);
    const attendeeFilter = extraAttendeeFilters ? this.getAttendeeFilter(context) : [];
    const addScoreField = [{ $addFields: { score: { $meta: 'searchScore' } } }];
    const pagination = [{ $skip: (page - 1) * size }, { $limit: size }];
    const project = [{ $project }];

    return [
      ...searchQuery,
      ...chunkerFilter,
      ...pocIdFilter,
      ...supportedAppsFilter,
      ...archetypeOnlyFilter,
      ...attendeeFilter,
      ...addScoreField,
      ...pagination,
      ...project
    ];
  }

  /**
   * Get supported apps filter for MongoDB pipeline
   * @param {Object} context - Application context
   * @returns {Array<Object>} Filter stages
   */
  getSupportedAppsFilter(context) {
    const filter = [];
    if (context.platform && context.app) {
      filter.push({ $match: { supportedApps: { $in: [context.app.toUpperCase()] } } });
    }
    return filter;
  }

  /**
   * Get archetype only filter for MongoDB pipeline
   * @param {Object} context - Application context
   * @returns {Array<Object>} Filter stages
   */
  getArchetypeOnlyFilter(context) {
    const filter = [];
    if (context.platform && context.app) {
      filter.push({
        $match: {
          $or: [
            { contentType: { $ne: 'READ' } },
            { contentType: 'READ', isArchetype: true },
          ]
        }
      });
    }
    return filter;
  }

  /**
   * Get attendee filter for MongoDB pipeline
   * @param {Object} context - Application context
   * @returns {Array<Object>} Filter stages
   */
  getAttendeeFilter(context) {
    const filter = [];
    if (context.user) {
      filter.push({
        $match: {
          $or: [
            { contentType: { $in: ['RHEINGOLD', 'FLEX_CAMP', 'CAMP'] }, sortDate: { $gte: new Date() } },
            { contentType: { $in: ['FLEX_CAMP', 'CAMP'] }, sortDate: { $lt: new Date() }, parentId: { $in: context.user.myCourseIds || [] } },
            { contentType: 'RHEINGOLD', sortDate: { $lt: new Date() }, parentId: { $in: context.user.videoAccessCourseIds || [] } },
            { contentType: { $nin: ['RHEINGOLD', 'FLEX_CAMP', 'CAMP'] } },
          ]
        }
      });
    }
    return filter;
  }

  /**
   * Normalize search result scores
   * @param {Array<Object>} results - Search results
   * @returns {Array<Object>} Results with normalized scores
   */
  normalizeScores(results) {
    if (!results || results.length === 0) {
      return results;
    }

    return results.map(result => {
      // const normalized = result.score / this.config.RETRIEVAL_NORMALIZATION_RANGE;
      return {
        ...result,
        beforeDatePenaltyScore: result.score,
        normalizedScore: result.score,
      };
    });
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
   * Helper method to chunk array into smaller arrays
   * @param {Array} array - Array to chunk
   * @param {number} size - Size of each chunk
   * @returns {Array<Array>} Array of chunks
   */
  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

// Export singleton instance
const retrievalSearchService = new RetrievalSearchService();

module.exports = retrievalSearchService;

