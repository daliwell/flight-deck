const _ = require('lodash');
const embeddedSearch = require('./embeddedSearch');
const retrievalSearch = require('./retrievalSearch');
const retrievalHelper = require('./retrievalHelper');
const RagHelperService = require('./ragHelper');
const AzureOpenAIService = require('../services/azureOpenAI');
const faustService = require('../services/graphqlFaustService');
const canService = require('../services/graphqlCanService');
const { RAG_DEFAULTS, getPageSizeLimit } = require('../constants/rag');

/**
 * RAG Search Service
 *
 * Combines retrieval search (keyword-based) and embedded search (vector-based)
 * to provide hybrid search results for RAG (Retrieval-Augmented Generation).
 */
class RagSearchService {
  constructor() {
    // Configuration with defaults
    this.config = {
      PAGE_SIZE_LIMIT: global.appConfig?.PAGE_SIZE_LIMIT ||
                       process.env.PAGE_SIZE_LIMIT ||
                       RAG_DEFAULTS.PAGE_SIZE_LIMIT,
      RAG_KEYWORD_CUTOFF: global.appConfig?.RAG_KEYWORD_CUTOFF ||
                          process.env.RAG_KEYWORD_CUTOFF ||
                          RAG_DEFAULTS.KEYWORD_CUTOFF,
      RAG_EMBEDDING_CUTOFF: global.appConfig?.RAG_EMBEDDING_CUTOFF ||
                            process.env.RAG_EMBEDDING_CUTOFF ||
                            RAG_DEFAULTS.EMBEDDING_CUTOFF,
      RAG_LLM_MAX_TOKENS: global.appConfig?.RAG_LLM_MAX_TOKENS ||
                          process.env.RAG_LLM_MAX_TOKENS ||
                          RAG_DEFAULTS.LLM_MAX_TOKENS,
      RAG_LLM_TEMPERATURE: global.appConfig?.RAG_LLM_TEMPERATURE ||
                           process.env.RAG_LLM_TEMPERATURE ||
                           RAG_DEFAULTS.LLM_TEMPERATURE
    };

    // Initialize Azure OpenAI service for LLM answer generation
    try {
      this.azureOpenAI = new AzureOpenAIService();
    } catch (error) {
      console.warn('Failed to initialize Azure OpenAI service for RAG:', error.message);
      this.azureOpenAI = null;
    }

    // Initialize RAG helper service
    try {
      this.ragHelper = new RagHelperService();
    } catch (error) {
      console.warn('Failed to initialize RAG helper service:', error.message);
      this.ragHelper = null;
    }
  }

  /**
   * Perform RAG search combining retrieval and embedded search
   * @param {Object} db - MongoDB database connection
   * @param {string} question - Search question
   * @param {Object} context - Application context (app, platform, user)
   * @param {boolean} enableLLM - Enable LLM-generated answer (default: false)
   * @returns {Promise<Object|null>} Search results with keywords, retrieval, embeddings, and optional LLM answer
   */
  async ragSearch(db, question, context = {}, enableLLM = false) {
    try {
      const result = {
        keywords: null,
        retrieval: [],
        embeddings: [],
        combined: [],
        llmAnswer: null
      };

      // If LLM is enabled, start fetching user and language immediately (they don't depend on anything)
      let userPromise = null;
      let languagePromise = null;
      if (enableLLM && this.azureOpenAI && this.azureOpenAI.hasValidConfig) {
        userPromise = retrievalHelper.fetchUserFromGraphQL(context, question, 'NONE');
        languagePromise = retrievalHelper.getLanguage(question);
      }

      // Extract keywords from question
      const keywordsJson = await retrievalHelper.getKeywords(question);
      const modifiedKeywords = JSON.parse(keywordsJson);
      result.keywords = keywordsJson;

      // Create fake context for internal use
      const fakeContext = {
        app: 'entwickler',
        platform: 'rag',
        ...context
      };

      // Get filters based on extracted keywords
      const filters = await retrievalHelper.getFilters(db, modifiedKeywords, fakeContext, false, true);

      // Add chunker filter if provided in context
      if (context.chunker && context.chunker.trim() !== '') {
        filters.chunker = context.chunker;
      }

      // Add useAuditedPocsOnly flag if provided in context
      if (context.useAuditedPocsOnly !== undefined) {
        filters.useAuditedPocsOnly = context.useAuditedPocsOnly;
      }

      // Determine page size based on custom value or chunker type
      let pageSizeLimit;
      if (context.pageSize !== undefined && context.pageSize !== null && context.pageSize > 0) {
        // Use custom page size if provided
        pageSizeLimit = context.pageSize;
        console.log(`Using custom page size limit: ${pageSizeLimit}`);
      } else {
        // Use default page size based on chunker type
        pageSizeLimit = getPageSizeLimit(context.chunker);
        console.log(`Using default page size limit for chunker ${context.chunker || 'default'}: ${pageSizeLimit}`);
      }

      // Prepare retrieval arguments
      const args = {
        question: modifiedKeywords['phrase_out'] || question,
        PAGE: 1,
        PAGE_SIZE: pageSizeLimit
      };

      // Execute both searches in parallel with chunker filter
      const embeddingsPromise = embeddedSearch.embeddedSearch(db, question, fakeContext, filters, 1, pageSizeLimit);
      const retrievalPromise = retrievalSearch.retrieval(db, args, fakeContext, filters, false);

      // Process retrieval results first (don't wait for embeddings yet)
      const retrieval = await retrievalPromise;

      // Filter retrieval results based on score cutoffs
      let filteredRetrieval = [];
      if (retrieval && retrieval.length > 0) {
        filteredRetrieval = retrieval
          .map(item => ({
            ...item,
            from: 'index'
          }))
          .filter(item =>
            item.score >= Number(this.config.RAG_KEYWORD_CUTOFF) &&
            item.normalizedScore >= 0
          );
      }
      result.retrieval = filteredRetrieval;

      // Now wait for embeddings to complete
      const embeddings = await embeddingsPromise;

      // Filter embedding results based on score cutoffs
      let filteredEmbeddings = [];
      if (embeddings && embeddings.length > 0) {
        filteredEmbeddings = embeddings
          .map(item => ({
            ...item,
            from: 'vector'
          }))
          .filter(item =>
            item.score >= Number(this.config.RAG_EMBEDDING_CUTOFF) &&
            item.normalizedScore >= 0
          );

        // Sort embeddings by normalized score descending
        filteredEmbeddings.sort((a, b) => b.normalizedScore - a.normalizedScore);
      }
      result.embeddings = filteredEmbeddings;

      // Combine and deduplicate results
      result.combined = this.combineResults(filteredRetrieval, filteredEmbeddings);

      // Generate LLM answer if enabled
      if (enableLLM && this.azureOpenAI && this.azureOpenAI.hasValidConfig) {
        try {
          const modifiedFilteredEmbeddings = this.modifyFilteredResults(filteredEmbeddings, pageSizeLimit, context.chunker);
          const modifiedFilteredRetrieval = this.modifyFilteredResults(filteredRetrieval, Math.max(0, (pageSizeLimit * 2) - modifiedFilteredEmbeddings.length), context.chunker);

          // Build combined array: [first embedding, ...all retrieval, ...remaining embeddings]
          // Handle edge case where modifiedFilteredEmbeddings might be empty
          const firstEmbedding = modifiedFilteredEmbeddings.length > 0 ? [_.head(modifiedFilteredEmbeddings)] : [];
          const remainingEmbeddings = modifiedFilteredEmbeddings.length > 1
            ? _.takeRight(modifiedFilteredEmbeddings, modifiedFilteredEmbeddings.length - 1)
            : [];

          const modifiedFilteredPOCEmbeddings = _.concat(firstEmbedding, modifiedFilteredRetrieval, remainingEmbeddings);
          const uniquePOCEmbeddings = _.uniqBy(modifiedFilteredPOCEmbeddings, 'pocId');
          const uniquePOCIds = _.uniq(modifiedFilteredPOCEmbeddings.map(poc => poc.pocId));
          const uniquePOCsPromise = getPOCs(db, uniquePOCIds);
          const pocIdToScore = modifiedFilteredPOCEmbeddings.reduce((acc, poc) => {
            if (!acc.has(poc.pocId)) {
              acc.set(poc.pocId, poc.score);
            }
            return acc;
          }, new Map());
          // const scores = uniquePOCIds.map(id => pocIdToScore.get(id));
          const uniquePOCs = await uniquePOCsPromise;
          _.reverse(modifiedFilteredPOCEmbeddings);

          // Wait for user and language data (started at the beginning of the function)
          const user = await userPromise;
          
          // Create default user object if no user is authenticated
          const userForContext = user || {
            selectedBrandComplexId: null,
            selectedCategoryIds: [],
            numberOfSeats: 0,
            accessTier: null,
            hasRagAccess: true
          };
          
          const userContextPromise = retrievalHelper.getUserContext(userForContext, db, 'entwickler');
          const language = await languagePromise;
          const userContext = await userContextPromise;
          userContext.languagePreference = language;

          // Get user token (or null if no authenticated user)
          const userToken = context.user?.token || null;
          
          const contexts = await getAllChunkContexts(userToken, userContext, uniquePOCs, modifiedFilteredPOCEmbeddings, uniquePOCEmbeddings);
          let { chunkContext, referenceContext, mottContext } = contexts;
          const chunkPocMap = _.mapValues(_.keyBy(chunkContext, 'chunk_id'), 'documentId');
          const now = new Date();

          // Check if user has RAG access - use the user object, not just the boolean
          const canUserAccessRag = user || { hasRagAccess: true };

          // Call ragAnswer to generate LLM response
          if (this.ragHelper && this.ragHelper.llmService?.hasValidConfig) {
            // Note: ragAnswer expects a state object for streaming responses
            // For now, we'll create a simple state mock or pass null if state is optional
            // The actual state object would be provided by the calling route/controller
            const app = context.app || 'entwickler';

            const answer = await this.ragHelper.ragAnswer(
              question,
              user,
              now,
              canUserAccessRag,
              db,
              app,
              userContext,
              chunkContext,
              language,
              modifiedKeywords['phrase_out'] || question, // keyword
              referenceContext,
              mottContext,
              chunkPocMap,
              {
                maxTokens: Number(this.config.RAG_LLM_MAX_TOKENS),
                temperature: Number(this.config.RAG_LLM_TEMPERATURE)
              }
            );

            result.llmAnswer = answer;
          } else {
            console.warn('RAG helper not available or not configured, skipping LLM answer generation');
            result.llmAnswer = null;
          }
        } catch (error) {
          console.error('Error generating LLM answer:', error.message);
          result.llmAnswer = null;
        }
      }

      return result;
    } catch (error) {
      console.error('Error in RAG search:', error.message);
      return null;
    }
  }

  /**
   * Combine results from retrieval and embeddings, removing duplicates
   * Order: 1) Highest embedded result, 2) All retrieval results, 3) Remaining embedded results
   * @param {Array<Object>} retrievalResults - Retrieval search results
   * @param {Array<Object>} embeddingResults - Embedding search results
   * @returns {Array<Object>} Combined and deduplicated results
   */
  combineResults(retrievalResults, embeddingResults) {
    const combined = [];
    const seenIds = new Set();

    // Step 1: Add the highest embedded result first (if available)
    if (embeddingResults.length > 0) {
      const topEmbedding = embeddingResults[0];
      const topId = topEmbedding._id || topEmbedding.id || topEmbedding.pocId;
      if (topId) {
        seenIds.add(topId.toString());
        combined.push(topEmbedding);
      }
    }

    // Step 2: Add all retrieval results (already sorted by score)
    for (const result of retrievalResults) {
      const id = result._id || result.id || result.pocId;
      if (id && !seenIds.has(id.toString())) {
        seenIds.add(id.toString());
        combined.push(result);
      }
    }

    // Step 3: Add remaining embedding results (skip the first one we already added)
    for (let i = 1; i < embeddingResults.length; i++) {
      const result = embeddingResults[i];
      const id = result._id || result.id || result.pocId;
      if (id && !seenIds.has(id.toString())) {
        seenIds.add(id.toString());
        combined.push(result);
      }
    }


    return combined;
  }

  /**
   * Filter and limit POC embeddings based on max chunks and max chunks per POC
   * @param {Array<Object>} pocEmbeddings - Array of POC embedding results
   * @param {number} max - Maximum total number of chunks to return (default: PAGE_SIZE_LIMIT)
   * @param {string} chunker - Chunker type to determine maxChunksPerPOC
   * @returns {Array<Object>} Filtered results with deduplication and per-POC limits
   */
  modifyFilteredResults(pocEmbeddings, max = RAG_DEFAULTS.PAGE_SIZE_LIMIT, chunker = null) {
    const maxChunks = max;
    // 3 chunks per POC for DEFAULT-1024T, 24 for READ-CONTENT chunkers
    const maxChunksPerPOC = (chunker === 'DEFAULT-1024T' || !chunker) ? 3 : 24;
    const filteredResults = [];
    const pocChunkMap = new Map();
    const seenIds = new Set();

    for (const embedding of pocEmbeddings) {
      const { pocId, _id } = embedding;
      if (seenIds.has(_id)) continue;
      if (filteredResults.length >= maxChunks) break;

      const currentChunks = pocChunkMap.get(pocId) || [];
      if (currentChunks.length < maxChunksPerPOC) {
        if (!pocChunkMap.has(pocId)) {
          pocChunkMap.set(pocId, []);
        }
        currentChunks.push(embedding);
        filteredResults.push(embedding);
        seenIds.add(_id);
        pocChunkMap.set(pocId, currentChunks);
      }
    }

    return filteredResults;
  }

  /**
   * Get search results for a specific page
   * @param {Object} db - MongoDB database connection
   * @param {string} question - Search question
   * @param {Object} context - Application context
   * @param {number} page - Page number (1-based)
   * @param {number} pageSize - Page size
   * @returns {Promise<Object|null>} Paginated search results
   */
  async ragSearchPaginated(db, question, context = {}, page = 1, pageSize = null) {
    const results = await this.ragSearch(db, question, context);

    if (!results) {
      return null;
    }

    const size = pageSize || this.config.PAGE_SIZE_LIMIT;
    const start = (page - 1) * size;
    const end = start + size;

    return {
      ...results,
      combined: results.combined.slice(start, end),
      page,
      pageSize: size,
      total: results.combined.length,
      totalPages: Math.ceil(results.combined.length / size)
    };
  }

  /**
   * Get only the combined results (simplified response)
   * @param {Object} db - MongoDB database connection
   * @param {string} question - Search question
   * @param {Object} context - Application context
   * @param {number} page - Page number (1-based)
   * @param {number} pageSize - Page size
   * @returns {Promise<Array<Object>|null>} Combined search results
   */
  async ragSearchSimple(db, question, context = {}, page = 1, pageSize = null) {
    const results = await this.ragSearchPaginated(db, question, context, page, pageSize);
    return results ? results.combined : null;
  }
}

/**
 * Helper function to add toYYYYMMDD method to Date prototype if not exists
 */
if (!Date.prototype.toYYYYMMDD) {
  Date.prototype.toYYYYMMDD = function() {
    const year = this.getFullYear();
    const month = String(this.getMonth() + 1).padStart(2, '0');
    const day = String(this.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
}

/**
 * Get POCs (Pieces of Content) by IDs
 * @param {Object} db - MongoDB database connection
 * @param {Array<string>} ids - Array of POC IDs
 * @returns {Promise<Array>} Array of POC objects
 */
const getPOCs = async (db, ids) => {
  return await retrievalHelper.runQuery(db, 'pieceOfContents', [
    { $match: { _id: { $in: ids } } },
    { $project: { similarities: 0, categoryIds: 0 } },
    {
      $addFields: {
        sortDate: {
          $dateToString: {
            format: '%d/%m/%Y %H:%M:%S',
            date: '$sortDate'
          }
        }
      }
    }
  ]);
};

/**
 * Get access message based on POC embedding, accessibility status, and user context
 * @param {Object} pocEmbedding - POC embedding object with content details
 * @param {boolean} isAccessible - Whether the content is accessible to the user
 * @param {Object} userContext - User context with platform, accessTier, etc.
 * @returns {Object} Access messages in en, de, nl
 */
const getAccessMessage = (pocEmbedding, isAccessible, userContext) => {
  const startDate = new Date(pocEmbedding.sortDate);
  const after180Days = new Date(pocEmbedding.sortDate);
  after180Days.setDate(after180Days.getDate() + 180);
  const isWithin180Days = new Date() <= after180Days;
  const currency = (userContext.platform === 'devm.io') ? '$' : '€';
  const contentType = pocEmbedding.contentType || '';
  const accessTier = userContext.accessTier || 'none';
  const parentName = pocEmbedding.parentName || '';

  if (!!['READ', 'TUTORIAL', 'FSLE', 'COURSE'].includes(contentType)) {
    if (!!isAccessible) {
      return {
        en: `✅ This content is included with your ${accessTier} membership.`,
        de: `✅ Diese Inhalte sind in Ihrer ${accessTier}-Mitgliedschaft enthalten.`,
        nl: `✅ Deze content is inbegrepen in het ${accessTier}-lidmaatschap.`
      };
    } else {
      return {
        en: '⚠️ This content is not available with your current membership.\nUpgrade to Fullstack or Elevate to unlock full access.',
        de: '⚠️ Diese Inhalte sind mit Ihrer aktuellen Mitgliedschaft nicht verfügbar.\nUpgraden Sie auf Fullstack oder Elevate, um vollen Zugriff zu erhalten.',
        nl: '⚠️ Deze content is niet beschikbaar met het huidige lidmaatschap.\nUpgrade naar Fullstack of Elevate om volledige toegang te krijgen.'
      };
    }
  } else if (!!['RHEINGOLD', 'CAMP', 'FLEX_CAMP'].includes(contentType)) {
    if (!!isAccessible) {
      if (startDate >= new Date()) {
        return {
          en: `✅ You've successfully booked this talk of ${parentName}. We can't wait to welcome you at the event!`,
          de: `✅ Sie haben diesen Vortrag von ${parentName} erfolgreich gebucht. Wir freuen uns darauf, Sie beim Event zu begrüßen!`,
          nl: `✅ Je hebt deze talk van ${parentName} succesvol geboekt. We kijken ernaar uit je op het event te verwelkomen!`
        };
      } else {
        if (contentType === 'RHEINGOLD') {
          if (!!isWithin180Days) {
            return {
              en: `✅ You still have access to the recordings for this talk of ${parentName} until ${after180Days.toYYYYMMDD()}. Unfortunately, recordings are not available for workshops, but you can still access the slides and your certificate. Dive back in anytime!`,
              de: `✅ Sie haben weiterhin Zugriff auf die Aufzeichnungen dieses Vortrags von ${parentName} bis zum ${after180Days.toYYYYMMDD()}. Für Workshops stehen leider keine Aufzeichnungen zur Verfügung, aber Folien und Ihr Zertifikat sind weiterhin abrufbar.`,
              nl: `✅ Je hebt nog toegang tot de opnames van deze talk van ${parentName} tot en met ${after180Days.toYYYYMMDD()}. Voor workshops zijn er helaas geen opnames beschikbaar, maar de slides en je certificaat blijven beschikbaar.`
            };
          } else {
            return {
              en: `ℹ️ This talk of ${parentName} was part of a past event. Recordings are no longer available, but you can still access the slides and your certificate.`,
              de: `ℹ️ Dieser Vortrag von ${parentName} war Teil einer vergangenen Veranstaltung. Aufzeichnungen sind nicht mehr verfügbar, Folien und Ihr Zertifikat bleiben abrufbar.`,
              nl: `ℹ️ Deze talk van ${parentName} maakte deel uit van een eerder event. Opnames zijn niet langer beschikbaar, maar de slides en je certificaat blijven toegankelijk.`
            };
          }
        } else {
          return {
            en: `✨ We hope you enjoyed ${parentName}! You can still view the slides, text materials, and download your certificate anytime.`,
            de: `✨ Wir hoffen, ${parentName} hat Ihnen gefallen! Sie können die Folien, Textmaterialien und Ihr Zertifikat weiterhin jederzeit einsehen.`,
            nl: `✨ We hopen dat je ${parentName} leuk vond! Je kunt de slides, het tekstmateriaal en je certificaat op elk moment blijven bekijken.`
          };
        }
      }
    } else {
      if (startDate >= new Date()) {
        let discountMessageEn = 'As a Basic user, you can purchase at full price.\nConsider upgrading to a Fullstack membership (for individuals or teams up to 15) or Elevate for enterprises to save up to 25%.';
        let discountMessageDe = 'Als Basic-Mitglied können Sie zum regulären Preis buchen.\nErwägen Sie ein Upgrade auf eine Fullstack-Mitgliedschaft (für Einzelpersonen oder Teams bis 15 oder auf Elevate für Unternehmen, um bis zu 25% zu sparen.';
        let discountMessageNl = 'Als Basic-lid kun je tegen de volle prijs boeken.\nOverweeg een upgrade naar een Fullstack-lidmaatschap (voor individuen of teams tot 15 of naar Elevate voor organisaties om tot 25% te besparen.';
        if (accessTier === 'elevate') {
          discountMessageEn = `As an Elevate member, your discount of ${userContext.addOnDiscountAmount}% is applied automatically when booking via your Elevate dashboard here on ${userContext.platform}. An additional 3% applies if you use a prepayment method.`;
          discountMessageDe = `Als Elevate-Mitglied wird Ihr Rabatt von ${userContext.addOnDiscountAmount}% automatisch angewendet, wenn Sie über das interne Beschaffungs‑Dashboard auf ${userContext.platform} buchen. Zusätzlich werden 3% gewährt, wenn die Zahlung per Vorauszahlung erfolgt.`;
          discountMessageNl = `Als Elevate-lid wordt je korting van ${userContext.addOnDiscountAmount}% automatisch toegepast wanneer je boekt via het interne inkoopdashboard op ${userContext.platform}. Bij betaling via vooruitbetaling geldt een extra 3%.`;
        } else if (accessTier === 'fullstack') {
          if (_.isEmpty(userContext.addOnDiscountType)) {
            discountMessageEn = `As a Fullstack user, you're eligible for a member discount.\nUse your Fullstack ID at checkout on the event website to redeem.`;
            discountMessageDe = `Als Fullstack-Mitglied sind Sie für einen Mitgliederrabatt berechtigt.\nGeben Sie Ihre Fullstack-ID beim Checkout auf der Event-Seite ein.`;
            discountMessageNl = `Als Fullstack-lid kom je in aanmerking voor ledenskorting.\nGebruik je Fullstack-ID bij het afrekenen op de eventsite.`;
          } else {
            discountMessageEn = `As a Fullstack user, you're eligible for a ${currency}${userContext.addOnDiscountAmount} discount.\nUse your Fullstack ID at checkout on the event website to redeem.`;
            discountMessageDe = `Als Fullstack-Mitglied erhalten Sie einen Rabatt von ${currency}${userContext.addOnDiscountAmount}.\nGeben Sie Ihre Fullstack-ID beim Checkout auf der Event-Seite ein.`;
            discountMessageNl = `Als Fullstack-lid ontvang je ${currency}${userContext.addOnDiscountAmount} korting.\nGebruik je Fullstack-ID bij het afrekenen op de eventsite.`;
          }
        }
        return {
          en: `⚠️ This talk of ${parentName} is a premium add-on. Purchase separately to participate. ${discountMessageEn}`,
          de: `⚠️ Dieser Vortrag von ${parentName} ist ein Premium-Add-on. Buchen Sie separat, um teilzunehmen. ${discountMessageDe}`,
          nl: `⚠️ Deze talk van ${parentName} is een premium add-on. Boek apart om deel te nemen. ${discountMessageNl}`
        };
      } else {
        return {
          en: `ℹ️ This talk of ${parentName} was part of a past event. Booking is no longer available, but you can discover the current edition right here on the platform.`,
          de: `ℹ️ Dieser Vortrag von ${parentName} war Teil einer vergangenen Veranstaltung. Eine Buchung ist nicht mehr möglich; entdecken Sie stattdessen die aktuelle Ausgabe direkt hier auf der Plattform.`,
          nl: `ℹ️ Deze talk van ${parentName} maakte deel uit van een eerder event. Boeken is niet meer mogelijk, maar je kunt de huidige editie hier op het platform ontdekken.`
        };
      }
    }
  }
  return {
    en: 'ℹ️ Access details for this content could not be determined from your current profile.',
    de: 'ℹ️ Zugriffshinweise zu diesen Inhalten konnten anhand Ihres Profils nicht bestimmt werden.',
    nl: 'ℹ️ Toegangsdetails voor deze content konden niet op basis van je profiel worden bepaald.'
  };
};

/**
 * Get all chunk contexts for different use cases
 * @param {string|null} token - Access token for authentication
 * @param {Object} userContext - User context with platform, accessTier, etc.
 * @param {Array<Object>} uniquePOCs - Array of unique POC objects
 * @param {Array<Object>} modifiedFilteredPOCEmbeddings - Array of modified filtered POC embeddings
 * @param {Array<Object>} uniquePOCEmbeddings - Array of unique POC embeddings
 * @returns {Promise<Object>} Object with different context types
 */
const getAllChunkContexts = async (token, userContext, uniquePOCs, modifiedFilteredPOCEmbeddings, uniquePOCEmbeddings) => {
  const pocIds = _.uniq(_.map(uniquePOCs, '_id'));
  
  // Fetch articles and lessons, with fallback to empty arrays if services not configured
  let articles = [];
  let lessons = [];
  
  try {
    if (faustService && faustService.hasValidConfig) {
      articles = await faustService.getArticleAccessible(pocIds, token);
    }
  } catch (error) {
    console.warn('Failed to fetch articles from Faust service:', error.message);
  }
  
  try {
    if (canService && canService.hasValidConfig) {
      lessons = await canService.getLessonAccessible(pocIds, token);
    }
  } catch (error) {
    console.warn('Failed to fetch lessons from CAN service:', error.message);
  }

  const buildContext = (pocEmbeddings, isReference, isMOTT) => {
    const pocContexts = [];
    for (const pocEmbedding of pocEmbeddings) {
      const article = _.find(articles, { _id: pocEmbedding.pocId });
      const lesson = _.find(lessons, { _id: pocEmbedding.pocId });
      const poc = _.find(uniquePOCs, { _id: pocEmbedding.pocId });
      // Default to accessible if services aren't available
      const isAccessible = article ? !!article.accessible : (lesson ? !!lesson.accessible : true);
      const accessMessage = getAccessMessage(pocEmbedding, !!isAccessible, userContext);

      let context = {
        documentId: pocEmbedding.pocId,
        chunk_id: pocEmbedding._id,
        access: !!isAccessible ? 'granted' : 'restricted',
        part_number: (pocEmbedding.index + 1),
        total_parts: pocEmbedding.total,
      };

      if (!!isReference) {
        if (!!isMOTT) {
          context = {
            ...context,
            title: (pocEmbedding.title || '') + (!!pocEmbedding.subtitle ? ` - ${pocEmbedding.subtitle}` : ''),
            poc_summaries: {
              en: poc ? (poc.summaryEn || '') : '',
              de: poc ? (poc.summaryDe || '') : '',
              nl: poc ? (poc.summaryNl || '') : ''
            },
            access_messages: {
              en: accessMessage.en || '',
              de: accessMessage.de || '',
              nl: accessMessage.nl || ''
            }
          };
        } else {
          context = {
            ...context,
            poc_summary: poc ? (poc.summaryEn || '') : '',
            chunk_summary: pocEmbedding.summaryEn || '',
            access_message: accessMessage.en || ''
          };
        }
      } else {
        context = {
          ...context,
          contentType: pocEmbedding.contentType,
          title: (pocEmbedding.title || '') + (!!pocEmbedding.subtitle ? ` - ${pocEmbedding.subtitle}` : ''),
          parentName: pocEmbedding.parentName || '',
          language: pocEmbedding.language,
          date: pocEmbedding.sortDate,
          abstract: pocEmbedding.abstract || '',
          parentId: pocEmbedding.parentId || '',
          parentDescription: pocEmbedding.parentDescription || '',
          indexBrandName: pocEmbedding.indexBrandName || '',
          indexSeriesName: pocEmbedding.indexSeriesName || '',
          author: pocEmbedding.expertSearchNames || '',
          chunkSource: !!pocEmbedding.isSlide ? 'slidetext' : 'text',
          text: !!pocEmbedding.isSlide ? '' : pocEmbedding.text,
          slidetext: !!pocEmbedding.isSlide ? pocEmbedding.text : '',
          from: pocEmbedding.from,
          score: pocEmbedding.score || 0,
          normalizedScore: pocEmbedding.normalizedScore || 0,
          beforeDatePenaltyScore: pocEmbedding.beforeDatePenaltyScore || pocEmbedding.score,
        };
      }
      pocContexts.push(context);
    }
    return pocContexts;
  };

  return {
    chunkContext: buildContext(modifiedFilteredPOCEmbeddings),
    referenceContext: buildContext(uniquePOCEmbeddings, true),
    mottContext: buildContext(uniquePOCEmbeddings, true, true)
  };
};

// Export singleton instance
const ragSearchService = new RagSearchService();

module.exports = ragSearchService;
module.exports.getAllChunkContexts = getAllChunkContexts;
module.exports.getAccessMessage = getAccessMessage;

