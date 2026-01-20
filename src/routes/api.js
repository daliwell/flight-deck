
const express = require('express');
const { ChunkAuditPoc, ChunkAuditChunk, PocEmbedding, ChunkAuditCosts, Chunk } = require('../models');
const getArticleModel = require('../models/Article');
const chunkerService = require('../services/chunkerService');
const AIQualityAssessment = require('../services/AIQualityAssessment');
const progressTracker = require('../services/ProgressTracker');
const { POC_QUALITY, POC_QUALITY_COLORS } = require('../constants/chunkers');

const router = express.Router();

// Simple chunking implementation
function generateChunks(content, chunkerType) {
  if (!content || typeof content !== 'string') {
    return [];
  }

  const chunks = [];
  
  // Remove extra whitespace and normalize
  const cleanContent = content.trim().replace(/\s+/g, ' ');
  
  if (chunkerType.includes('512T')) {
    return createFixedLengthChunks(cleanContent, 512, chunkerType.includes('OVERLAP') ? 64 : 0);
  } else if (chunkerType.includes('1024T')) {
    return createFixedLengthChunks(cleanContent, 1024, chunkerType.includes('OVERLAP') ? 96 : 0);
  } else if (chunkerType.includes('2048T')) {
    return createFixedLengthChunks(cleanContent, 2048, chunkerType.includes('OVERLAP') ? 128 : 0);
  } else if (chunkerType === 'SEMANTIC') {
    return createSemanticChunks(cleanContent);
  } else if (chunkerType === 'RECURSIVE') {
    return createRecursiveChunks(cleanContent);
  } else if (chunkerType === 'DOCUMENT') {
    return createDocumentChunks(cleanContent);
  }
  
  // Default fallback to 1024 tokens with overlap
  return createFixedLengthChunks(cleanContent, 1024, 96);
}

function createFixedLengthChunks(content, targetTokens, overlapTokens) {
  const chunks = [];
  const avgCharsPerToken = 4; // Rough estimate
  const targetChars = targetTokens * avgCharsPerToken;
  const overlapChars = overlapTokens * avgCharsPerToken;
  
  let start = 0;
  let chunkIndex = 0;
  
  while (start < content.length) {
    let end = Math.min(start + targetChars, content.length);
    
    // Try to break at word boundary if not at end of content
    if (end < content.length) {
      const lastSpace = content.lastIndexOf(' ', end);
      if (lastSpace > start + targetChars * 0.8) { // Don't break too early
        end = lastSpace;
      }
    }
    
    const chunkContent = content.substring(start, end).trim();
    if (chunkContent.length > 0) {
      chunks.push({
        content: chunkContent,
        index: chunkIndex++,
        startChar: start,
        endChar: end,
        tokens: Math.ceil(chunkContent.length / avgCharsPerToken)
      });
    }
    
    // Move start position considering overlap
    start = Math.max(start + 1, end - overlapChars);
    if (start >= end) break; // Prevent infinite loop
  }
  
  return chunks;
}

function createSemanticChunks(content) {
  const chunks = [];
  const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  
  let currentChunk = '';
  let chunkIndex = 0;
  let charPosition = 0;
  
  for (const paragraph of paragraphs) {
    const trimmedParagraph = paragraph.trim();
    if (!trimmedParagraph) continue;
    
    // If adding this paragraph would make chunk too long, finalize current chunk
    if (currentChunk && (currentChunk.length + trimmedParagraph.length) > 2000) {
      chunks.push({
        content: currentChunk.trim(),
        index: chunkIndex++,
        startChar: charPosition - currentChunk.length,
        endChar: charPosition,
        tokens: Math.ceil(currentChunk.length / 4)
      });
      currentChunk = '';
    }
    
    currentChunk += (currentChunk ? '\n\n' : '') + trimmedParagraph;
    charPosition += trimmedParagraph.length + 2; // +2 for \n\n
  }
  
  // Add final chunk
  if (currentChunk.trim()) {
    chunks.push({
      content: currentChunk.trim(),
      index: chunkIndex++,
      startChar: charPosition - currentChunk.length,
      endChar: charPosition,
      tokens: Math.ceil(currentChunk.length / 4)
    });
  }
  
  return chunks;
}

function createRecursiveChunks(content) {
  // Split by common separators in order of preference
  const separators = ['\n\n', '\n', '. ', ' '];
  
  function splitText(text, maxLength = 1500) {
    if (text.length <= maxLength) {
      return [text];
    }
    
    for (const separator of separators) {
      if (text.includes(separator)) {
        const parts = text.split(separator);
        const result = [];
        let current = '';
        
        for (const part of parts) {
          if ((current + separator + part).length <= maxLength) {
            current += (current ? separator : '') + part;
          } else {
            if (current) result.push(current);
            current = part;
          }
        }
        if (current) result.push(current);
        
        // If we successfully split, return results
        if (result.length > 1) {
          return result.flatMap(chunk => splitText(chunk, maxLength));
        }
      }
    }
    
    // Fallback to character-based splitting
    const result = [];
    for (let i = 0; i < text.length; i += maxLength) {
      result.push(text.substring(i, i + maxLength));
    }
    return result;
  }
  
  const textChunks = splitText(content);
  return textChunks.map((chunk, index) => ({
    content: chunk.trim(),
    index: index,
    startChar: 0, // Simplified for recursive chunks
    endChar: chunk.length,
    tokens: Math.ceil(chunk.length / 4)
  }));
}

function createDocumentChunks(content) {
  const chunks = [];
  let chunkIndex = 0;
  
  // Split by common document structure elements
  const sections = content.split(/(?=^#{1,6}\s|\n={3,}|\n-{3,})/m);
  
  for (const section of sections) {
    const trimmedSection = section.trim();
    if (trimmedSection.length === 0) continue;
    
    // If section is too long, split it further
    if (trimmedSection.length > 2000) {
      const paragraphs = trimmedSection.split(/\n\s*\n/);
      let currentChunk = '';
      
      for (const paragraph of paragraphs) {
        if ((currentChunk + paragraph).length > 2000 && currentChunk) {
          chunks.push({
            content: currentChunk.trim(),
            index: chunkIndex++,
            startChar: 0,
            endChar: currentChunk.length,
            tokens: Math.ceil(currentChunk.length / 4)
          });
          currentChunk = paragraph;
        } else {
          currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
        }
      }
      
      if (currentChunk.trim()) {
        chunks.push({
          content: currentChunk.trim(),
          index: chunkIndex++,
          startChar: 0,
          endChar: currentChunk.length,
          tokens: Math.ceil(currentChunk.length / 4)
        });
      }
    } else {
      chunks.push({
        content: trimmedSection,
        index: chunkIndex++,
        startChar: 0,
        endChar: trimmedSection.length,
        tokens: Math.ceil(trimmedSection.length / 4)
      });
    }
  }
  
  return chunks;
}

// Debug endpoint: test search for a specific ID
router.get('/debug/search/:searchTerm', async (req, res) => {
  try {
    const { searchTerm } = req.params;
    
    // Try exact match
    const exactMatch = await ChunkAuditPoc.findOne({ pocId: searchTerm }).select('pocId title contentType _id');
    
    // Try regex match
    const regexMatch = await ChunkAuditPoc.findOne({ pocId: { $regex: searchTerm, $options: 'i' } }).select('pocId title contentType _id');
    
    // Try as MongoDB ObjectId
    let idMatch = null;
    try {
      const objectId = require('mongoose').Types.ObjectId(searchTerm);
      idMatch = await ChunkAuditPoc.findById(objectId).select('pocId title contentType _id');
    } catch (e) {
      // Not a valid ObjectId
    }
    
    // Get total POC count
    const totalCount = await ChunkAuditPoc.countDocuments();
    
    // Sample pocIds
    const samples = await ChunkAuditPoc.find({}).limit(5).select('pocId').lean();
    
    res.json({
      success: true,
      data: {
        searchTerm,
        exactMatch: exactMatch ? { pocId: exactMatch.pocId, title: exactMatch.title, contentType: exactMatch.contentType, _id: exactMatch._id } : null,
        regexMatch: regexMatch ? { pocId: regexMatch.pocId, title: regexMatch.title, contentType: regexMatch.contentType, _id: regexMatch._id } : null,
        idMatch: idMatch ? { pocId: idMatch.pocId, title: idMatch.title, contentType: idMatch.contentType, _id: idMatch._id } : null,
        totalCount,
        samplePocIds: samples.map(s => s.pocId)
      }
    });
  } catch (error) {
    console.error('Debug search error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get all chunk audit POCs with optional search
router.get('/pocs', async (req, res) => {
  try {
    const { search, page = 1, limit = 50, contentTypes } = req.query;
    
    let query = {};
    let pocIdsFromChunks = null;
    
    // If search query provided, check if it looks like a MongoDB ObjectId (chunk ID)
    if (search && search.trim()) {
      const searchTerm = search.trim();
      const isObjectId = /^[a-f\d]{24}$/i.test(searchTerm);
      
      if (isObjectId) {
        // Search for chunk ID in both PocEmbedding (DEFAULT-1024T) and Chunk (other chunkers) collections
        // Both collections store _id as strings in the actual database
        console.log(`\n[API Search] ========================================`);
        console.log(`[API Search] Searching for chunk ID: ${searchTerm}`);
        
        try {
          // Search in PocEmbedding for DEFAULT-1024T chunks
          console.log(`[API Search] Searching PocEmbedding collection with string _id: "${searchTerm}"`);
          
          // Try to find the specific document using string _id
          const pocEmbeddings = await PocEmbedding.find({ _id: searchTerm }).select('pocId').lean();
          console.log(`[API Search] Query result for _id="${searchTerm}":`, pocEmbeddings.length > 0 ? pocEmbeddings : 'NOT FOUND');
          
          const pocIdsFromEmbeddings = pocEmbeddings.map(pe => pe.pocId);
          console.log(`[API Search]   - Found in PocEmbedding: ${pocIdsFromEmbeddings.length} chunk(s)`);
          if (pocIdsFromEmbeddings.length > 0) {
            console.log(`[API Search]   - POC IDs: ${JSON.stringify(pocIdsFromEmbeddings)}`);
          }
          
          // Search in Chunk for other chunkers (using string _id)
          console.log(`[API Search] Searching Chunk collection with string _id: "${searchTerm}"`);
          const chunks = await Chunk.find({ _id: searchTerm }).select('pocId').lean();
          const pocIdsFromRegularChunks = chunks.map(c => c.pocId);
          console.log(`[API Search]   - Found in Chunk: ${pocIdsFromRegularChunks.length} chunk(s)`);
          if (pocIdsFromRegularChunks.length > 0) {
            console.log(`[API Search]   - POC IDs: ${JSON.stringify(pocIdsFromRegularChunks)}`);
          }
          
          // Combine both sets of POC IDs
          const allPocIds = [...new Set([...pocIdsFromEmbeddings, ...pocIdsFromRegularChunks])];
          
          console.log(`[API Search] Total unique POC IDs found: ${allPocIds.length}`);
          if (allPocIds.length > 0) {
            console.log(`[API Search] Combined POC IDs: ${JSON.stringify(allPocIds)}`);
          }
          
          if (allPocIds.length > 0) {
            // Search for these POC IDs in ChunkAuditPoc
            query.pocId = { $in: allPocIds };
            pocIdsFromChunks = allPocIds;
            console.log(`[API Search] Will search ChunkAuditPoc with query: ${JSON.stringify(query)}`);
          } else {
            // No POCs found with this chunk ID, return empty results
            query._id = null; // This will match nothing
            console.log(`[API Search] No POCs found with this chunk ID, returning empty results`);
          }
        } catch (error) {
          console.error('[API Search] Error searching chunks:', error);
          console.error('[API Search] Error stack:', error.stack);
          // Fall back to regular text search
        }
      }
      
      // If not an ObjectId or chunk search failed, do regular text search
      if (!pocIdsFromChunks) {
        query = {
          $or: [
            { pocId: { $regex: searchTerm, $options: 'i' } },
            { parentSchemaType: { $regex: searchTerm, $options: 'i' } },
            { schemaType: { $regex: searchTerm, $options: 'i' } },
            { contentType: { $regex: searchTerm, $options: 'i' } },
            { title: { $regex: searchTerm, $options: 'i' } },
            { summaryEn: { $regex: searchTerm, $options: 'i' } },
            { text: { $regex: searchTerm, $options: 'i' } },
            { 'chunks.chunker': { $regex: searchTerm, $options: 'i' } },
            { 'chunks.assessments.method': { $regex: searchTerm, $options: 'i' } }
          ]
        };
        console.log(`\n[API Search] ========================================`);
        console.log(`[API Search] Text search term: "${searchTerm}"`);
      }
    }

    // Filter by content types
    if (contentTypes && contentTypes.length > 0) {
      // Parse contentTypes if it's a string (comma-separated)
      const typesArray = Array.isArray(contentTypes) 
        ? contentTypes 
        : contentTypes.split(',').map(t => t.trim()).filter(t => t);
      
      if (typesArray.length > 0) {
        query.contentType = { $in: typesArray };
        console.log(`[API Search] Content type filter: ${JSON.stringify(typesArray)}`);
      }
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { 
        sortDate: -1,        // Latest first
        contentType: 1,      // Then by content type alphabetically
        title: 1,            // Then by title alphabetically
        createdAt: -1        // Finally by creation date as fallback
      }
    };

    const pocs = await ChunkAuditPoc.find(query)
      .sort(options.sort)
      .limit(options.limit * 1)
      .skip((options.page - 1) * options.limit)
      .exec();

    const total = await ChunkAuditPoc.countDocuments(query);
    
    if (search && search.trim()) {
      console.log(`[API Search] Total matching documents: ${total}`);
      console.log(`[API Search] Documents on this page: ${pocs.length}`);
      if (pocs.length > 0) {
        console.log(`[API Search] First result: pocId="${pocs[0].pocId}", title="${pocs[0].title}"`);
      } else {
        console.log(`[API Search] No results found. Checking sample POCs in database...`);
        const samples = await ChunkAuditPoc.find({}).limit(3).select('pocId title').lean();
        console.log(`[API Search] Sample POCs in database:`);
        samples.forEach(p => console.log(`[API Search]   - pocId: "${p.pocId}"`));
      }
      console.log(`[API Search] ========================================\n`);
    }

    res.json({
      success: true,
      data: pocs,
      pagination: {
        currentPage: options.page,
        totalPages: Math.ceil(total / options.limit),
        totalDocuments: total,
        hasNext: options.page < Math.ceil(total / options.limit),
        hasPrev: options.page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching POCs:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching POCs',
      error: error.message
    });
  }
});

// Get all POC IDs matching search criteria (for global select all)
router.get('/pocs/ids', async (req, res) => {
  try {
    const { search, contentTypes } = req.query;
    
    let query = {};
    
    // If search query provided, use text search
    if (search && search.trim()) {
      query = {
        $or: [
          { pocId: { $regex: search, $options: 'i' } },
          { parentSchemaType: { $regex: search, $options: 'i' } },
          { schemaType: { $regex: search, $options: 'i' } },
          { contentType: { $regex: search, $options: 'i' } },
          { title: { $regex: search, $options: 'i' } },
          { summaryEn: { $regex: search, $options: 'i' } },
          { text: { $regex: search, $options: 'i' } },
          { 'chunks.chunker': { $regex: search, $options: 'i' } },
          { 'chunks.assessments.method': { $regex: search, $options: 'i' } }
        ]
      };
    }

    // Filter by content types
    if (contentTypes && contentTypes.length > 0) {
      // Parse contentTypes if it's a string (comma-separated)
      const typesArray = Array.isArray(contentTypes) 
        ? contentTypes 
        : contentTypes.split(',').map(t => t.trim()).filter(t => t);
      
      if (typesArray.length > 0) {
        query.contentType = { $in: typesArray };
      }
    }

    const pocs = await ChunkAuditPoc.find(query)
      .select('_id')
      .sort({ 
        sortDate: -1,        // Latest first
        contentType: 1,      // Then by content type alphabetically
        title: 1,            // Then by title alphabetically
        createdAt: -1        // Finally by creation date as fallback
      })
      .exec();
    const ids = pocs.map(poc => poc._id.toString());

    res.json({
      success: true,
      data: ids,
      count: ids.length
    });
  } catch (error) {
    console.error('Error fetching POC IDs:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching POC IDs',
      error: error.message
    });
  }
});

// Get distinct content types for filtering
router.get('/pocs/content-types', async (req, res) => {
  try {
    console.log('[content-types] Starting query for distinct contentTypes...');
    const contentTypes = await ChunkAuditPoc.distinct('contentType');
    console.log('[content-types] Distinct contentTypes found:', contentTypes);
    
    // If no content types found, check how many docs exist
    if (!contentTypes || contentTypes.length === 0) {
      const count = await ChunkAuditPoc.countDocuments();
      console.log('[content-types] No content types found. Total ChunkAuditPoc documents:', count);
      
      if (count > 0) {
        const samples = await ChunkAuditPoc.find().select('contentType').limit(5).lean();
        console.log('[content-types] Sample documents:', samples);
      }
    }
    
    res.json({
      success: true,
      data: contentTypes.filter(type => type && type.trim()).sort()
    });
  } catch (error) {
    console.error('Error fetching content types:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching content types',
      error: error.message
    });
  }
});

// Get single POC by _id or pocId
router.get('/pocs/:id', async (req, res) => {
  try {
    let poc;
    const id = req.params.id;
    
    try {
      // First try to find by _id if it looks like a MongoDB ObjectId
      if (id.match(/^[0-9a-fA-F]{24}$/)) {
        poc = await ChunkAuditPoc.findById(id);
      }
      // If not found, try by pocId field
      if (!poc) {
        poc = await ChunkAuditPoc.findOne({ pocId: id });
      }
    } catch (error) {
      // If findById fails (invalid ObjectId), try pocId
      poc = await ChunkAuditPoc.findOne({ pocId: id });
    }
    
    if (!poc) {
      return res.status(404).json({
        success: false,
        message: 'POC not found'
      });
    }

    res.json({
      success: true,
      data: poc
    });
  } catch (error) {
    console.error('Error fetching POC:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching POC',
      error: error.message
    });
  }
});

// Get POCs by multiple IDs (for bulk operations)
router.post('/pocs/bulk', async (req, res) => {
  try {
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request: ids array required'
      });
    }

    const pocs = await ChunkAuditPoc.find({
      _id: { $in: ids }
    });

    res.json({
      success: true,
      data: pocs
    });
  } catch (error) {
    console.error('Error fetching POCs:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching POCs',
      error: error.message
    });
  }
});

// Get chunker information
router.get('/chunkers', async (req, res) => {
  try {
    const chunkers = chunkerService.getAllChunkerInfo();
    res.json({
      success: true,
      data: chunkers
    });
  } catch (error) {
    console.error('Error fetching chunkers:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching chunker information',
      error: error.message
    });
  }
});

// Get chunker statistics
router.get('/chunkers/stats', async (req, res) => {
  try {
    const stats = await chunkerService.getChunkerStatistics();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching chunker statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching chunker statistics',
      error: error.message
    });
  }
});

// Get embeddings by chunker type
router.get('/embeddings/:chunkerType', async (req, res) => {
  try {
    const { chunkerType } = req.params;
    const { pocId } = req.query;
    
    const embeddings = await chunkerService.getEmbeddingsByChunker(chunkerType, pocId);
    
    res.json({
      success: true,
      data: embeddings,
      count: embeddings.length
    });
  } catch (error) {
    console.error('Error fetching embeddings:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching embeddings',
      error: error.message
    });
  }
});

// Get article HTML content for READ POCs
router.get('/pocs/:id/article-content', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get the POC
    let poc;
    try {
      if (id.match(/^[0-9a-fA-F]{24}$/)) {
        poc = await ChunkAuditPoc.findById(id);
      }
      if (!poc) {
        poc = await ChunkAuditPoc.findOne({ pocId: id });
      }
    } catch (error) {
      poc = await ChunkAuditPoc.findOne({ pocId: id });
    }
    
    if (!poc) {
      return res.status(404).json({
        success: false,
        message: 'POC not found'
      });
    }
    
    // Only READ content has article HTML
    if (poc.contentType !== 'READ') {
      return res.status(400).json({
        success: false,
        message: 'Article content only available for READ content type'
      });
    }
    
    // Get the article content
    const Article = getArticleModel();
    const article = await Article.findOne({ _id: poc.pocId });
    
    if (!article || !article.content) {
      return res.status(404).json({
        success: false,
        message: 'Article content not found'
      });
    }
    
    // Get images from the article (read-only access to Faust)
    const images = article.images || [];
    console.log(`Found ${images.length} images for article ${poc.pocId}`);
    
    res.json({
      success: true,
      data: {
        pocId: poc.pocId,
        title: poc.title,
        htmlContent: article.content,
        images: images
      }
    });
  } catch (error) {
    console.error('Error fetching article content:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching article content',
      error: error.message
    });
  }
});

// Get POC with its chunks by chunker type
router.get('/pocs/:id/chunks/:chunkerType', async (req, res) => {
  try {
    const { id, chunkerType } = req.params;
    const { method } = req.query; // Get assessment method from query params
    
    console.log(`=== CHUNKER MODAL DEBUG ===`);
    console.log(`Requested POC ID: ${id}`);
    console.log(`Requested chunker type: ${chunkerType}`);
    console.log(`Assessment method: ${method || 'none'}`);
    
    // Get the POC by either _id (MongoDB ObjectId) or pocId (string)
    let poc;
    try {
      // First try to find by _id if it looks like a MongoDB ObjectId
      if (id.match(/^[0-9a-fA-F]{24}$/)) {
        poc = await ChunkAuditPoc.findById(id);
      }
      // If not found, try by pocId field
      if (!poc) {
        poc = await ChunkAuditPoc.findOne({ pocId: id });
      }
    } catch (error) {
      // If findById fails (invalid ObjectId), try pocId
      poc = await ChunkAuditPoc.findOne({ pocId: id });
    }
    
    if (!poc) {
      console.log(`POC not found with ID/pocId: ${id}`);
      return res.status(404).json({
        success: false,
        message: 'POC not found'
      });
    }
    
    console.log(`Found POC: ${poc.pocId}, Title: ${poc.title}`);

    let chunks = [];
    
    // Determine which collection to use based on chunker type
    if (chunkerType === 'DEFAULT-1024T') {
      // For default chunker, use pocEmbeddings collection, excluding slides
      chunks = await PocEmbedding.find({
        pocId: poc.pocId,
        isSlide: false
      }).sort({ index: 1 });
    } else {
      // For all other chunkers, use chunkAuditChunks collection
      // Try both pocId formats: the poc.pocId field and the MongoDB ObjectId
      chunks = await ChunkAuditChunk.find({
        $or: [
          { pocId: poc.pocId, chunker: chunkerType },
          { pocId: id, chunker: chunkerType }
        ]
      }).sort({ chunkOrder: 1 });
      
      console.log(`Searching for chunks with pocId: ${poc.pocId} OR ${id}, chunker: ${chunkerType}`);
      console.log(`Found ${chunks.length} chunks in chunkAuditChunks collection`);
      
      if (chunks.length > 0) {
        console.log(`First chunk sample:`, {
          chunkId: chunks[0].chunkId,
          chunkOrder: chunks[0].chunkOrder,
          pocId: chunks[0].pocId,
          chunker: chunks[0].chunker,
          contentLength: chunks[0].chunkContent?.length || 0,
          chunkType: chunks[0].chunkType,
          hasMetadata: !!chunks[0].metadata
        });
      } else {
        // Let's also check what chunks exist for this POC with any chunker
        const allChunks1 = await ChunkAuditChunk.find({ pocId: poc.pocId });
        const allChunks2 = await ChunkAuditChunk.find({ pocId: id });
        console.log(`Total chunks for POC ${poc.pocId}: ${allChunks1.length}`);
        console.log(`Total chunks for POC ${id}: ${allChunks2.length}`);
        if (allChunks1.length > 0) {
          console.log(`Available chunkers for pocId ${poc.pocId}:`, [...new Set(allChunks1.map(c => c.chunker))]);
        }
        if (allChunks2.length > 0) {
          console.log(`Available chunkers for pocId ${id}:`, [...new Set(allChunks2.map(c => c.chunker))]);
        }
      }
    }

    // If method is specified, get assessment data for individual chunks
    let assessmentData = {};
    if (method) {
      // Find the chunker assessment data within the POC document structure
      // poc.chunks is an array, find the one with the requested chunkerType
      const chunkerAssessment = poc.chunks?.find(c => c.chunker === chunkerType);
      
      if (chunkerAssessment) {
        // Find the assessment with the requested method
        const methodAssessment = chunkerAssessment.assessments?.find(a => a.method === method);
        
        if (methodAssessment && methodAssessment.qualityAssessments) {
          // Index assessments by chunk index for easy lookup
          methodAssessment.qualityAssessments.forEach(assessment => {
            assessmentData[assessment.index] = {
              index: assessment.index,
              quality: assessment.quality,
              qualityScore: assessment.qualityScore
            };
            console.log(`Assessment for chunk ${assessment.index}: score=${assessment.qualityScore}, quality=${assessment.quality}`);
          });
          console.log(`Found ${Object.keys(assessmentData).length} individual chunk assessments for method ${method}, chunker ${chunkerType}`);
        } else {
          console.log(`No assessments found for method ${method} in chunker ${chunkerType}`);
        }
      } else {
        console.log(`No chunks found for chunker type ${chunkerType}`);
      }
    }

    res.json({
      success: true,
      data: {
        poc: poc,
        chunks: chunks,
        chunkerType: chunkerType,
        assessmentMethod: method,
        assessmentData: assessmentData,
        collection: chunkerType === 'DEFAULT-1024T' ? 'pocEmbeddings' : 'chunkAuditChunks'
      }
    });
  } catch (error) {
    console.error('Error fetching POC with chunks:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching POC with chunks',
      error: error.message
    });
  }
});

// Get POC quality enum values
router.get('/qualities', async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        qualities: Object.values(POC_QUALITY),
        colors: POC_QUALITY_COLORS
      }
    });
  } catch (error) {
    console.error('Error fetching qualities:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching quality information',
      error: error.message
    });
  }
});

// Get available chunkers for selected POCs
router.post('/pocs/available-chunkers', async (req, res) => {
  try {
    const { pocIds } = req.body;
    
    if (!pocIds || !Array.isArray(pocIds) || pocIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'POC IDs array is required'
      });
    }

    console.log(`Getting available chunkers for ${pocIds.length} POCs`);
    
    // Get POCs by pocId and extract unique chunkers from their chunks
    const pocs = await ChunkAuditPoc.find({ pocId: { $in: pocIds } });
    
    if (pocs.length === 0) {
      return res.json({
        success: true,
        data: [],
        message: 'No POCs found'
      });
    }

    // Extract all unique chunker types from the POCs' chunks
    const chunkerTypes = new Set();
    
    for (const poc of pocs) {
      if (poc.chunks && Array.isArray(poc.chunks)) {
        poc.chunks.forEach(chunk => {
          if (chunk.chunker) {
            chunkerTypes.add(chunk.chunker);
          }
        });
      }
    }

    // Also check ChunkAuditChunk collection for additional chunker types
    const chunkDocs = await ChunkAuditChunk.find({ 
      pocId: { $in: pocIds.map(id => id.toString()) } 
    }).distinct('chunker');
    
    chunkDocs.forEach(chunker => {
      if (chunker) {
        chunkerTypes.add(chunker);
      }
    });

    // Filter out deprecated/hidden chunkers
    const deprecatedChunkers = [
      'READ-CONTENT-SHORT-PARA-01',
      'READ-CONTENT-SHORT-PARA-LLM-01'
    ];
    
    const availableChunkers = Array.from(chunkerTypes)
      .filter(Boolean)
      .filter(chunkerType => !deprecatedChunkers.includes(chunkerType));
    
    // Get chunker information for each available chunker
    const chunkerInfo = availableChunkers.map(chunkerType => ({
      type: chunkerType,
      name: getChunkerDisplayName(chunkerType),
      description: getChunkerDescription(chunkerType)
    }));

    console.log(`Found ${availableChunkers.length} available chunkers: ${availableChunkers.join(', ')}`);

    res.json({
      success: true,
      data: chunkerInfo,
      totalPocs: pocs.length,
      availableChunkers: availableChunkers
    });

  } catch (error) {
    console.error('Error fetching available chunkers:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching available chunkers',
      error: error.message
    });
  }
});

// Helper function to get existing chunks for a POC and chunker type
async function getExistingChunks(poc, chunkerType) {
  try {
    const chunks = [];
    
    // Use the same logic as the chunks API endpoint
    if (chunkerType === 'DEFAULT-1024T') {
      // For default chunker, use pocEmbeddings collection, excluding slides
      const embeddings = await PocEmbedding.find({
        pocId: poc.pocId,
        isSlide: false
      }).sort({ index: 1 });
      
      embeddings.forEach((embedding, index) => {
        chunks.push({
          content: embedding.text || '',
          index: embedding.index || index,
          quality: 'UNKNOWN', // Will be assessed
          chunker: chunkerType,
          tokens: embedding.tokens || Math.ceil((embedding.text || '').length / 4),
          embeddingId: embedding._id
        });
      });
    } else {
      // For all other chunkers, use chunkAuditChunks collection
      const chunkDocs = await ChunkAuditChunk.find({
        pocId: poc.pocId,
        chunker: chunkerType
      }).sort({ chunkOrder: 1 });
      
      chunkDocs.forEach((chunkDoc, index) => {
        chunks.push({
          content: chunkDoc.text || '',
          index: chunkDoc.chunkOrder || index,
          quality: chunkDoc.quality || 'UNKNOWN',
          chunker: chunkDoc.chunker,
          tokens: chunkDoc.tokens || Math.ceil((chunkDoc.text || '').length / 4),
          chunkId: chunkDoc.chunkId
        });
      });
    }
    
    console.log(`Found ${chunks.length} existing chunks for POC ${poc.pocId} with chunker ${chunkerType}`);
    return chunks;
    
  } catch (error) {
    console.error(`Error getting existing chunks for POC ${poc._id}:`, error);
    return [];
  }
}

// Helper function to get display name for chunker
function getChunkerDisplayName(chunkerType) {
  // Just return the chunker type itself
  return chunkerType;
}

// Helper function to get description for chunker
function getChunkerDescription(chunkerType) {
  const descriptions = {
    'DEFAULT-1024T': '1024 tokens, 96 overlap',
    'READ-CONTENT-SHORT': 'Short paragraph chunks < 512 tokens',
    'READ-CONTENT-PARA': 'One paragraph per chunk',
    'READ-CONTENT-SHORT-LLM': 'Short paragraph chunks with LLM descriptions',
    'READ-CONTENT-PARA-LLM': 'One paragraph per chunk with LLM descriptions'
  };
  return descriptions[chunkerType] || 'Custom chunker';
}

// Get available quality assessment methods
router.get('/assessment-methods', async (req, res) => {
  try {
    const assessmentMethods = [
      {
        id: 'basic-heuristics',
        name: 'Basic Heuristics Assessment',
        version: '1.0',
        description: 'Rule-based quality assessment using content structure and length analysis',
        detailedDescription: {
          overview: 'A comprehensive rule-based approach that evaluates chunk quality using multiple heuristic criteria.',
          baseScore: 'Every chunk starts with a baseline quality score of 50%.',
          criteria: [
            {
              category: 'Length-Based Scoring',
              weight: '+20%',
              description: 'Chunks are scored based on optimal length ranges for their chunker type',
              rules: [
                '512T chunkers: 400-600 characters',
                '1024T chunkers: 800-1,200 characters',
                '2048T chunkers: 1,600-2,400 characters',
                'Semantic chunkers: 200-1,000 characters'
              ]
            },
            {
              category: 'Content Structure Quality',
              weight: '+10% each',
              description: 'Evaluates the structural integrity of the content',
              rules: [
                'Multiple Sentences: Chunk contains 2+ sentences',
                'Complete Endings: Chunk ends with proper punctuation',
                'Adequate Word Count: Chunk has 10+ words for substantive content'
              ]
            },
            {
              category: 'Content Length Penalties',
              weight: 'Variable',
              description: 'Penalizes chunks that are too short or too long',
              rules: [
                'Too Short (-20%): Less than 50 characters (likely incomplete)',
                'Too Long (-10%): More than 3,000 characters (potentially unwieldy)'
              ]
            },
            {
              category: 'Chunker-Specific Bonuses',
              weight: '+10%',
              description: 'Additional scoring based on chunker type characteristics',
              rules: [
                'Semantic Chunker: Bonus for natural content boundaries (paragraph breaks, sentence transitions)'
              ]
            }
          ],
          qualityRanges: [
            { range: 'Excellent', score: '80%+', description: 'High-quality chunks with optimal structure and length' },
            { range: 'Good', score: '60-79%', description: 'Well-formed chunks with minor issues' },
            { range: 'Fair', score: '40-59%', description: 'Acceptable chunks with some structural problems' },
            { range: 'Poor', score: 'Under 40%', description: 'Poorly formed chunks requiring attention' }
          ],
          existingQualityIntegration: 'When POCs have existing quality ratings, they are converted: GOOD(80%), BAD_CHUNKS(30%), BAD_POC(20%), UNKNOWN(50% - calculated)',
          philosophy: 'Focuses on appropriateness, completeness, readability, and natural content boundaries to create a comprehensive quality assessment.'
        }
      },
      {
        id: 'ai-advanced',
        name: 'AI-Powered Advanced Assessment',
        version: '1.0',
        description: 'GPT-4.1 powered assessment analyzing semantic completeness, concept coherence, and content-specific quality factors',
        detailedDescription: {
          overview: 'Uses Azure OpenAI GPT-4.1 Mini to perform sophisticated analysis of chunk quality, considering context, content type, and semantic boundaries.',
          features: [
            'Semantic completeness analysis',
            'Sentence and paragraph integrity checking',
            'Code example continuity validation',
            'Concept coherence assessment',
            'Content-type specific quality criteria'
          ],
          contentTypeSpecific: {
            'LESSON': [
              'Transcription quality analysis',
              'Music/lyrics detection (RHEINGOLD content)',
              'Language consistency validation',
              'Session content appropriateness'
            ],
            'ARTICLE': [
              'Structural integrity assessment',
              'XHTML semantic boundary respect',
              'Content flow preservation',
              'Article-specific formatting awareness'
            ]
          },
          qualityFactors: [
            'Semantic Completeness: Complete thoughts and concepts',
            'Sentence Integrity: Proper sentence boundaries',
            'Paragraph Boundaries: Natural content breaks',
            'Code Integrity: Complete code examples',
            'Concept Coherence: Related ideas grouped together'
          ],
          costModel: 'Pay-per-use based on Azure OpenAI token consumption',
          philosophy: 'Leverages advanced AI to understand content semantically and assess quality from a human-like perspective.'
        }
      }
    ];

    res.json({
      success: true,
      data: assessmentMethods,
      totalMethods: assessmentMethods.length
    });

  } catch (error) {
    console.error('Error fetching assessment methods:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching assessment methods',
      error: error.message
    });
  }
});

// Assess chunk quality for selected POCs
router.post('/assess-chunk-quality', async (req, res) => {
  try {
    const { selectedChunkerMethods, selectedPocIds, assessmentMethod = 'heuristic-comprehensive', sessionId } = req.body;
    
    // Validate required parameters
    if (!selectedChunkerMethods || !Array.isArray(selectedChunkerMethods) || selectedChunkerMethods.length === 0) {
      return res.status(400).json({ error: 'selectedChunkerMethods array is required' });
    }
    
    if (!selectedPocIds || !Array.isArray(selectedPocIds) || selectedPocIds.length === 0) {
      return res.status(400).json({ error: 'selectedPocIds array is required' });
    }

    // Validate assessment method
    const validMethods = ['basic-heuristics', 'heuristic-comprehensive', 'ai-advanced'];
    if (!validMethods.includes(assessmentMethod)) {
      return res.status(400).json({ error: `Invalid assessment method. Must be one of: ${validMethods.join(', ')}` });
    }

    // Generate session ID if not provided
    const currentSessionId = sessionId || `assessment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Initialize progress tracking
    progressTracker.initializeProgress(currentSessionId, selectedPocIds.length, assessmentMethod, selectedChunkerMethods);

    const results = [];
    let processedCount = 0;
    const totalPocs = selectedPocIds.length;

    console.log(`Starting quality assessment using ${assessmentMethod} method for ${totalPocs} POCs (Session: ${currentSessionId})`);

    // Process each POC
    for (const pocId of selectedPocIds) {
      processedCount++;
      console.log(`Processing POC ${processedCount}/${totalPocs}: ${pocId}`);
      
      try {
        // Get POC data by either _id or pocId
        let poc;
        try {
          // First try to find by _id if it looks like a MongoDB ObjectId
          if (pocId.match(/^[0-9a-fA-F]{24}$/)) {
            poc = await ChunkAuditPoc.findById(pocId);
          }
          // If not found, try by pocId field
          if (!poc) {
            poc = await ChunkAuditPoc.findOne({ pocId: pocId });
          }
        } catch (error) {
          // If findById fails (invalid ObjectId), try pocId
          poc = await ChunkAuditPoc.findOne({ pocId: pocId });
        }
        
        if (!poc) {
          console.warn(`POC not found with ID/pocId: ${pocId}`);
          progressTracker.completePocProgress(currentSessionId, pocId, 'POC Not Found', {
            success: false,
            skipped: true,
            error: 'POC not found in database'
          });
          continue;
        }

        // Update progress
        progressTracker.updatePocProgress(currentSessionId, pocId, poc.title);

        // Get chunks for this POC and methods using the same logic as working endpoints
        console.log(`Looking for chunks for POC ${pocId} (poc.pocId: ${poc.pocId}), chunker methods: ${selectedChunkerMethods.join(', ')}`);
        
        const chunks = [];
        for (const method of selectedChunkerMethods) {
          if (method === 'DEFAULT-1024T') {
            // For default chunker, use pocEmbeddings collection
            console.log(`Querying PocEmbedding with pocId: ${poc.pocId}, isSlide: false`);
            const embeddings = await PocEmbedding.find({
              pocId: poc.pocId,
              isSlide: false
            }).sort({ index: 1 });
            
            console.log(`PocEmbedding query returned ${embeddings.length} results`);
            if (embeddings.length > 0) {
              console.log(`First embedding: _id=${embeddings[0]._id}, pocId=${embeddings[0].pocId}, text length=${(embeddings[0].text || '').length}`);
            }
            
            embeddings.forEach((embedding, index) => {
              chunks.push({
                _id: embedding._id,
                chunkContent: embedding.text || '',
                chunkOrder: embedding.index || index,
                chunker: method,
                quality: 'UNKNOWN',
                tokens: embedding.tokens || Math.ceil((embedding.text || '').length / 4),
                chunkType: 'section',
                metadata: {}
              });
            });
            console.log(`Added ${embeddings.length} chunks from PocEmbedding for ${method}`);
          } else {
            // For all other chunkers, use chunkAuditChunks collection
            console.log(`Querying ChunkAuditChunk with pocId: ${poc.pocId}, chunker: ${method}`);
            const chunkDocs = await ChunkAuditChunk.find({
              pocId: poc.pocId,
              chunker: method
            }).sort({ chunkOrder: 1 });
            
            console.log(`ChunkAuditChunk query returned ${chunkDocs.length} results`);
            
            chunkDocs.forEach((chunkDoc) => {
              chunks.push({
                _id: chunkDoc._id,
                chunkContent: chunkDoc.chunkContent || chunkDoc.text || '',
                chunkOrder: chunkDoc.chunkOrder,
                chunker: chunkDoc.chunker,
                quality: chunkDoc.quality || 'UNKNOWN',
                tokens: chunkDoc.tokens || Math.ceil((chunkDoc.chunkContent || chunkDoc.text || '').length / 4),
                chunkType: chunkDoc.chunkType || 'section',
                metadata: chunkDoc.metadata || {}
              });
            });
            console.log(`Added ${chunkDocs.length} chunks from ChunkAuditChunk for ${method}`);
          }
        }
        
        console.log(`Total chunks found: ${chunks.length}`);

        if (chunks.length === 0) {
          console.warn(`No chunks found for POC ${pocId} with methods ${selectedChunkerMethods.join(', ')}`);
          progressTracker.completePocProgress(currentSessionId, pocId, poc.title, {
            success: false,
            skipped: true,
            error: `No chunks found for selected chunker methods: ${selectedChunkerMethods.join(', ')}`,
            chunksProcessed: 0
          });
          
          // Still add to results to track skipped POCs
          results.push({
            pocId: pocId,
            pocTitle: poc.title,
            parentSchemaType: poc.parentSchemaType,
            schemaType: poc.schemaType,
            contentType: poc.contentType,
            originalLength: poc.originalContent ? poc.originalContent.length : 0,
            chunkerResults: {},
            skipped: true,
            reason: `No chunks found for chunker methods: ${selectedChunkerMethods.join(', ')}`
          });
          continue;
        }

        // Process chunks by method
        const chunkerResults = {};
        
        for (const method of selectedChunkerMethods) {
          const methodChunks = chunks.filter(chunk => chunk.chunker === method);
          
          if (methodChunks.length === 0) {
            console.warn(`No chunks found for method ${method} in POC ${pocId}`);
            continue;
          }

          console.log(`Assessing ${methodChunks.length} chunks for method ${method} in POC ${pocId} using ${assessmentMethod}`);
          
          let totalScore = 0;
          let assessedChunks = 0;
          const assessmentDetails = [];
          let totalCost = 0;

          if (assessmentMethod === 'ai-advanced') {
            try {
              // Prepare POC data with chunks for enhanced AI assessment
              const pocForAI = {
                pocId: poc.pocId,
                name: poc.title,
                text: poc.text,
                schemaType: poc.schemaType,
                contentType: poc.contentType,
                chunks: methodChunks.map((c, idx) => ({
                  _id: c._id,
                  text: c.chunkContent,
                  index: c.chunkOrder || idx,
                  isSlide: false
                }))
              };

              // Get article data if this is an ARTICLE type
              if (poc.schemaType === 'ARTICLE') {
                try {
                  const Article = getArticleModel();
                  const article = await Article.findOne({ _id: poc.pocId });
                  if (article) {
                    pocForAI.htmlContent = article.htmlContent;
                    pocForAI.content = article.content; // Fallback HTML content
                    pocForAI.searchContent = article.searchContent;
                    
                    if (!article.htmlContent && article.content) {
                      console.log(`Using article.content as fallback for POC ${poc.pocId} - htmlContent not available`);
                    }
                  }
                } catch (articleError) {
                  console.warn(`Could not fetch article data for POC ${poc.pocId}:`, articleError.message);
                }
              }

              // Create AI assessment instance and call new API
              // Start a heartbeat to show progress during AI call (which can take 30-60 seconds)
              let heartbeatCounter = 0;
              const heartbeatInterval = setInterval(() => {
                heartbeatCounter++;
                progressTracker.updateChunkProgress(
                  currentSessionId,
                  pocId,
                  poc.title,
                  Math.min(heartbeatCounter, methodChunks.length),
                  methodChunks.length,
                  `Analyzing with AI... (${Math.floor(heartbeatCounter * 2)}s elapsed)`
                );
              }, 2000); // Update every 2 seconds
              
              const aiAssessment = new AIQualityAssessment();
              const aiResult = await aiAssessment.assessSinglePoc(pocForAI, method, progressTracker, currentSessionId, poc.title, methodChunks.length);
              
              // Stop the heartbeat
              clearInterval(heartbeatInterval);
              
              console.log(`AI assessment result for POC ${pocId}, method ${method}:`);
              console.log(`- Chunk count: ${aiResult.chunkCount}`);
              console.log(`- Chunk scores length: ${aiResult.chunkScores?.length || 0}`);
              console.log(`- Overall score: ${aiResult.qualityScore}`);
              console.log(`- Cost: ${aiResult.cost}`);
              
              // AI assessment now provides individual chunk scores
              totalCost = aiResult.cost || 0;
              
              // Use the individual chunk assessments from AI service
              if (aiResult.chunkScores && aiResult.chunkScores.length > 0) {
                console.log(`Processing ${aiResult.chunkScores.length} individual chunk scores`);
                
                // Process chunks with progress updates - update every 10 chunks or on last chunk
                for (let idx = 0; idx < aiResult.chunkScores.length; idx++) {
                  const chunkScore = aiResult.chunkScores[idx];
                  
                  // Update progress every 10 chunks, on first chunk, and on last chunk
                  if (idx === 0 || idx % 10 === 0 || idx === aiResult.chunkScores.length - 1) {
                    progressTracker.updateChunkProgress(
                      currentSessionId,
                      pocId,
                      poc.title,
                      idx + 1,
                      aiResult.chunkScores.length,
                      'Processing AI results...'
                    );
                    // Small delay to allow UI to update
                    await new Promise(resolve => setTimeout(resolve, 100));
                  }
                  
                  const chunk = methodChunks.find(c => c.chunkOrder === chunkScore.chunkIndex);
                  if (chunk) {
                    console.log(`Found chunk ${chunkScore.chunkIndex} with score ${chunkScore.score}`);
                    totalScore += chunkScore.score;
                    assessedChunks++;
                    
                    assessmentDetails.push({
                      chunkId: chunk._id,
                      chunkIndex: chunk.chunkOrder,
                      score: chunkScore.score,
                      factors: {
                        aiQuality: chunkScore.score,
                        issues: chunkScore.issues.length,
                        recommendations: chunkScore.recommendations.length
                      },
                      recommendations: chunkScore.recommendations,
                      reasoning: `AI Assessment: ${chunkScore.issues.join(', ') || 'No specific issues identified'}`,
                      cost: chunkScore.cost
                    });
                  } else {
                    console.warn(`Could not find chunk with chunkOrder ${chunkScore.chunkIndex} in methodChunks`);
                  }
                }
                console.log(`Successfully processed ${assessedChunks} chunks for assessment details`);
              } else {
                // AI service failed to return individual chunk scores - this should not happen with the new service
                throw new Error('AI service did not return individual chunk scores as expected');
              }
              
            } catch (aiError) {
              // Stop the heartbeat on error
              if (typeof heartbeatInterval !== 'undefined') {
                clearInterval(heartbeatInterval);
              }
              console.error(`AI assessment failed for method ${method} in POC ${pocId}: ${aiError.message}`);
              // No fallback - let the AI assessment fail properly
              throw aiError;
            }
          } else {
            // Heuristic assessment - process each chunk individually
            for (let i = 0; i < methodChunks.length; i++) {
              const chunk = methodChunks[i];
              
              // Update progress with chunk-level details
              progressTracker.updateChunkProgress(
                currentSessionId,
                pocId,
                poc.title,
                i + 1,
                methodChunks.length
              );
              
              try {
                const assessment = assessChunkQualityNew(chunk, poc);
                
                if (!assessment || typeof assessment.overallScore !== 'number') {
                  throw new Error('Assessment returned invalid result');
                }
                
                totalScore += assessment.overallScore;
                assessedChunks++;
                
                assessmentDetails.push({
                  chunkId: chunk._id,
                  chunkIndex: chunk.chunkOrder,
                  score: assessment.overallScore,
                  factors: assessment.factors,
                  recommendations: assessment.recommendations,
                  reasoning: assessment.reasoning || 'Heuristic assessment'
                });
              } catch (chunkError) {
                console.error(`Error assessing chunk ${chunk._id}:`, chunkError);
                assessmentDetails.push({
                  chunkId: chunk._id,
                  chunkIndex: chunk.chunkOrder,
                  error: chunkError.message
                });
              }
            }
          }

          if (assessedChunks > 0) {
            const averageScore = totalScore / assessedChunks;
            chunkerResults[method] = {
              totalChunks: methodChunks.length,
              assessedChunks,
              averageScore: Math.round(averageScore * 100) / 100,
              assessmentDetails,
              ...(totalCost > 0 && { totalCost: Math.round(totalCost * 10000) / 10000 }) // Round to 4 decimal places
            };
          }
        }

        if (Object.keys(chunkerResults).length > 0) {
          // Save assessment results to database for export functionality
          try {
            const allQualityAssessments = [];
            
            for (const [method, result] of Object.entries(chunkerResults)) {
              if (result.assessmentDetails) {
                result.assessmentDetails.forEach(detail => {
                  // Extract issues from the reasoning field for AI assessments
                  let issues = [];
                  if (detail.reasoning && detail.reasoning.startsWith('AI Assessment:')) {
                    const issueText = detail.reasoning.replace('AI Assessment: ', '');
                    if (issueText !== 'No specific issues identified') {
                      issues = issueText.split(', ').filter(issue => issue.trim().length > 0);
                    }
                  }
                  
                  allQualityAssessments.push({
                    index: detail.chunkIndex,
                    method: assessmentMethod,
                    chunker: method,
                    qualityScore: detail.score,
                    quality: getQualityDescription(detail.score, issues),
                    updatedAt: new Date()
                  });
                });
              }
            }
            
            if (allQualityAssessments.length > 0) {
              // Group assessments by chunker
              const chunkerSummary = {};
              const chunkerCosts = {};
              
              // Calculate total assessment cost for this session by chunker
              for (const [method, result] of Object.entries(chunkerResults)) {
                chunkerCosts[method] = result.totalCost || 0;
              }
              
              // Group individual chunk assessments by chunker
              const assessmentsByChunker = {};
              allQualityAssessments.forEach(assessment => {
                const { chunker } = assessment;
                if (!assessmentsByChunker[chunker]) {
                  assessmentsByChunker[chunker] = [];
                }
                assessmentsByChunker[chunker].push({
                  index: assessment.index,
                  quality: assessment.quality,
                  qualityScore: assessment.qualityScore
                });
                
                if (!chunkerSummary[chunker]) {
                  chunkerSummary[chunker] = {
                    scores: [],
                    cost: chunkerCosts[chunker] || 0
                  };
                }
                chunkerSummary[chunker].scores.push(assessment.qualityScore);
              });
              
              // Get current POC to read existing chunks structure
              const currentPoc = await ChunkAuditPoc.findOne({ pocId: pocId }).lean();
              if (!currentPoc) {
                console.error(`POC ${pocId} not found for update`);
                continue;
              }
              
              // Build the updated chunks array
              const updatedChunks = currentPoc.chunks ? [...currentPoc.chunks] : [];
              
              // Update or create chunk entries with new assessment results
              for (const [chunkerType, summary] of Object.entries(chunkerSummary)) {
                const averageScore = summary.scores.reduce((sum, score) => sum + score, 0) / summary.scores.length;
                
                // Find existing chunk entry for this chunker
                const chunkIndex = updatedChunks.findIndex(c => c.chunker === chunkerType);
                
                if (chunkIndex === -1) {
                  // Create new chunk entry with first assessment
                  updatedChunks.push({
                    chunker: chunkerType,
                    assessments: [{
                      method: assessmentMethod,
                      qualityScore: averageScore,
                      assessmentCost: summary.cost,
                      updatedAt: new Date(),
                      qualityAssessments: assessmentsByChunker[chunkerType] || []
                    }]
                  });
                  console.log(`Will create new chunk entry for chunker ${chunkerType} with ${assessmentsByChunker[chunkerType]?.length || 0} individual chunk assessments`);
                } else {
                  const chunkEntry = updatedChunks[chunkIndex];
                  
                  // Migrate old single-object structure to array if needed
                  if (chunkEntry.assessments && !Array.isArray(chunkEntry.assessments)) {
                    chunkEntry.assessments = [chunkEntry.assessments];
                    console.log(`Migrated old assessment structure to array for chunker ${chunkerType}`);
                  }
                  
                  // Ensure assessments is an array
                  if (!Array.isArray(chunkEntry.assessments)) {
                    chunkEntry.assessments = [];
                  }
                  
                  // Find existing assessment for this method
                  const assessmentIndex = chunkEntry.assessments.findIndex(a => a.method === assessmentMethod);
                  
                  if (assessmentIndex !== -1) {
                    // Update existing assessment for this method
                    const existingAssessment = chunkEntry.assessments[assessmentIndex];
                    let newCost = summary.cost;
                    
                    // For ai-advanced method, accumulate the cost (additive) from previous runs
                    if (assessmentMethod === 'ai-advanced') {
                      newCost = (existingAssessment.assessmentCost || 0) + summary.cost;
                    }
                    
                    chunkEntry.assessments[assessmentIndex] = {
                      method: assessmentMethod,
                      qualityScore: averageScore,
                      assessmentCost: newCost,
                      updatedAt: new Date(),
                      qualityAssessments: assessmentsByChunker[chunkerType] || []
                    };
                    console.log(`Will update ${assessmentMethod} assessment for chunker ${chunkerType} with ${assessmentsByChunker[chunkerType]?.length || 0} individual chunk assessments`);
                  } else {
                    // Add new assessment for this method
                    chunkEntry.assessments.push({
                      method: assessmentMethod,
                      qualityScore: averageScore,
                      assessmentCost: summary.cost,
                      updatedAt: new Date(),
                      qualityAssessments: assessmentsByChunker[chunkerType] || []
                    });
                    console.log(`Will add new ${assessmentMethod} assessment for chunker ${chunkerType} with ${assessmentsByChunker[chunkerType]?.length || 0} individual chunk assessments`);
                  }
                }
              }
              
              // Use findOneAndUpdate to bypass version checking for documents without __v
              await ChunkAuditPoc.findOneAndUpdate(
                { pocId: pocId },
                { $set: { chunks: updatedChunks } },
                { new: true, strict: false }
              );
              console.log(`Updated chunks.assessments structure for POC ${pocId} using findOneAndUpdate`);
            }
          } catch (saveError) {
            console.error(`Error saving assessment results for POC ${pocId}:`, saveError);
          }
          
          results.push({
            pocId: pocId,
            pocTitle: poc.title,
            parentSchemaType: poc.parentSchemaType,
            schemaType: poc.schemaType,
            contentType: poc.contentType,
            originalLength: poc.originalContent ? poc.originalContent.length : 0,
            chunkerResults
          });

          // Calculate cost for this POC
          let pocCost = 0;
          Object.values(chunkerResults).forEach(methodResult => {
            pocCost += methodResult.totalCost || 0;
          });

          // Update progress tracker with success
          progressTracker.completePocProgress(currentSessionId, pocId, poc.title, {
            success: true,
            cost: pocCost,
            chunksProcessed: chunks.length
          });
        }

      } catch (pocError) {
        console.error(`Error processing POC ${pocId}:`, pocError);
        
        // Try to get POC title safely
        let pocTitle = 'Unknown POC';
        try {
          const errorPoc = await ChunkAuditPoc.findOne({ pocId: pocId });
          if (errorPoc) {
            pocTitle = errorPoc.title;
          }
        } catch (titleError) {
          // Ignore error when getting title
        }
        
        // Update progress tracker with error
        progressTracker.completePocProgress(currentSessionId, pocId, pocTitle, {
          success: false,
          error: pocError.message,
          chunksProcessed: 0
        });
        
        results.push({
          pocId: pocId,
          error: pocError.message
        });
      }
    }

    // Calculate total cost if AI method was used
    let totalSessionCost = 0;
    if (assessmentMethod === 'ai-advanced') {
      results.forEach(result => {
        if (result.chunkerResults) {
          Object.values(result.chunkerResults).forEach(methodResult => {
            totalSessionCost += methodResult.totalCost || 0;
          });
        }
      });
    }

    console.log(`Quality assessment completed. Processed ${results.length} POCs using ${assessmentMethod} method`);
    if (totalSessionCost > 0) {
      console.log(`Total AI assessment cost: $${totalSessionCost.toFixed(4)}`);
    }

    // Transform results to match expected frontend structure
    const pocResults = [];
    let totalChunks = 0;
    let totalQualitySum = 0;

    results.forEach(result => {
      if (result.chunkerResults && !result.error) {
        // Calculate average quality across all chunker methods for this POC
        let pocQualitySum = 0;
        let pocChunkCount = 0;
        
        Object.values(result.chunkerResults).forEach(methodResult => {
          pocQualitySum += methodResult.averageScore * methodResult.assessedChunks;
          pocChunkCount += methodResult.assessedChunks;
          totalChunks += methodResult.assessedChunks;
          totalQualitySum += methodResult.averageScore * methodResult.assessedChunks;
        });

        const pocAverageQuality = pocChunkCount > 0 ? pocQualitySum / pocChunkCount : 0;
        const safePocAverageQuality = isNaN(pocAverageQuality) ? 0 : pocAverageQuality;
        
        pocResults.push({
          pocId: result.pocId,
          pocName: result.pocTitle || 'Untitled',
          parentSchemaType: result.parentSchemaType || 'N/A',
          schemaType: result.schemaType || 'N/A',
          contentType: result.contentType || 'N/A',
          chunkCount: pocChunkCount,
          averageQuality: safePocAverageQuality,
          assessmentTime: 0, // This would need to be tracked if needed
          chunkerResults: result.chunkerResults // Keep for detailed view
        });
      } else if (result.error) {
        pocResults.push({
          pocId: result.pocId,
          pocName: 'Error',
          parentSchemaType: 'N/A',
          schemaType: 'N/A', 
          contentType: 'N/A',
          chunkCount: 0,
          averageQuality: 0,
          assessmentTime: 0,
          error: result.error
        });
      }
    });

    const overallAverageQuality = totalChunks > 0 ? totalQualitySum / totalChunks : 0;
    
    // Ensure overallAverageQuality is a valid number
    const safeOverallAverageQuality = isNaN(overallAverageQuality) ? 0 : overallAverageQuality;
    
    // Prepare final results
    const finalResults = {
      success: true,
      sessionId: currentSessionId,
      totalPocs: pocResults.length,
      totalChunks: totalChunks,
      averageQuality: safeOverallAverageQuality,
      chunkerType: selectedChunkerMethods[0], // For compatibility, use first method
      assessmentMethod: assessmentMethod,
      totalAssessmentTime: 0, // This would need to be tracked if needed
      pocResults: pocResults,
      ...(totalSessionCost > 0 && { totalCost: Math.round(totalSessionCost * 10000) / 10000 })
    };

    // Complete progress tracking
    progressTracker.completeSession(currentSessionId, finalResults);
    
    res.json(finalResults);

  } catch (error) {
    console.error('Error in assess-chunk-quality:', error);
    
    // Handle error in progress tracking if sessionId exists
    if (req.body.sessionId) {
      progressTracker.handleError(req.body.sessionId, error);
    }
    
    res.status(500).json({ 
      error: 'Internal server error during quality assessment',
      details: error.message 
    });
  }
});

// Server-Sent Events endpoint for progress tracking
router.get('/assessment-progress/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  
  if (!sessionId) {
    return res.status(400).json({ error: 'Session ID is required' });
  }

  progressTracker.addClient(sessionId, res);
});

// Get time estimation for assessment
router.post('/assessment-time-estimate', async (req, res) => {
  try {
    const { selectedPocIds, assessmentMethod, selectedChunkerMethods } = req.body;
    
    if (!selectedPocIds || !Array.isArray(selectedPocIds) || selectedPocIds.length === 0) {
      return res.status(400).json({ error: 'selectedPocIds array is required' });
    }

    // Sample a few POCs to estimate average chunks per POC
    const sampleSize = Math.min(5, selectedPocIds.length);
    const samplePocIds = selectedPocIds.slice(0, sampleSize);
    
    let totalChunks = 0;
    let validPocs = 0;

    for (const pocId of samplePocIds) {
      try {
        const poc = await ChunkAuditPoc.findOne({ pocId: pocId });
        if (!poc) continue;

        let pocChunks = 0;
        for (const method of selectedChunkerMethods) {
          if (method === 'DEFAULT-1024T') {
            const embeddings = await PocEmbedding.find({
              pocId: poc.pocId,
              isSlide: false
            });
            pocChunks += embeddings.length;
          } else {
            const chunkDocs = await ChunkAuditChunk.find({
              pocId: poc.pocId,
              chunker: method
            });
            pocChunks += chunkDocs.length;
          }
        }
        
        if (pocChunks > 0) {
          totalChunks += pocChunks;
          validPocs++;
        }
      } catch (error) {
        console.warn(`Error sampling POC ${pocId}:`, error);
      }
    }

    const averageChunksPerPoc = validPocs > 0 ? Math.ceil(totalChunks / validPocs) : 10;
    const estimate = await progressTracker.getTimeEstimate(assessmentMethod, selectedPocIds.length, averageChunksPerPoc);

    res.json({
      success: true,
      estimate: {
        ...estimate,
        totalPocs: selectedPocIds.length,
        sampledPocs: validPocs,
        averageChunksPerPoc,
        totalEstimatedChunks: selectedPocIds.length * averageChunksPerPoc
      }
    });

  } catch (error) {
    console.error('Error calculating time estimate:', error);
    res.status(500).json({
      success: false,
      error: 'Error calculating time estimate',
      details: error.message
    });
  }
});

// Helper function to convert quality enum to numeric score
function convertQualityToScore(qualityEnum) {
  const qualityScores = {
    'GOOD': 0.8,
    'BAD_POC': 0.2,
    'BAD_CHUNKS': 0.3,
    'UNKNOWN': 0.5
  };
  return qualityScores[qualityEnum] || 0.5;
}

// Helper function to save quality assessments to database
async function saveQualityAssessments(poc, chunkAssessments, assessmentMethod) {
  try {
    const qualityAssessmentsToSave = chunkAssessments.map((assessment, index) => ({
      method: assessmentMethod,
      index: index,
      quality: getQualityDescription(assessment.quality),
      qualityScore: assessment.quality,
      updatedAt: new Date(),
      auditCost: 0.0
    }));

    // Remove existing assessments for this method
    poc.qualityAssessments = poc.qualityAssessments || [];
    poc.qualityAssessments = poc.qualityAssessments.filter(
      assessment => assessment.method !== assessmentMethod
    );

    // Add new assessments
    poc.qualityAssessments.push(...qualityAssessmentsToSave);

    // Save the updated POC
    await poc.save();
    
    console.log(`Saved ${qualityAssessmentsToSave.length} quality assessments for POC ${poc._id} using method ${assessmentMethod}`);
    
  } catch (error) {
    console.error('Error saving quality assessments:', error);
    throw error;
  }
}

// Helper function to convert quality score to text description
function getQualityDescription(qualityScore, issues = []) {
  let baseDescription;
  if (qualityScore >= 0.8) {
    baseDescription = 'Excellent - High-quality chunk with optimal structure and length';
  } else if (qualityScore >= 0.6) {
    baseDescription = 'Good - Well-formed chunk with minor issues';
  } else if (qualityScore >= 0.4) {
    baseDescription = 'Fair - Acceptable chunk with some structural problems';
  } else {
    baseDescription = 'Poor';
  }
  
  // If we have specific AI-identified issues, include them
  if (issues && issues.length > 0) {
    const issueText = issues.join(', ');
    if (qualityScore < 0.8) {
      return `${baseDescription} - ${issueText}`;
    } else {
      return `${baseDescription}. Note: ${issueText}`;
    }
  }
  
  // Fallback to generic description for lower scores without specific issues
  if (qualityScore < 0.4) {
    return 'Poor - Poorly formed chunk requiring attention';
  }
  
  return baseDescription;
}

// Helper function to assess chunk quality using basic heuristics
function assessChunkQualityBasicHeuristics(chunk, chunkerType) {
  let quality = 0.5; // Base quality score
  
  const content = chunk.content || '';
  const length = content.length;
  
  console.log(`Assessing chunk ${chunk.index}: length=${length}, chunkerType=${chunkerType}`);
  console.log(`Content preview: "${content.substring(0, 100)}..."`);
  
  // Length-based scoring
  if (chunkerType.includes('512T') && length >= 400 && length <= 600) {
    quality += 0.2;
    console.log('  +0.2 for good 512T length');
  } else if (chunkerType.includes('1024T') && length >= 800 && length <= 1200) {
    quality += 0.2;
    console.log('  +0.2 for good 1024T length');
  } else if (chunkerType.includes('2048T') && length >= 1600 && length <= 2400) {
    quality += 0.2;
    console.log('  +0.2 for good 2048T length');
  } else if (chunkerType === 'SEMANTIC' && length >= 200 && length <= 1000) {
    quality += 0.2;
    console.log('  +0.2 for good SEMANTIC length');
  }
  
  // Content quality indicators
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length >= 2) {
    quality += 0.1; // Has multiple sentences
    console.log('  +0.1 for multiple sentences');
  }
  
  // Check for complete sentences
  if (content.trim().match(/[.!?]$/)) {
    quality += 0.1; // Ends with punctuation
    console.log('  +0.1 for ending punctuation');
  }
  
  // Avoid very short or very long chunks
  if (length < 50) {
    quality -= 0.2; // Too short
    console.log('  -0.2 for too short');
  } else if (length > 3000) {
    quality -= 0.1; // Potentially too long
    console.log('  -0.1 for too long');
  }
  
  // Check for coherence indicators
  const words = content.split(/\s+/).filter(w => w.length > 0);
  if (words.length >= 10) {
    quality += 0.1; // Reasonable word count
    console.log('  +0.1 for reasonable word count');
  }
  
  // Semantic chunker gets bonus for natural boundaries
  if (chunkerType === 'SEMANTIC') {
    if (content.includes('\n\n') || content.match(/\. [A-Z]/)) {
      quality += 0.1; // Natural paragraph or sentence boundaries
      console.log('  +0.1 for natural boundaries');
    }
  }
  
  // Ensure score is between 0 and 1
  const finalScore = Math.max(0, Math.min(1, quality));
  console.log(`  Final score: ${finalScore}`);
  return finalScore;
}

// New comprehensive heuristic assessment function for modern schema
function assessChunkQualityNew(chunk, poc) {
  const content = chunk.chunkContent || chunk.content || '';
  const method = chunk.chunker || chunk.method || '';
  const chunkLength = content.length;
  
  // Base quality factors
  const factors = {
    lengthAppropriate: 0,
    sentenceIntegrity: 0,
    paragraphBoundaries: 0,
    contentCompleteness: 0,
    readability: 0
  };
  
  const recommendations = [];
  
  // 1. Length appropriateness (30% weight)
  let targetMin, targetMax;
  if (method.includes('512')) {
    targetMin = 400; targetMax = 600;
  } else if (method.includes('1024')) {
    targetMin = 800; targetMax = 1200;
  } else if (method.includes('2048')) {
    targetMin = 1600; targetMax = 2400;
  } else if (method === 'SEMANTIC') {
    targetMin = 200; targetMax = 1000;
  } else {
    targetMin = 300; targetMax = 800; // Default
  }
  
  if (chunkLength >= targetMin && chunkLength <= targetMax) {
    factors.lengthAppropriate = 0.9;
  } else if (chunkLength < targetMin * 0.7) {
    factors.lengthAppropriate = 0.3;
    recommendations.push('Chunk is too short - consider merging with adjacent chunks');
  } else if (chunkLength > targetMax * 1.3) {
    factors.lengthAppropriate = 0.4;
    recommendations.push('Chunk is too long - consider splitting into smaller chunks');
  } else {
    factors.lengthAppropriate = 0.7;
  }
  
  // 2. Sentence integrity (25% weight)
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 5);
  const endsWithPunctuation = /[.!?]\s*$/.test(content.trim());
  const startsWithCapital = /^[A-Z]/.test(content.trim());
  
  if (sentences.length >= 2 && endsWithPunctuation && startsWithCapital) {
    factors.sentenceIntegrity = 0.9;
  } else if (sentences.length >= 1) {
    factors.sentenceIntegrity = 0.6;
    if (!endsWithPunctuation) recommendations.push('Chunk does not end with proper punctuation');
    if (!startsWithCapital) recommendations.push('Chunk does not start with capital letter');
  } else {
    factors.sentenceIntegrity = 0.3;
    recommendations.push('Chunk appears to contain incomplete sentences');
  }
  
  // 3. Paragraph boundaries (20% weight)
  const hasNaturalBreaks = content.includes('\n\n') || content.includes('\n');
  const hasProperFlow = content.match(/\. [A-Z]/) !== null;
  
  if (hasNaturalBreaks || hasProperFlow) {
    factors.paragraphBoundaries = 0.8;
  } else if (sentences.length <= 3) {
    factors.paragraphBoundaries = 0.7; // Short chunks don't need paragraph breaks
  } else {
    factors.paragraphBoundaries = 0.5;
    recommendations.push('Consider respecting natural paragraph boundaries');
  }
  
  // 4. Content completeness (15% weight)
  const words = content.split(/\s+/).filter(w => w.length > 0);
  const hasCodeBlocks = content.includes('```') || content.includes('`');
  const hasIncompleteCode = hasCodeBlocks && !content.match(/```[\s\S]*?```/);
  
  if (words.length >= 10 && !hasIncompleteCode) {
    factors.contentCompleteness = 0.8;
  } else if (words.length >= 5) {
    factors.contentCompleteness = 0.6;
    if (hasIncompleteCode) recommendations.push('Code blocks appear incomplete');
  } else {
    factors.contentCompleteness = 0.4;
    recommendations.push('Chunk may be too short to contain complete thoughts');
  }
  
  // 5. Readability (10% weight)
  const avgWordsPerSentence = sentences.length > 0 ? words.length / sentences.length : 0;
  const hasReasonableFlow = avgWordsPerSentence >= 5 && avgWordsPerSentence <= 25;
  
  if (hasReasonableFlow) {
    factors.readability = 0.8;
  } else {
    factors.readability = 0.6;
    if (avgWordsPerSentence > 25) recommendations.push('Sentences may be too long for readability');
    if (avgWordsPerSentence < 5) recommendations.push('Sentences may be too short or fragmented');
  }
  
  // Calculate weighted overall score
  const overallScore = (
    factors.lengthAppropriate * 0.30 +
    factors.sentenceIntegrity * 0.25 +
    factors.paragraphBoundaries * 0.20 +
    factors.contentCompleteness * 0.15 +
    factors.readability * 0.10
  );
  
  // Add method-specific recommendations
  if (method === 'SEMANTIC') {
    recommendations.push('Semantic chunking should maintain conceptual coherence');
  } else if (method.includes('FIXED')) {
    recommendations.push('Fixed-size chunking may split concepts unnaturally');
  }
  
  return {
    overallScore: Math.round(overallScore * 100) / 100,
    factors,
    recommendations: recommendations.slice(0, 3) // Limit to top 3 recommendations
  };
}

// Export quality assessment reports for selected POCs
router.post('/export-quality-reports', async (req, res) => {
  try {
    const { pocIds, filterByMethod, filterByChunker, filterByTimeRange } = req.body;
    
    if (!pocIds || !Array.isArray(pocIds) || pocIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'POC IDs array is required'
      });
    }

    console.log(`Fetching quality assessments for ${pocIds.length} POCs with filters:`, { filterByMethod, filterByChunker, filterByTimeRange });
    
    // Fetch POCs with their quality assessments
    // Try to find by both _id (if it's a valid ObjectId) and pocId field
    const pocsWithAssessments = await ChunkAuditPoc.find({
      $or: [
        { _id: { $in: pocIds.filter(id => id.match(/^[0-9a-fA-F]{24}$/)) } },
        { pocId: { $in: pocIds } }
      ]
    }).lean();

    const exportData = [];
    let totalAssessments = 0;

    // Process each POC
    pocsWithAssessments.forEach(poc => {
      // Check for assessments in the chunks array (new structure)
      if (poc.chunks && poc.chunks.length > 0) {
        poc.chunks.forEach(chunk => {
          const chunkerType = chunk.chunker;
          
          if (chunk.assessments && Array.isArray(chunk.assessments)) {
            chunk.assessments.forEach(assessment => {
              // Apply filter by assessment method
              if (filterByMethod && assessment.method !== filterByMethod) {
                return;
              }
              
              // Apply filter by chunker type
              if (filterByChunker && chunkerType !== filterByChunker) {
                return;
              }
              
              // Apply filter by time range
              if (filterByTimeRange) {
                const assessmentTime = new Date(assessment.updatedAt);
                const startTime = new Date(filterByTimeRange.startTime);
                const endTime = new Date(filterByTimeRange.endTime);
                
                if (assessmentTime < startTime || assessmentTime > endTime) {
                  return;
                }
              }
              
              // Process individual chunk assessments
              if (assessment.qualityAssessments && Array.isArray(assessment.qualityAssessments)) {
                assessment.qualityAssessments.forEach(chunkAssessment => {
                  exportData.push({
                    pocId: poc._id,
                    pocName: poc.title || 'Untitled POC',
                    parentSchemaType: poc.parentSchemaType || 'N/A',
                    schemaType: poc.schemaType || 'N/A',
                    contentType: poc.contentType || 'N/A',
                    chunkIndex: chunkAssessment.index,
                    chunkerType: chunkerType,
                    assessmentMethod: assessment.method,
                    qualityScore: chunkAssessment.qualityScore,
                    qualityDescription: chunkAssessment.quality,
                    chunkLength: 0, // Will need to calculate if needed
                    tokens: 0, // Will need to calculate if needed
                    assessmentTime: 0, // Time taken for assessment
                    assessmentDate: assessment.updatedAt
                  });
                  totalAssessments++;
                });
              }
            });
          }
        });
      }
      
      // Also check for assessments in the old structure (poc.qualityAssessments)
      if (poc.qualityAssessments && poc.qualityAssessments.length > 0) {
        poc.qualityAssessments.forEach(assessment => {
          // Apply filters if provided
          let includeAssessment = true;
          
          // Filter by assessment method
          if (filterByMethod && assessment.method !== filterByMethod) {
            includeAssessment = false;
          }
          
          // Filter by chunker type
          if (filterByChunker && assessment.chunker !== filterByChunker) {
            includeAssessment = false;
          }
          
          // Filter by time range
          if (filterByTimeRange && includeAssessment) {
            const assessmentTime = new Date(assessment.updatedAt);
            const startTime = new Date(filterByTimeRange.startTime);
            const endTime = new Date(filterByTimeRange.endTime);
            
            if (assessmentTime < startTime || assessmentTime > endTime) {
              includeAssessment = false;
            }
          }
          
          if (includeAssessment) {
            exportData.push({
              pocId: poc._id,
              pocName: poc.title || 'Untitled POC',
              parentSchemaType: poc.parentSchemaType || 'N/A',
              schemaType: poc.schemaType || 'N/A',
              contentType: poc.contentType || 'N/A',
              chunkIndex: assessment.index,
              chunkerType: assessment.chunker || 'N/A',
              assessmentMethod: assessment.method,
              qualityScore: assessment.qualityScore,
              qualityDescription: assessment.quality,
              chunkLength: 0, // Will need to calculate if needed
              tokens: 0, // Will need to calculate if needed  
              assessmentTime: 0, // Time taken for assessment
              assessmentDate: assessment.updatedAt
            });
            totalAssessments++;
          }
        });
      }
    });

    // Sort by pocId, then chunker type, then by chunk index
    exportData.sort((a, b) => {
      // First sort by pocId
      const pocIdA = String(a.pocId || '');
      const pocIdB = String(b.pocId || '');
      if (pocIdA !== pocIdB) {
        return pocIdA.localeCompare(pocIdB);
      }
      // Then by chunker type
      if (a.chunkerType !== b.chunkerType) {
        return a.chunkerType.localeCompare(b.chunkerType);
      }
      // Finally by chunk index
      return (a.chunkIndex || 0) - (b.chunkIndex || 0);
    });

    console.log(`Found ${totalAssessments} quality assessments across ${pocsWithAssessments.length} POCs`);

    res.json({
      success: true,
      data: exportData,
      summary: {
        totalPocs: pocsWithAssessments.length,
        totalAssessments: totalAssessments,
        exportDate: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error exporting quality reports:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting quality reports',
      error: error.message
    });
  }
});

// Get cost information for a specific POC
router.get('/costs/:pocId', async (req, res) => {
  try {
    const { pocId } = req.params;
    
    const costData = await ChunkAuditCosts.getTotalCostForPoc(pocId);
    
    res.json({
      success: true,
      pocId: pocId,
      costs: costData
    });

  } catch (error) {
    console.error('Error fetching POC costs:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching cost data',
      error: error.message
    });
  }
});

// Get costs within a date range
router.get('/costs', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'startDate and endDate query parameters are required'
      });
    }
    
    const costData = await ChunkAuditCosts.getCostsInDateRange(startDate, endDate);
    
    // Calculate totals
    const totals = costData.reduce((acc, day) => ({
      totalInputTokens: acc.totalInputTokens + day.dailyInputTokens,
      totalOutputTokens: acc.totalOutputTokens + day.dailyOutputTokens,
      totalCost: acc.totalCost + day.dailyCost,
      totalCalls: acc.totalCalls + day.callCount
    }), { totalInputTokens: 0, totalOutputTokens: 0, totalCost: 0, totalCalls: 0 });
    
    res.json({
      success: true,
      dateRange: { startDate, endDate },
      dailyBreakdown: costData,
      totals: totals
    });

  } catch (error) {
    console.error('Error fetching cost data:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching cost data',
      error: error.message
    });
  }
});

// Process READ POCs with semantic chunkers
// In-memory job tracker for batch chunk creation
const chunkJobs = new Map();

router.post('/chunk-read-pocs', async (req, res) => {
  try {
    let { pocIds, chunkerType = 'READ-CONTENT-PARA', sessionId } = req.body;
    
    if (!pocIds || !Array.isArray(pocIds) || pocIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'pocIds array is required'
      });
    }

    // Normalize chunkerType to uppercase (handle case-insensitive input)
    chunkerType = (chunkerType || '').toString().toUpperCase();

    console.log(`Processing ${pocIds.length} POCs with chunker: ${chunkerType}`);

    // Initialize progress tracking if sessionId provided
    if (sessionId) {
      progressTracker.initializeProgress(sessionId, pocIds.length, null, [chunkerType]);
    }

    // If more than 50 POCs, process in background and return job ID
    if (pocIds.length > 50) {
      const jobId = `chunk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Create job entry with per-POC tracking
      chunkJobs.set(jobId, {
        id: jobId,
        status: 'queued',
        totalPocs: pocIds.length,
        processedPocs: [],  // Track individual POC completions
        failedPocs: [],
        chunkerType,
        createdAt: new Date(),
        pocIds  // Store for reference
      });

      // Process in background without awaiting
      processChunksInBackground(jobId, pocIds, chunkerType);

      return res.json({
        success: true,
        message: `Large batch job queued for processing (${pocIds.length} POCs)`,
        jobId,
        status: 'queued',
        note: 'Use /chunk-job-status/:jobId to check progress'
      });
    }

    // For smaller batches, process synchronously as before
    const results = await processChunksSync(pocIds, chunkerType, sessionId ? { sessionId, progressTracker } : null);

    // Send completion event if tracking session
    if (sessionId) {
      progressTracker.sendEvent(sessionId, 'completed', {
        success: true,
        message: 'Chunk creation completed',
        chunkerType: chunkerType,
        totalPocsProvided: pocIds.length,
        readPocsProcessed: results.readPocsProcessed,
        results: {
          successful: results.successful,
          failed: results.failed,
          totalChunks: results.totalChunks
        },
        costs: results.costs || { totalCost: 0, details: [] }
      });
    }

    res.json({
      success: true,
      message: `Processed ${results.successful.length} READ POCs with ${chunkerType}`,
      chunkerType: chunkerType,
      totalPocsProvided: pocIds.length,
      readPocsProcessed: results.readPocsProcessed,
      results: {
        successful: results.successful,
        failed: results.failed,
        totalChunks: results.totalChunks
      },
      costs: results.costs || { totalCost: 0, details: [] }
    });

  } catch (error) {
    console.error('Error processing READ POCs with semantic chunker:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing READ POCs',
      error: error.message
    });
  }
});

// Get chunk job status with detailed progress
router.get('/chunk-job-status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = chunkJobs.get(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: `Job ${jobId} not found`
      });
    }

    const totalProcessed = job.processedPocs.length + job.failedPocs.length;
    const progress = Math.round((totalProcessed / job.totalPocs) * 100);

    res.json({
      success: true,
      job: {
        id: job.id,
        status: job.status,
        totalPocs: job.totalPocs,
        processedCount: totalProcessed,
        successfulCount: job.processedPocs.length,
        failedCount: job.failedPocs.length,
        processedPocs: job.processedPocs,  // Return the actual array for frontend
        failedPocs: job.failedPocs,        // Return the actual array for frontend
        progress: progress,
        chunkerType: job.chunkerType,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
        totalCost: job.totalCost || 0,
        costDetails: job.costDetails || [],
        // Return last few completed POCs for UI feedback
        lastCompleted: job.processedPocs.slice(-3),
        recentErrors: job.failedPocs.slice(0, 3)
      }
    });
  } catch (error) {
    console.error('Error getting job status:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting job status',
      error: error.message
    });
  }
});

// Helper function to process chunks synchronously (original logic)
async function processChunksSync(pocIds, chunkerType, progressContext) {
  console.log(`[processChunksSync] Called with progressContext: ${progressContext ? 'YES (' + progressContext.sessionId + ')' : 'NO'}, pocIds: ${pocIds.length}`);
  // Normalize chunkerType to uppercase in case it comes in lowercase
  chunkerType = (chunkerType || '').toString().toUpperCase();
  const sessionId = progressContext?.sessionId;
  
  // Import the appropriate chunker based on chunkerType
  let chunker;
  let chunkerName;
  
  if (chunkerType === 'READ-CONTENT-PARA') {
    const ReadContentParaChunker = require('../services/ReadContentParaChunker');
    chunker = new ReadContentParaChunker();
    chunkerName = 'READ-CONTENT-PARA';
  } else if (chunkerType === 'READ-CONTENT-PARA-LLM') {
    const ReadContentParaLLMChunker = require('../services/ReadContentParaLLMChunker');
    chunker = new ReadContentParaLLMChunker();
    chunkerName = 'READ-CONTENT-PARA-LLM';
  } else if (chunkerType === 'READ-CONTENT-SHORT') {
    const ReadContentShortChunker = require('../services/ReadContentShortChunker');
    chunker = new ReadContentShortChunker();
    chunkerName = 'READ-CONTENT-SHORT';
  } else if (chunkerType === 'READ-CONTENT-SHORT-LLM') {
    const ReadContentShortLLMChunker = require('../services/ReadContentShortLLMChunker');
    chunker = new ReadContentShortLLMChunker();
    chunkerName = 'READ-CONTENT-SHORT-LLM';
  } else {
    // Default to READ-CONTENT-PARA
    const ReadContentParaChunker = require('../services/ReadContentParaChunker');
    chunker = new ReadContentParaChunker();
    chunkerName = 'READ-CONTENT-PARA';
  }

  // Get POC data from PieceOfContent collection to get all metadata fields
  const { PieceOfContent } = require('../models');
  let pocs = await PieceOfContent.find({ _id: { $in: pocIds } });
  
  // If not found in PieceOfContent, try ChunkAuditPoc as fallback
  if (pocs.length === 0) {
    console.log(`No POCs found in PieceOfContent for IDs: ${pocIds.join(', ')}, trying ChunkAuditPoc...`);
    pocs = await ChunkAuditPoc.find({ pocId: { $in: pocIds } });
    
    if (pocs.length === 0) {
      throw new Error(`No POCs found for the provided IDs`);
    }
    console.log(`Found ${pocs.length} POCs in ChunkAuditPoc collection`);
  } else {
    console.log(`Found ${pocs.length} POCs in PieceOfContent collection`);
  }

  // Filter to only READ content type POCs
  const readPocs = pocs.filter(poc => poc.contentType === 'READ');
  
  if (readPocs.length === 0) {
    throw new Error(`No READ content type POCs found`);
  }

  // Process the READ POCs with semantic chunker
  const results = await chunker.processMultipleReadPOCs(readPocs, progressContext);

  // Update chunkAuditPocs to record which POCs have been processed by this chunker
  for (const successResult of results.successful) {
    try {
      const currentPoc = await ChunkAuditPoc.findOne({ pocId: successResult.pocId });
      
      if (currentPoc) {
        // Check if this chunker type already exists
        const hasChunker = currentPoc.chunks?.some(chunk => chunk.chunker === chunkerType);
        
        if (!hasChunker) {
          // Update the document using pocId for lookup
          await ChunkAuditPoc.updateOne(
            { pocId: successResult.pocId },
            {
              $push: {
                chunks: {
                  chunker: chunkerType
                }
              }
            }
          );
        }
      }
    } catch (updateError) {
      console.error(`Failed to update chunkAuditPocs for POC ${successResult.pocId}:`, updateError);
    }
  }

  // Fetch cost data for successful POCs (especially for LLM chunkers)
  // Collect costs returned by chunkers for this session
  let totalCost = 0;
  let costDetails = [];
  
  if (results.successful.length > 0) {
    // Collect costs from the processMultipleReadPOCs results
    // Each successful result may have a 'costs' object with totalCost and details array
    for (const successResult of results.successful) {
      if (successResult.costs) {
        // Handle both formats: object with {totalCost, details} and array for backwards compatibility
        if (Array.isArray(successResult.costs)) {
          // Old format: array of cost objects
          for (const cost of successResult.costs) {
            totalCost += cost.totalCost || 0;
            costDetails.push({
              pocId: cost.pocId,
              inputTokens: cost.inputTokens,
              outputTokens: cost.outputTokens,
              totalCost: cost.totalCost
            });
          }
        } else if (successResult.costs.totalCost !== undefined) {
          // New format: {totalCost, details} object
          totalCost += successResult.costs.totalCost || 0;
          if (successResult.costs.details && Array.isArray(successResult.costs.details)) {
            costDetails.push(...successResult.costs.details);
          }
        }
      }
    }
  }

  return {
    successful: results.successful,
    failed: results.failed,
    totalChunks: results.totalChunks,
    readPocsProcessed: readPocs.length,
    costs: {
      totalCost: totalCost,
      details: costDetails
    }
  };
}

// Helper function to process chunks in background batches
async function processChunksInBackground(jobId, pocIds, chunkerType) {
  const job = chunkJobs.get(jobId);
  if (!job) return;

  job.status = 'processing';
  job.totalCost = 0;
  job.costDetails = [];
  const startTime = Date.now();
  console.log(`[Background Job ${jobId}] Starting processing of ${pocIds.length} POCs with chunker: ${chunkerType}`);

  const BATCH_SIZE = 10; // Process 10 POCs at a time
  
  try {
    for (let i = 0; i < pocIds.length; i += BATCH_SIZE) {
      const batch = pocIds.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(pocIds.length / BATCH_SIZE);
      const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);
      
      try {
        console.log(`[Background Job ${jobId}] Processing batch ${batchNum}/${totalBatches} (${batch.length} POCs) - Elapsed: ${elapsedSeconds}s`);
        
        const batchResults = await processChunksSync(batch, chunkerType);
        
        // Collect costs from batch (especially for LLM chunkers)
        if (batchResults.costs) {
          job.totalCost += batchResults.costs.totalCost || 0;
          if (batchResults.costs.details && Array.isArray(batchResults.costs.details)) {
            job.costDetails.push(...batchResults.costs.details);
          }
        }
        
        // Track individual POC completions
        for (const pocId of batch) {
          const pocIndex = job.pocIds.indexOf(pocId);
          if (pocIndex >= 0) {
            job.processedPocs.push({
              pocId: pocId,
              completedAt: new Date()
            });
          }
        }
        
        // Track failures
        if (batchResults.failed && batchResults.failed.length > 0) {
          for (const failedPoc of batchResults.failed) {
            job.failedPocs.push({
              pocId: failedPoc,
              error: 'Processing failed'
            });
          }
        }
        
        const totalProcessed = job.processedPocs.length + job.failedPocs.length;
        const progressPercent = Math.round((totalProcessed / job.totalPocs) * 100);
        console.log(`[Background Job ${jobId}] Batch ${batchNum} complete. Progress: ${totalProcessed}/${job.totalPocs} (${progressPercent}%) - Elapsed: ${elapsedSeconds}s`);
      } catch (batchError) {
        console.error(`[Background Job ${jobId}] Error processing batch ${batchNum}:`, batchError.message);
        
        // Mark all batch POCs as failed
        for (const pocId of batch) {
          job.failedPocs.push({
            pocId: pocId,
            error: batchError.message
          });
        }
      }
      
      // Small delay between batches to avoid overwhelming the system
      // Use 100ms for large batches (500+ POCs), 500ms for smaller batches
      const delayMs = pocIds.length > 100 ? 100 : 500;
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    job.status = 'completed';
    job.completedAt = new Date();
    const totalTime = Math.round((Date.now() - startTime) / 1000);
    console.log(`[Background Job ${jobId}] Processing complete in ${totalTime}s. Successful: ${job.processedPocs.length}, Failed: ${job.failedPocs.length}`);
  } catch (error) {
    job.status = 'failed';
    job.completedAt = new Date();
    const totalTime = Math.round((Date.now() - startTime) / 1000);
    console.error(`[Background Job ${jobId}] Fatal error after ${totalTime}s:`, error);
  }
}

// Original router.post code removed and replaced above

// Get all costs (for debugging/admin purposes)
router.get('/costs/all/list', async (req, res) => {
  try {
    const { limit = 100, skip = 0 } = req.query;
    
    const costs = await ChunkAuditCosts.find({})
      .sort({ updatedAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));
    
    const totalCosts = await ChunkAuditCosts.countDocuments();
    
    res.json({
      success: true,
      costs: costs,
      pagination: {
        total: totalCosts,
        limit: parseInt(limit),
        skip: parseInt(skip)
      }
    });

  } catch (error) {
    console.error('Error fetching all costs:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching cost data',
      error: error.message
    });
  }
});

// Get chunker availability for POCs (which chunkers have chunks available)
router.post('/pocs/chunker-availability', async (req, res) => {
  try {
    const { pocIds } = req.body;
    
    if (!pocIds || !Array.isArray(pocIds) || pocIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'POC IDs array is required'
      });
    }

    console.log(`Getting chunker availability for ${pocIds.length} POCs`);
    
    // Get POCs by pocId field
    const pocs = await ChunkAuditPoc.find({ pocId: { $in: pocIds } }).select('_id pocId contentType');
    
    const availabilityMap = {};
    
    for (const poc of pocs) {
      const availability = {
        pocId: poc._id.toString(),
        contentType: poc.contentType,
        chunkers: {}
      };
      
      // Check for default chunker (pocEmbeddings collection)
      const defaultChunkerCount = await PocEmbedding.countDocuments({
        pocId: poc.pocId,
        isSlide: false
      });
      
      if (defaultChunkerCount > 0) {
        availability.chunkers['DEFAULT-1024T'] = {
          hasChunks: true,
          chunkCount: defaultChunkerCount,
          collection: 'pocEmbeddings'
        };
      }
      
      // Check for other chunkers (chunkAuditChunks collection)
      const chunkAuditResults = await ChunkAuditChunk.aggregate([
        { $match: { pocId: poc.pocId } },
        { $group: { _id: '$chunker', count: { $sum: 1 } } }
      ]);
      
      chunkAuditResults.forEach(result => {
        if (result._id) {
          availability.chunkers[result._id] = {
            hasChunks: true,
            chunkCount: result.count,
            collection: 'chunkAuditChunks'
          };
        }
      });
      
      // Add available chunkers that could process this POC but haven't yet
      const allChunkers = Object.values(CHUNKER_TYPES);
      allChunkers.forEach(chunkerType => {
        if (!availability.chunkers[chunkerType]) {
          // Check if this chunker supports this content type
          const chunkerUtils = require('../constants/chunkers').ChunkerUtils;
          const supportsContentType = chunkerUtils.supportsContentType(chunkerType, poc.contentType);
          
          availability.chunkers[chunkerType] = {
            hasChunks: false,
            chunkCount: 0,
            canProcess: supportsContentType,
            collection: chunkerUtils.getAssociatedCollection(chunkerType) || 'chunkAuditChunks'
          };
        }
      });
      
      availabilityMap[poc._id.toString()] = availability;
    }

    res.json({
      success: true,
      data: availabilityMap,
      totalPocs: pocs.length
    });

  } catch (error) {
    console.error('Error fetching chunker availability:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching chunker availability',
      error: error.message
    });
  }
});

// RAG Search endpoint
router.post('/rag-search', async (req, res) => {
  try {
    const { question, chunker, useAuditedPocsOnly, enableLLM, pageSize } = req.body;

    if (!question || typeof question !== 'string' || question.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Question is required'
      });
    }

    // Validate pageSize if provided
    if (pageSize !== undefined && pageSize !== null) {
      const pageSizeNum = parseInt(pageSize, 10);
      if (isNaN(pageSizeNum) || pageSizeNum < 1 || pageSizeNum > 500) {
        return res.status(400).json({
          success: false,
          message: 'Page size must be between 1 and 500'
        });
      }
    }

    // Import RAG search service
    const { ragSearch } = require('../rag');
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;

    // Prepare context with chunker filter if provided
    const context = {
      app: 'entwickler',
      platform: 'rag',
      user: req.user, // If authentication is enabled
      chunker: chunker || null, // Pass chunker filter to context
      useAuditedPocsOnly: useAuditedPocsOnly !== undefined ? useAuditedPocsOnly : false,
      pageSize: pageSize !== undefined && pageSize !== null ? parseInt(pageSize, 10) : null // Pass custom page size
    };

    // Perform RAG search
    const useLLM = enableLLM === true; // Default to false
    console.log(`Performing RAG search for: "${question}"${chunker ? ` and chunker: ${chunker}` : ''}${useAuditedPocsOnly ? ' (audited POCs only)' : ''}${useLLM ? ' with LLM answer' : ''}${pageSize ? ` with page size: ${pageSize}` : ''}`);

    const results = await ragSearch.ragSearch(db, question.trim(), context, useLLM);

    if (!results) {
      return res.json({
        success: true,
        data: {
          combined: [],
          retrieval: [],
          embeddings: [],
          keywords: null,
          llmAnswer: null,
          total: 0
        }
      });
    }

    res.json({
      success: true,
      data: {
        combined: results.combined,
        retrieval: results.retrieval,
        embeddings: results.embeddings,
        keywords: results.keywords,
        llmAnswer: results.llmAnswer || null,
        total: results.combined.length,
        totalRetrieval: results.retrieval.length,
        totalEmbeddings: results.embeddings.length
      }
    });

  } catch (error) {
    console.error('Error performing RAG search:', error);
    res.status(500).json({
      success: false,
      message: 'Error performing RAG search',
      error: error.message
    });
  }
});

// Serve documentation files with markdown rendering
router.get('/docs/:filename', (req, res) => {
  const path = require('path');
  const fs = require('fs');
  const { filename } = req.params;
  
  // Security: only allow markdown files
  if (!filename.endsWith('.md')) {
    return res.status(400).send('Only markdown files are allowed');
  }
  
  const filePath = path.join(__dirname, '../../docs', filename);
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Documentation file not found');
  }
  
  // Read and render the markdown file
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).send('Error reading documentation file');
    }
    
    // Escape the markdown content for embedding in JavaScript
    const escapedMarkdown = data
      .replace(/\\/g, '\\\\')
      .replace(/`/g, '\\`')
      .replace(/\$/g, '\\$');
    
    // Send HTML page with client-side markdown rendering
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${filename.replace('.md', '')} - Documentation</title>
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 900px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        #content {
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #2c3e50;
            border-bottom: 3px solid #667eea;
            padding-bottom: 10px;
        }
        h2 {
            color: #34495e;
            margin-top: 30px;
            border-bottom: 2px solid #e9ecef;
            padding-bottom: 8px;
        }
        h3 {
            color: #495057;
            margin-top: 25px;
        }
        code {
            background: #f8f9fa;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Monaco', 'Courier New', monospace;
            font-size: 0.9em;
            color: #e83e8c;
        }
        pre {
            background: #282c34;
            color: #abb2bf;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
        }
        pre code {
            background: transparent;
            color: inherit;
            padding: 0;
        }
        table {
            border-collapse: collapse;
            width: 100%;
            margin: 20px 0;
        }
        th, td {
            border: 1px solid #dee2e6;
            padding: 12px;
            text-align: left;
        }
        th {
            background: #f8f9fa;
            font-weight: 600;
        }
        tr:nth-child(even) {
            background: #f8f9fa;
        }
        a {
            color: #667eea;
            text-decoration: none;
        }
        a:hover {
            text-decoration: underline;
        }
        blockquote {
            border-left: 4px solid #667eea;
            padding-left: 20px;
            margin-left: 0;
            color: #666;
        }
        hr {
            border: none;
            border-top: 2px solid #e9ecef;
            margin: 30px 0;
        }
        ul, ol {
            padding-left: 30px;
        }
        li {
            margin: 8px 0;
        }
    </style>
</head>
<body>
    <div id="content"></div>
    <script>
        const markdown = \`${escapedMarkdown}\`;
        document.getElementById('content').innerHTML = marked.parse(markdown);
    </script>
</body>
</html>
    `;
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  });
});

module.exports = router;