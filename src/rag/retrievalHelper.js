const _ = require('lodash');
const AzureOpenAIService = require('../services/azureOpenAI');
const GraphQLUserService = require('../services/graphqlUserService');
const faustService = require('../services/graphqlFaustService');
const PromptService = require('./prompt');

/**
 * Retrieval Helper Service
 *
 * Provides helper functions for keyword extraction, filter generation,
 * and synonym lookup for retrieval search.
 */
class RetrievalHelperService {
  constructor() {
    // Initialize Azure OpenAI for keyword extraction
    try {
      this.azureOpenAI = new AzureOpenAIService();
    } catch (error) {
      console.warn('Azure OpenAI service not initialized for keyword extraction.');
      this.azureOpenAI = null;
    }

    // Initialize GraphQL User Service
    try {
      this.graphqlUserService = new GraphQLUserService();
    } catch (error) {
      console.warn('GraphQL User Service not initialized for retrieval helper.');
      this.graphqlUserService = null;
    }

    // Initialize Prompt Service for keyword extraction prompts
    this.promptService = new PromptService();
  }

  /**
   * Extract keywords from question using LLM
   * @param {string} question - Question to extract keywords from
   * @returns {Promise<string>} JSON string with extracted keywords
   */
  async getKeywords(question) {
    if (!this.azureOpenAI || !this.azureOpenAI.hasValidConfig) {
      console.warn('Azure OpenAI not available for keyword extraction');
      // Return a basic fallback structure
      return JSON.stringify({
        phrase_out: question,
        year_array: [],
        primary_version_array: [],
        secondary_version_array: [],
        issue_array: []
      });
    }

    const today = new Date().toISOString().split('T')[0];

    // Use PromptService to generate prompts
    const systemPrompt = this.promptService.getKeywordSystemPrompt(today);
    const userPrompt = this.promptService.getKeywordUserPrompt(question, today);

    const prompt = [
      {
        role: 'system',
        content: [
          {
            type: 'text',
            text: systemPrompt
          }
        ]
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: userPrompt
          }
        ]
      }
    ];

    try {
      const response = await this.azureOpenAI.getFullResponse(prompt);
      console.debug('Keyword extraction response:', JSON.stringify(response, null, 2));
      return response.trim();
    } catch (error) {
      console.error('Error getting keywords:', error.message);
      // Return fallback
      return JSON.stringify({
        phrase_out: question,
        year_array: [],
        primary_version_array: [],
        secondary_version_array: [],
        issue_array: []
      });
    }
  }

  /**
   * Detect language from question using LLM
   * @param {string} question - Question to detect language from
   * @returns {Promise<string>} Detected language code
   */
  async getLanguage(question) {
    if (!this.azureOpenAI || !this.azureOpenAI.hasValidConfig) {
      console.warn('Azure OpenAI not available for language detection');
      // Return default language
      return 'en';
    }

    // Use PromptService to generate prompt
    const languagePrompt = this.promptService.getLanguagePrompt(question);

    const prompt = [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: languagePrompt
          }
        ]
      }
    ];

    try {
      const response = await this.azureOpenAI.getFullResponse(prompt);
      console.debug('Language detection response:', response);
      return response.trim();
    } catch (error) {
      console.error('Error detecting language:', error.message);
      // Return default language
      return 'en';
    }
  }

  /**
   * Get filters for search query
   * @param {Object} db - MongoDB database connection
   * @param {Object|string} keywords - Keywords object or string
   * @param {Object} context - Application context
   * @param {boolean} isTest - Test mode flag
   * @param {boolean} isRag - RAG mode flag
   * @returns {Promise<Object>} Filter object with all filter arrays
   */
  async getFilters(db, keywords, context, isTest = false, isRag = false) {
    const question = isRag ? keywords['phrase_out'] : keywords;
    const subPhrases = this.generateOrderedSubPhrases(this.escapeRegExp(question));

    const indexBrandName = await this.getIndexBrandName(db, subPhrases);
    const indexBrandContentTypes = await this.getIndexBrandContentTypes(db, subPhrases);
    const indexSeriesNames = await this.getIndexSeriesNames(db, subPhrases);
    const categories = this.unique(await this.getCategories(db, subPhrases));
    const contentTypes = this.unique(await this.getContentTypes(db, subPhrases));
    const years = this.unique(isRag ? this.toStringArray(keywords['year_array'] || []) : this.getYears(subPhrases));
    const primaryVersions = this.unique(isRag ? this.toStringArray(keywords['primary_version_array'] || []) : []);
    let secondaryVersions = this.unique(isRag ? this.toStringArray(keywords['secondary_version_array'] || []) : []);
    secondaryVersions = this.difference(secondaryVersions, primaryVersions);

    let designations = [];
    if (contentTypes.indexOf('READ') !== -1) {
      designations = this.unique(isRag ? (keywords['issue_array'] || []) : await this.getDesignations(db, subPhrases));
    }

    const parentIds = this.unique(await this.getParentIds(db, context, designations));

    return {
      indexBrandName,
      indexBrandContentTypes,
      indexSeriesNames,
      categories,
      contentTypes,
      years,
      primaryVersions,
      secondaryVersions,
      designations,
      parentIds
    };
  }

  /**
   * Generate ordered sub-phrases from question
   * @param {string} question - Question to generate sub-phrases from
   * @returns {Array<string>} Array of sub-phrases
   */
  generateOrderedSubPhrases(question) {
    const words = question.trim().split(/\s+/);
    const subPhrases = [];

    for (let start = 0; start < words.length; start++) {
      let phrase = '';
      for (let end = start; end < words.length; end++) {
        phrase = phrase ? `${phrase} ${words[end]}` : words[end];
        subPhrases.push(phrase.toLowerCase());
      }
    }

    return subPhrases;
  }

  /**
   * Get index brand name from synonyms
   * @param {Object} db - MongoDB database connection
   * @param {Array<string>} phrases - Sub-phrases to search
   * @returns {Promise<string|null>} Brand name or null
   */
  async getIndexBrandName(db, phrases) {
    const regexQueries = phrases.map(phrase => ({
      synonyms: { $regex: new RegExp(`^${phrase}$`, 'i') }
    }));

    const $match = {
      type: 'BRAND',
      $or: regexQueries
    };

    const results = await this.runQuery(db, 'pieceOfContentsSynonyms', [{ $match }]);
    return results.length > 0 ? results[0].return : null;
  }

  /**
   * Get index brand content types from synonyms
   * @param {Object} db - MongoDB database connection
   * @param {Array<string>} phrases - Sub-phrases to search
   * @returns {Promise<Array<string>>} Brand content types
   */
  async getIndexBrandContentTypes(db, phrases) {
    const regexQueries = phrases.map(phrase => ({
      synonyms: { $regex: new RegExp(`^${phrase}$`, 'i') }
    }));

    const $match = {
      type: 'BRAND',
      $or: regexQueries
    };

    const results = await this.runQuery(db, 'pieceOfContentsSynonyms', [{ $match }]);
    return results.length > 0 && results[0].contentTypes ? results[0].contentTypes : [];
  }

  /**
   * Get index series names from synonyms
   * @param {Object} db - MongoDB database connection
   * @param {Array<string>} phrases - Sub-phrases to search
   * @returns {Promise<Array<string>>} Series names
   */
  async getIndexSeriesNames(db, phrases) {
    const regexQueries = phrases.map(phrase => ({
      synonyms: { $regex: new RegExp(`^${phrase}$`, 'i') }
    }));

    const $match = {
      type: 'NORMALIZED_SERIES',
      $or: regexQueries
    };

    const results = await this.runQuery(db, 'pieceOfContentsSynonyms', [{ $match }]);
    return results.map(synonym => synonym.return);
  }

  /**
   * Get categories from synonyms
   * @param {Object} db - MongoDB database connection
   * @param {Array<string>} phrases - Sub-phrases to search
   * @returns {Promise<Array<string>>} Categories
   */
  async getCategories(db, phrases) {
    const regexQueries = phrases.map(phrase => ({
      synonyms: { $regex: new RegExp(`^${phrase}$`, 'i') }
    }));

    const $match = {
      type: 'CATEGORY',
      $or: regexQueries
    };

    const results = await this.runQuery(db, 'pieceOfContentsSynonyms', [{ $match }]);
    return results.map(synonym => synonym.return);
  }

  /**
   * Get content types from synonyms
   * @param {Object} db - MongoDB database connection
   * @param {Array<string>} phrases - Sub-phrases to search
   * @returns {Promise<Array<string>>} Content types
   */
  async getContentTypes(db, phrases) {
    const regexQueries = phrases.map(phrase => ({
      synonyms: { $regex: new RegExp(`^${phrase}$`, 'i') }
    }));

    const $match = {
      type: 'CONTENT_TYPE',
      $or: regexQueries
    };

    const results = await this.runQuery(db, 'pieceOfContentsSynonyms', [{ $match }]);
    return results.map(synonym => synonym.return);
  }

  /**
   * Extract years from phrases
   * @param {Array<string>} phrases - Sub-phrases to search
   * @returns {Array<string>} Years as strings
   */
  getYears(phrases) {
    const years = [];
    const yearPattern = /\b\d{4}\b/;

    phrases.forEach(phrase => {
      if (yearPattern.test(phrase)) {
        const foundYears = phrase.match(yearPattern);
        if (foundYears) {
          years.push(...foundYears);
        }
      }
    });

    return years;
  }

  /**
   * Extract numbers from phrases
   * @param {Array<string>} phrases - Sub-phrases to search
   * @returns {Array<string>} Numbers as strings
   */
  getNumbers(phrases) {
    const numbers = [];
    const numberPattern = /\b\d+\b/g;

    phrases.forEach(phrase => {
      const foundNumbers = phrase.match(numberPattern);
      if (foundNumbers) {
        numbers.push(...foundNumbers);
      }
    });

    return numbers;
  }

  /**
   * Get designations from synonyms
   * @param {Object} db - MongoDB database connection
   * @param {Array<string>} phrases - Sub-phrases to search
   * @returns {Promise<Array<string>>} Designations
   */
  async getDesignations(db, phrases) {
    const regexQueries = phrases.map(phrase => ({
      synonyms: { $regex: new RegExp(`^${phrase}$`, 'i') }
    }));

    const $match = {
      type: 'DESIGNATION',
      $or: regexQueries
    };

    const results = await this.runQuery(db, 'pieceOfContentsSynonyms', [{ $match }]);
    return results.map(synonym => synonym.return);
  }

  /**
   * Get parent IDs based on designations
   * @param {Object} db - MongoDB database connection
   * @param {Object} context - Application context
   * @param {Array<string>} designations - Designations to lookup
   * @returns {Promise<Array<string>>} Parent IDs
   */
  async getParentIds(db, context, designations) {
    if (!designations || designations.length === 0) {
      return [];
    }

    try {
      // Use faustService to get categories for the designations
      const categories = await faustService.getCategories(designations, context);
      return categories.map(cat => cat._id).filter(id => id);
    } catch (error) {
      console.error('Error getting parent IDs from faustService:', error.message);
      return [];
    }
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
   * Convert array to string array
   * @param {Array} arr - Array to convert
   * @returns {Array<string>} String array
   */
  toStringArray(arr) {
    if (!Array.isArray(arr)) return [];
    return arr.map(String);
  }

  /**
   * Escape special regex characters
   * @param {string} string - String to escape
   * @returns {string} Escaped string
   */
  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Get unique values from array
   * @param {Array} arr - Array to deduplicate
   * @returns {Array} Array with unique values
   */
  unique(arr) {
    return [...new Set(arr)];
  }

  /**
   * Get difference between two arrays
   * @param {Array} arr1 - First array
   * @param {Array} arr2 - Second array
   * @returns {Array} Values in arr1 but not in arr2
   */
  difference(arr1, arr2) {
    return arr1.filter(item => !arr2.includes(item));
  }

  /**
   * Fetch user data from GraphQL and check RAG access
   * @param {Object} context - Application context with user information
   * @param {string} question - The search question
   * @param {string} restriction - Access restriction type (default: 'NONE')
   * @returns {Promise<Object|null>} RAG access data or null
   */
  async fetchUserFromGraphQL(context, question = '', restriction = 'NONE') {
    // Check if user email is available and GraphQL service is configured
    if (!context.user || !context.user.email) {
      return null;
    }

    if (!this.graphqlUserService || !this.graphqlUserService.hasValidConfig) {
      console.warn('[Retrieval Helper] GraphQL User Service not configured');
      return null;
    }

    try {
      console.log(`[Retrieval Helper] Fetching user data for email: ${context.user.email}`);

      // Step 1: Get user by email to retrieve user ID
      const graphqlUser = await this.graphqlUserService.findUserByEmail(context.user.email);

      if (!graphqlUser) {
        console.log('[Retrieval Helper] No user found in GraphQL for email:', context.user.email);
        return null;
      }

      context.user = graphqlUser;
      // Step 2: Check if user can access RAG
      const ragAccess = await this.graphqlUserService.canUserAccessRag(
        graphqlUser._id,
        restriction,
        question
      );

      // Return the RAG access data
      return ragAccess;

    } catch (error) {
      console.error('[Retrieval Helper] Error fetching user from GraphQL:', error.message);
      return null;
    }
  }

  /**
   * Get audited POC IDs for DEFAULT-1024T chunker
   * @param {Object} db - MongoDB database connection
   * @param {string} chunker - Chunker type
   * @param {boolean} useAuditedPocsOnly - Whether to filter by audited POCs (default: true)
   * @returns {Promise<Array<string>>} Array of audited POC IDs (empty if not applicable)
   */
  async getAuditedPocIds(db, chunker, useAuditedPocsOnly = true) {
    // Only apply for DEFAULT-1024T chunker when useAuditedPocsOnly is true
    if (chunker !== 'DEFAULT-1024T' || !useAuditedPocsOnly) {
      return [];
    }

    try {
      const chunkAuditPocsCollection = db.collection('chunkAuditPocs');
      const auditedPocs = await chunkAuditPocsCollection.find({ contentType: 'READ' }).toArray();
      return auditedPocs.map(poc => poc.pocId);
    } catch (error) {
      console.error('Error fetching audited POC IDs:', error.message);
      return [];
    }
  }

  /**
   * Get brand complex by ID
   * @param {Object} db - MongoDB database connection
   * @param {string} brandComplexId - Brand complex ID to lookup
   * @returns {Promise<Object>} Brand complex object
   */
  async getBrandComplex(db, brandComplexId) {
    try {
      const collection = db.collection('brandComplexes');
      const brandComplex = await collection.findOne({ _id: brandComplexId });
      return brandComplex || {};
    } catch (error) {
      console.error('Error fetching brand complex:', error.message);
      return {};
    }
  }

  /**
   * Get user context for RAG responses
   * @param {Object} user - User object with _id
   * @param {Object} canUserAccessRag - RAG access data from GraphQL
   * @param {Object} db - MongoDB database connection
   * @param {string} app - Application name (e.g., 'ENTWICKLER', 'DEVMIO', 'DEVMIONL')
   * @returns {Promise<Object>} User context object with platform, accessTier, communityExperience, tags, addOnDiscountAmount, addOnDiscountType
   */
  async getUserContext(canUserAccessRag, db, app) {
    let platform = '';
    let communityExperience = '';
    let tags = '';
    let addOnDiscountAmount = '';
    let addOnDiscountType = '';

    const upperApp = _.toUpper(app);
    if (upperApp === 'ENTWICKLER') {
      platform = 'entwickler.de';
    } else if (upperApp === 'DEVMIO') {
      platform = 'devm.io';
    } else if (upperApp === 'DEVMIONL') {
      platform = 'devmio.nl';
    }

    // Handle case where canUserAccessRag might be null or boolean
    if (canUserAccessRag && typeof canUserAccessRag === 'object') {
      if (!_.isEmpty(canUserAccessRag.selectedBrandComplexId)) {
        communityExperience = (await this.getBrandComplex(db, canUserAccessRag.selectedBrandComplexId)).name || '';
      } else if (!_.isEmpty(canUserAccessRag.selectedCategoryIds)) {
        tags = _.join(_.map(await faustService.getCategories(canUserAccessRag.selectedCategoryIds, 'devmio'), 'name'), ',');
      }

      if (canUserAccessRag.numberOfSeats && canUserAccessRag.numberOfSeats > 0) {
        const discountMappingResult = this.discountMapping(canUserAccessRag.accessTier, canUserAccessRag.numberOfSeats);
        addOnDiscountAmount = discountMappingResult.discount || '';
        addOnDiscountType = discountMappingResult.type || '';
      }
    }

    return {
      platform,
      accessTier: canUserAccessRag?.accessTier || null,
      communityExperience,
      tags,
      addOnDiscountAmount,
      addOnDiscountType
    };
  }

  /**
   * Calculate discount based on access tier and number of seats
   * @param {string} type - Access tier type ('elevate' or 'fullstack')
   * @param {number} count - Number of seats
   * @returns {Object} Object with discount and type properties
   */
  discountMapping(type, count) {
    if (type === 'elevate') {
      if (count >= 300) {
        return {
          discount: 25,
          type: 'percent'
        };
      } else if (count >= 100) {
        return {
          discount: 20,
          type: 'percent'
        };
      } else if (count >= 50) {
        return {
          discount: 15,
          type: 'percent'
        };
      } else if (count >= 16) {
        return {
          discount: 10,
          type: 'percent'
        };
      }
    } else if (type === 'fullstack') {
      if (count === 1) {
        return {
          discount: 100,
          type: 'fixed'
        };
      } else if (count === 3) {
        return {
          discount: 150,
          type: 'fixed'
        };
      } else if (count === 5) {
        return {
          discount: 200,
          type: 'fixed'
        };
      } else if (count >= 10) {
        return {
          discount: 250,
          type: 'fixed'
        };
      } else if (count >= 15) {
        return {
          discount: 300,
          type: 'fixed'
        };
      }
    }
    return {};
  }
}

// Export singleton instance
const retrievalHelperService = new RetrievalHelperService();

module.exports = retrievalHelperService;

