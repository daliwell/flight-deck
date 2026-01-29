// Load environment variables first
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');

// Import authentication
const passport = require('./src/config/passport');
const { requireSandsMediaAuth } = require('./src/middleware/auth');

// Import routes
const apiRoutes = require('./src/routes/api');
const authRoutes = require('./src/routes/auth');
const managementRoutes = require('./src/routes/management');

const app = express();
const PORT = process.env.PORT || 3005;

// Middleware (basic setup)
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Start server
const startServer = async () => {
  try {
    console.log('🚀 Initializing Flight Deck...');
    console.log('🏠 Environment:', process.env.NODE_ENV || 'development');
    
    // Session configuration (using memory store for now, can use file-based or Redis if needed)
    app.use(session({
      secret: process.env.SESSION_SECRET || 'flight-deck-secret-key',
      resave: false,
      saveUninitialized: false,
      proxy: true, // Trust the ALB proxy
      cookie: {
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // 'none' required for OAuth redirects in production
        domain: process.env.NODE_ENV === 'production' ? 'flightdeck.sandsmedia.com' : undefined
      }
    }));

    // Initialize Passport
    app.use(passport.initialize());
    app.use(passport.session());

    // Authentication routes (unprotected)
    app.use('/auth', authRoutes);

    // Health check endpoint (unprotected)
    app.get('/health', async (req, res) => {
      res.json({
        status: 'ok',
        service: 'flight-deck',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        concordApi: process.env.CONCORD_API_URL || 'https://concord-stage.sandsmedia.com/graphql'
      });
    });

    // Serve SVG logo without authentication (needed for login page)
    app.get('/flight.svg', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'flight.svg'));
    });

    // Protect all static files and routes with authentication
    // In development mode with SKIP_AUTH=true, bypass authentication
    if (process.env.SKIP_AUTH !== 'true') {
      app.use(requireSandsMediaAuth);
    } else {
      console.log('⚠️  Authentication bypassed (SKIP_AUTH=true)');
    }

    // Serve static files from public directory (now protected) with no-cache headers
    app.use(express.static(path.join(__dirname, 'public'), {
      setHeaders: (res, path) => {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
    }));

    // API routes (protected)
    app.use('/api', apiRoutes);
    
    // Management routes
    app.use('/management', managementRoutes);

    // Serve main page (protected)
    app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    // Error handling middleware
    app.use((err, req, res, next) => {
      console.error(err.stack);
      res.status(500).json({
        success: false,
        message: 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
      });
    });

    // 404 handler
    app.use((req, res) => {
      res.status(404).json({
        success: false,
        message: 'Route not found'
      });
    });
    
    app.listen(PORT, () => {
      console.log(`✅ Flight Deck server running on port ${PORT}`);
      console.log(`🌐 Visit http://localhost:${PORT} to view the application`);
      console.log(`📡 Concord API: ${process.env.CONCORD_API_URL || 'https://concord-stage.sandsmedia.com/graphql'}`);
      console.log(`🔐 Authentication: ${process.env.SKIP_AUTH === 'true' ? 'DISABLED' : 'ENABLED'}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
