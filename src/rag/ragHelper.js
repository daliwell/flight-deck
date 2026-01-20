const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const h2p = require('html2plaintext');
const AzureOpenAIService = require('../services/azureOpenAI');
const PromptService = require('./prompt');


/**
 * RAG Helper Service
 *
 * Provides RAG (Retrieval-Augmented Generation) answer generation
 * with citation processing, reference construction, and translation support.
 */
class RagHelperService {
  constructor() {
    // Initialize OpenAI LLM service for RAG operations
    try {
      this.llmService = new AzureOpenAIService();
    } catch (error) {
      console.warn('Azure OpenAI LLM service not initialized for RAG helper.');
      this.llmService = null;
    }

    // Initialize Prompt Service for RAG prompts
    this.promptService = new PromptService();
  }

  /**
   * Generate RAG answer with citations and references
   * @param {string} question - User's question
   * @param {Object} user - User object with _id
   * @param {Date} now - Current timestamp
   * @param {boolean} canUserAccessRag - Whether user has RAG access
   * @param {Object} db - Database connection
   * @param {Object} app - Express app instance
   * @param {Object} userContext - User context information
   * @param {Array} chunkContext - Array of chunk data
   * @param {string} language - Response language
   * @param {string} keyword - Extracted keyword
   * @param {Array} referenceContext - Reference context data
   * @param {Array} mottContext - MOTT (More On This Topic) context
   * @param {Object} chunkPocMap - Mapping of chunk IDs to POC IDs
   * @param {Object} options - Optional LLM options (maxTokens, temperature)
   * @returns {Promise<void>}
   */
  async ragAnswer(question, user, now, canUserAccessRag, db, app, userContext, chunkContext, language, keyword, referenceContext, mottContext, chunkPocMap, options = {}) {
    if (!this.llmService || !this.llmService.hasValidConfig) {
      throw new Error('RAG Helper service not properly configured');
    }

    const keywordString = `gpt-4.1-mini keyword: ${keyword} \n\n`;

    const referenceSystemPrompt = this.promptService.getReferenceSystemPrompt(question, language);
    const referencePrompts = [];
    referencePrompts.push({
      role: 'system',
      content: [
        {
          type: 'text',
          text: referenceSystemPrompt
        }
      ]
    });
    const referenceUserPrompt = this.promptService.getReferenceUserPrompt(question, language, referenceContext);
    referencePrompts.push({
      role: 'user',
      content: [
        {
          type: 'text',
          text: referenceUserPrompt
        }
      ]
    });
    const referencePromise = this.llmService.getFullResponse(referencePrompts, {
      maxTokens: options.maxTokens,
      temperature: options.temperature
    });

    const today = new Date().toISOString().split('T')[0];
    const ragPrompts = [];
    const assistant = (userContext.platform === 'entwickler.de') ? 'Entwickler Intelligence' : 'Dev Intelligence';
    const ragSystemPrompt = this.promptService.getRagSystemPrompt(today, userContext, assistant, language);
    ragPrompts.push({
      role: 'system',
      content: [
        {
          type: 'text',
          text: ragSystemPrompt
        }
      ]
    });

    const contentTypeGuide = this.getFileAsString('contentTypeGuide.md');
    const userContextFieldGuide = this.getFileAsString('userContextFieldGuide.md');
    const instructions = [
      {
        name: 'Content Type Guide',
        content: contentTypeGuide
      },
      {
        name: 'User Context Field Guide',
        content: userContextFieldGuide
      }
    ];
    const ragUserPrompt = this.promptService.getRagUserPrompt(question, userContext, chunkContext, language, instructions, today);
    ragPrompts.push({
      role: 'user',
      content: [
        {
          type: 'text',
          text: ragUserPrompt
        }
      ]
    });
    const ragResponse = await this.llmService.getFullResponse(ragPrompts, {
      maxTokens: options.maxTokens,
      temperature: options.temperature
    });
    let referenceAnswer = '';
      const referenceResponse = await referencePromise;
      const referenceJSON = JSON.parse(referenceResponse);
      if (!_.isEmpty(referenceJSON)) {
        referenceAnswer = await this.constructReferenceString(ragResponse.citations, referenceJSON, language, mottContext);
      }
    return ragResponse + '\n\n' + referenceAnswer;
  }

  /**
   * Get missing sources with translation
   * @param {Array} missingSources - Array of missing source objects
   * @param {string} language - Target language
   * @returns {Promise<Array>} Translated sources
   */
  async getMissingSources(missingSources, language) {
    const prompt = [
      {
        role: 'system',
        content: [
          {
            type: 'text',
            text: this.promptService.getTranslateMissingSourcesSystemPrompt(language)
          }
        ]
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: this.promptService.getTranslateMissingSourcesUserPrompt(missingSources, language)
          }
        ]
      }
    ];
    const response = await this.llmService.getFullResponse(prompt);
    return JSON.parse(response.trim());
  }

  /**
   * Construct reference string with citations and more on this topic
   * @param {Array} citations - Array of citation IDs
   * @param {Object} referenceJSON - Reference data from LLM
   * @param {string} language - Target language
   * @param {Array} mottContext - MOTT context data
   * @returns {Promise<string>} Formatted reference string
   */
  async constructReferenceString(citations, referenceJSON, language, mottContext) {
  let referenceAnswer = '';
  const translatedHeaders = referenceJSON.translated_headers;
  const sourcesTitle = translatedHeaders && translatedHeaders.sources ? translatedHeaders.sources : 'Sources';
  const moreTitle = translatedHeaders && translatedHeaders.more_on_this_topic ? translatedHeaders.more_on_this_topic : 'More on this topic';

  const mores = referenceJSON.more_on_this_topic || [];
  const moreIds = _.map(mores, 'doc_id');
  const missingIds = _.difference(citations, moreIds);
  if (!_.isEmpty(missingIds)) {
    const missingSources = [];
    for (const missingId of missingIds) {
      const foundSource = _.find(mottContext, { documentId: missingId });
      if (!!foundSource) {
        missingSources.push({
          doc_id: foundSource.documentId,
          poc_summary: foundSource.poc_summaries.en,
          access_message: foundSource.access_messages.en
        });
      }
    }
    const translatedMissingSources = await this.getMissingSources(missingSources, language);
    mores.push(...translatedMissingSources);
    referenceJSON.more_on_this_topic = mores;
    return await this.constructReferenceString(citations, referenceJSON, language, mottContext);
  }
  const moreLeftover = _.difference(moreIds, citations);

  referenceAnswer += `\n\n---\n\n#### ${sourcesTitle}\n`;
  for (const index in citations) {
    const citation = citations[index];
    const source = _.find(mores, { doc_id: citation });
    const mott = _.find(mottContext, { documentId: citation });
    if (!!mott) {
      const title = mott.title || '';
      let summary = mott.poc_summaries.en || '';
      let accessMessage = mott.access_messages.en || '';
      if (language === 'German') {
        summary = mott.poc_summaries.de || summary;
        accessMessage = mott.access_messages.de || accessMessage;
      } else if (language === 'Dutch') {
        summary = mott.poc_summaries.nl || summary;
        accessMessage = mott.access_messages.nl || accessMessage;
      } else {
        summary = source.summary || summary;
        accessMessage = source.translated_access_message || accessMessage;
      }
      referenceAnswer += `\n ${(parseInt(index) + 1)}. [${title}](${citation}) ${summary} ${accessMessage}\n`;
    }
  }
  if (!_.isEmpty(moreLeftover)) {
    referenceAnswer += `\n\n---\n\n#### ${moreTitle}\n`;
    for (const more of mores) {
      const pocId = more.doc_id;
      if (!!pocId && !_.includes(citations, pocId)) {
        const mott = _.find(mottContext, { documentId: pocId });
        if (!!mott) {
          const title = mott.title || '';
          let summary = mott.poc_summaries.en || '';
          let accessMessage = mott.access_messages.en || '';
          if (language === 'German') {
            summary = mott.poc_summaries.de || '';
            accessMessage = mott.access_messages.de || '';
          } else if (language === 'Dutch') {
            summary = mott.poc_summaries.nl || '';
            accessMessage = mott.access_messages.nl || '';
          } else {
            summary = more.summary || summary;
            accessMessage = more.translated_access_message || accessMessage;
          }
          referenceAnswer += `\n - [${title}](${pocId}) ${summary} ${accessMessage}\n`;
        }
      }
    }
  }
  return referenceAnswer;
  }

  /**
   * Get chunk context as formatted string
   * @param {Array} chunkContext - Array of chunk objects
   * @returns {string} Formatted chunk context string
   */
  getChunkContextString(chunkContext) {
    let chunkContextString = '';
    _.forEach(chunkContext, (chunk) => {
      _.forOwn(chunk, (value, key) => {
        if (key === 'text' || key === 'title' || key === 'subtitle' || key === 'abstract' || key === 'parentName' || key === 'parentDescription') {
          chunkContextString += `"${key}": ${h2p(value)}\n`;
        } else {
          chunkContextString += `"${key}": ${JSON.stringify(value, null, 2)}\n`;
        }
      });
      chunkContextString += '\n';
    });
    return chunkContextString;
  }

  /**
   * Read a file from the rag directory as a string
   * @param {string} filename - Name of file to read
   * @returns {string} File contents or error message
   */
  getFileAsString(filename) {
    try {
      const filePath = path.join(__dirname, filename);
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf8');
      } else {
        console.warn(`File not found: ${filename}`);
        return `<!-- ${filename} not found -->`;
      }
    } catch (error) {
      console.error(`Error reading file ${filename}:`, error);
      return `<!-- Error reading ${filename} -->`;
    }
  }
}

module.exports = RagHelperService;
