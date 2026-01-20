# Conference Flight Deck App

A secure Node.js application for on-site management of conference attendees. Features Google OAuth authentication restricted to sandsmedia.com domain.

## Features

- **Security**: Google OAuth authentication with domain restriction (sandsmedia.com only)
- **Database Integration**: Connects to MongoDB Atlas database 'can' with collections:
  - `chunkAuditPocs` (primary UI focus)
  - `pieceOfContents`
  - `pocEmbeddings` (associated with default chunker `DEFAULT-1024T`)
  - `chunkAuditChunks`

- **User Interface**: Clean, responsive web interface displaying:
  - 

- **Search & Filter**: Real-time search across all displayed fields
  - 

## Setup

1. **Install dependencies:**
```bash
npm install
```

2. **Configure environment variables:**
   
   Copy `.env.example` to `.env` and fill in your credentials:
```bash
cp .env.example .env
```

   Required variables:
```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
SESSION_SECRET=your_secure_random_session_secret
PORT=3005
```

3. **Set up Google OAuth:**
   
   - Create a project in [Google Cloud Console](https://console.cloud.google.com/)
   - Enable Google+ API
   - Create OAuth 2.0 credentials
   - Add `http://localhost:3000/auth/google/callback` as redirect URI
   - Copy Client ID and Client Secret to your `.env` file
AZURE_OPENAI_API_KEY=your_api_key_here
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4
PORT=3000
```

4. **Run the application:**
```bash
npm start
```

   For development with auto-reload:
```bash
npm run dev
```

5. **Access the application:**
   
   Open your browser to `http://localhost:3000`
   - You'll be redirected to Google OAuth login
   - Only sandsmedia.com domain accounts are allowed access

## Authentication

The application uses Google OAuth with domain restriction:
- Only users with `@sandsmedia.com` email addresses can access the application
- Users are redirected to a login page if not authenticated
- Sessions are stored in MongoDB for persistence
- Automatic logout after 24 hours of inactivity

## API Endpoints

### Authentication Routes
- `GET /auth/login` - Login page
- `GET /auth/google` - Initiate Google OAuth
- `GET /auth/google/callback` - OAuth callback
- `GET /auth/logout` - Logout user
- `GET /auth/user` - Get current user info

### Protected API Routes (require authentication)
- `GET /api/pocs` - Fetch POCs with optional search and pagination
- `GET /api/pocs/ids` - Get all POC IDs matching search criteria (for global selection)
- `GET /api/pocs/:id` - Get single POC by ID
- `POST /api/pocs/bulk` - Get multiple POCs by IDs
- `GET /api/chunkers` - Get all available chunker types and information
- `GET /api/chunkers/stats` - Get chunker usage statistics
- `GET /api/embeddings/:chunkerType` - Get embeddings by chunker type

### Public Routes
- `GET /health` - Health check endpoint

## Project Structure

```
semantic-chunker/
├── server.js                 # Main server file with authentication
├── package.json              # Dependencies and scripts
├── .env                      # Environment variables (create from .env.example)
├── Dockerfile                # Docker configuration for AWS deployment
├── DEPLOYMENT.md             # AWS deployment guide
├── public/                   # Frontend files (protected by auth)
│   ├── index.html           # Main HTML page
│   ├── styles.css           # Styling
│   └── script.js            # Frontend JavaScript
└── src/
    ├── config/
    │   ├── database.js      # MongoDB connection
    │   └── passport.js      # Passport.js configuration
    ├── constants/
    │   └── chunkers.js      # Chunker enum and utilities
    ├── middleware/
    │   └── auth.js          # Authentication middleware
    ├── models/              # Mongoose schemas
    │   ├── ChunkAuditPoc.js
    │   ├── PieceOfContent.js
    │   ├── PocEmbedding.js
    │   ├── ChunkAuditChunk.js
    │   └── index.js
    ├── routes/
    │   ├── api.js           # Protected API routes
    │   └── auth.js          # Authentication routes
    └── services/
        ├── azureOpenAI.js   # Azure OpenAI integration
        └── chunkerService.js # Chunker-related operations
```

## Usage

1. **Login**: Access the application with your sandsmedia.com Google account
2. **Search**: Use the search field to filter documents across all visible fields
3. **Select Documents**: Click on documents or use checkboxes to select/deselect
4. **Bulk Actions**: Use "Select All" or "Deselect All" for bulk operations
5. **Navigate**: Use pagination controls to browse through large datasets

## AWS Deployment

For production deployment on AWS with proper security, see the comprehensive [DEPLOYMENT.md](./DEPLOYMENT.md) guide which covers:

- AWS App Runner deployment (recommended)
- ECS with Fargate deployment
- Environment variable security with AWS Secrets Manager
- Custom domain configuration
- SSL/HTTPS setup
- Monitoring and logging

## Security Features

- **Domain Restriction**: Only sandsmedia.com accounts allowed
- **Session Management**: Secure session storage in MongoDB
- **HTTPS Ready**: SSL/TLS configuration for production
- **Environment Security**: Sensitive data in environment variables
- **Input Validation**: Protected against common attacks

## Future Enhancements

The application is ready for the next iteration where actions can be performed on selected documents. The selection functionality is already implemented and accessible via the `semanticChunkerApp.getSelectedPocIds()` and `semanticChunkerApp.getSelectedPocs()` methods.