const express = require('express');
const router = express.Router();
const concordApi = require('../services/concordApi');
const canApi = require('../services/canApi');

// Middleware to require authentication
function requireAuth(req, res, next) {
  // Skip authentication check if SKIP_AUTH is enabled
  if (process.env.SKIP_AUTH === 'true') {
    return next();
  }
  
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized' });
}

/**
 * GET /api/courses
 * Fetch all courses from Concord API
 */
router.get('/courses', requireAuth, async (req, res) => {
  try {
    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];
    
    const { 
      genres = ['RHEINGOLD'], 
      startDateFrom = today,
      page = 1,
      pageSize = 100
    } = req.query;

    const genresArray = Array.isArray(genres) ? genres : [genres];
    
    const courses = await concordApi.getCourses({
      genres: genresArray,
      startDateFrom,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    });

    res.json(courses);
  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({ 
      error: 'Failed to fetch courses',
      message: error.message 
    });
  }
});

/**
 * GET /api/attendees/:courseId
 * Fetch attendees for a specific course from CAN API
 */
router.get('/attendees/:courseId', requireAuth, async (req, res) => {
  try {
    const { courseId } = req.params;
    const attendees = await canApi.getAttendees(courseId);
    
    res.json({ 
      success: true,
      count: attendees.length,
      attendees 
    });
  } catch (error) {
    console.error('Error fetching attendees:', error);
    res.status(500).json({ 
      error: 'Failed to fetch attendees',
      message: error.message 
    });
  }
});

/**
 * POST /api/attendees/bulk
 * Fetch attendees for multiple courses at once
 */
router.post('/attendees/bulk', requireAuth, async (req, res) => {
  try {
    const { courseIds } = req.body;
    
    if (!Array.isArray(courseIds) || courseIds.length === 0) {
      return res.status(400).json({ 
        error: 'courseIds must be a non-empty array' 
      });
    }

    // Fetch attendees for all courses in parallel from CAN API
    const attendeePromises = courseIds.map(courseId => 
      canApi.getAttendees(courseId)
    );

    const attendeeArrays = await Promise.all(attendeePromises);
    
    // Flatten the array of arrays
    const allAttendees = attendeeArrays.flat();

    res.json({ 
      success: true,
      count: allAttendees.length,
      attendees: allAttendees 
    });
  } catch (error) {
    console.error('Error fetching bulk attendees:', error);
    res.status(500).json({ 
      error: 'Failed to fetch attendees',
      message: error.message 
    });
  }
});

/**
 * POST /api/badge/print
 * Mark a badge as printed
 */
router.post('/badge/print', requireAuth, async (req, res) => {
  try {
    const { attendeeId, badgeNumber, timestamp } = req.body;
    
    if (!attendeeId) {
      return res.status(400).json({ error: 'attendeeId is required' });
    }

    // Call the mutation (to be implemented when provided)
    const result = await concordApi.markBadgePrinted(attendeeId);

    res.json({ 
      success: true,
      attendeeId,
      badgeNumber,
      printedAt: timestamp || new Date().toISOString(),
      result
    });
  } catch (error) {
    console.error('Error marking badge as printed:', error);
    res.status(500).json({ 
      error: 'Failed to mark badge as printed',
      message: error.message 
    });
  }
});

/**
 * GET /api/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    service: 'flight-deck',
    apis: {
      concord: process.env.CONCORD_API_URL || 'https://concord-stage.sandsmedia.com/graphql',
      can: process.env.CAN_API_URL || 'https://can-stage.sandsmedia.com/graphql'
    }
  });
});

/**
 * POST /api/can/query
 * Generic CAN API query endpoint
 */
router.post('/can/query', requireAuth, async (req, res) => {
  try {
    const { query, variables } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'query is required' });
    }

    const result = await canApi.query(query, variables || {});
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('CAN API query error:', error);
    res.status(500).json({ 
      error: 'CAN API query failed',
      message: error.message 
    });
  }
});

/**
 * POST /api/can/mutation
 * Generic CAN API mutation endpoint
 */
router.post('/can/mutation', requireAuth, async (req, res) => {
  try {
    const { mutation, variables } = req.body;
    
    if (!mutation) {
      return res.status(400).json({ error: 'mutation is required' });
    }

    const result = await canApi.mutate(mutation, variables || {});
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('CAN API mutation error:', error);
    res.status(500).json({ 
      error: 'CAN API mutation failed',
      message: error.message 
    });
  }
});

module.exports = router;
