// Load environment variables first
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const MongoStore = require('connect-mongo');

// Import database connection and services
const connectDB = require('./src/config/database');
const AzureOpenAIService = require('./src/services/azureOpenAI');

// Import authentication
const passport = require('./src/config/passport');
const { requireSandsMediaAuth } = require('./src/middleware/auth');

// Import routes
const apiRoutes = require('./src/routes/api');
const authRoutes = require('./src/routes/auth');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware (basic setup)
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Connect to database and start server
const startServer = async () => {
  try {
    console.log('Initializing application configuration...');
    console.log('🏠 Detected local environment - using .env file configuration...');
    console.log('📄 Using environment variables for configuration');
    
    // Initialize Azure OpenAI service
    const azureOpenAI = new AzureOpenAIService();

    // Session configuration
    app.use(session({
      secret: process.env.SESSION_SECRET || 'your-secret-key',
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI_CAN,
        touchAfter: 24 * 3600 // lazy session update
      }),
      cookie: {
        secure: false, // Set to true in production with HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'lax'
      }
    }));

    // Initialize Passport
    app.use(passport.initialize());
    app.use(passport.session());

    // Authentication routes (unprotected)
    app.use('/auth', authRoutes);

    // Health check endpoint (unprotected)
    app.get('/health', async (req, res) => {
      try {
        // Test Azure OpenAI connection
        const azureOpenAI = new AzureOpenAIService();
        const openaiStatus = await azureOpenAI.testConnection();
        
        res.json({
          status: 'ok',
          timestamp: new Date().toISOString(),
          services: {
            database: 'connected',
            azureOpenAI: openaiStatus ? 'connected' : 'disconnected'
          },
          configSource: 'Environment Variables (.env)',
          environment: 'Local Development',
          nodeEnv: process.env.NODE_ENV || 'development'
        });
      } catch (error) {
        res.status(500).json({
          status: 'error',
          message: error.message,
          configSource: 'Environment Variables (.env)',
          environment: 'Local Development'
        });
      }
    });

    // Protect all static files and routes with authentication
    // In development mode with SKIP_AUTH=true, bypass authentication
    if (process.env.SKIP_AUTH !== 'true') {
      app.use(requireSandsMediaAuth);
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
    
    await connectDB();
    
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Visit http://localhost:${PORT} to view the application`);
      console.log(`Configuration source: Environment Variables (.env)`);
      console.log(`Environment: Local Development`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
