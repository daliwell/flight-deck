# Flight Deck - Conference Badge Printing Application

A secure Node.js application for on-site conference badge printing and attendee management. Built for printing badges via Brother QL-820NWBc label printer with Google OAuth authentication restricted to sandsmedia.com domain.

## Features

- **Security**: Google OAuth authentication with domain restriction (sandsmedia.com only)
- **Event Management**: Query and select conferences from Concord GraphQL API
- **Attendee Management**: Download and manage attendee data from CAN GraphQL API
- **Badge Printing**: Integration with Brother QL-820NWBc label printer
- **Offline Capability**: Local data persistence using IndexedDB for offline operation
- **Environment Switching**: Support for both staging and production API environments via API_ENV
- **Dual API Integration**: 
  - **Concord API**: Event/course data (RHEINGOLD conferences)
  - **CAN API**: Attendee data (privateAttendees query)

## Architecture

- **Backend**: Node.js + Express with GraphQL clients for Concord and CAN APIs
- **Frontend**: Vanilla JavaScript with IndexedDB for local persistence
- **Authentication**: Passport.js with Google OAuth 2.0 strategy
- **Printer**: Brother QL-820NWBc label printer (CUPS driver integration)
- **Deployment**: Docker with AWS ECS Fargate

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
# Server Configuration
NODE_ENV=development
PORT=3005
API_ENV=staging  # or production

# Authentication
SKIP_AUTH=false  # Set to true for local dev only
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3005/auth/google/callback
SESSION_SECRET=your_secure_random_session_secret

# Concord API
CONCORD_STAGE_URL=https://concord-stage.sandsmedia.com/graphql
CONCORD_PROD_URL=https://concord.sandsmedia.com/graphql
CONCORD_STAGE_TOKEN=your_concord_staging_token
CONCORD_PROD_TOKEN=your_concord_production_token

# CAN API
CAN_STAGE_URL=https://can-stage.sandsmedia.com/graphql
CAN_PROD_URL=https://can.sandsmedia.com/graphql
CAN_STAGE_TOKEN=your_can_staging_token
CAN_PROD_TOKEN=your_can_production_token

# Management
MANAGEMENT_TOKEN=your_management_token
```

3. **Set up Google OAuth:**
   
   - Create a project in [Google Cloud Console](https://console.cloud.google.com/)
   - Enable Google+ API
   - Create OAuth 2.0 credentials
   - Add `http://localhost:3005/auth/google/callback` as redirect URI (local)
   - Add `https://flightdeck.sandsmedia.com/auth/google/callback` as redirect URI (production)
   - Copy Client ID and Client Secret to your `.env` file

4. **Run the application:**

   **Local deployment with Docker:**
```bash
./scripts/deploy-local.sh
```

   **Development mode (without Docker):**
```bash
npm run dev
```

5. **Access the application:**
   
   Open your browser to `http://localhost:3005`
   - With SKIP_AUTH=true: Direct access (local dev only)
   - With SKIP_AUTH=false: Google OAuth login required
   - Only sandsmedia.com domain accounts are allowed access

## Authentication

The application uses Google OAuth with domain restriction:
- Only users with `@sandsmedia.com` email addresses can access the application
- Users are redirected to Google login if not authenticated
- Sessions are stored in memory (file store or Redis recommended for production)
- Authentication can be bypassed locally with SKIP_AUTH=true

**Security Note**: Production deployments do NOT include SKIP_AUTH, ensuring authentication is always required.

## API Endpoints

### Authentication Routes
- `GET /auth/login` - Login page
- `GET /auth/google` - Initiate Google OAuth
- `GET /auth/google/callback` - OAuth callback
- `GET /auth/logout` - Logout user
- `GET /auth/user` - Get current user info

### Protected API Routes (require authentication unless SKIP_AUTH=true)

**Courses (from Concord API)**
- `GET /api/courses` - Fetch courses/events
  - Query params: `genres`, `startDateFrom`, `page`, `pageSize`
  - Returns courses grouped by location and date

**Attendees (from CAN API)**
- `GET /api/attendees/:courseId` - Fetch attendees for a specific course
- `POST /api/attendees/bulk` - Fetch attendees for multiple courses
  - Body: `{ courseIds: ["id1", "id2", ...] }`
  - Uses `privateAttendees(from: "REDSYS", courseId_in: [...])` query

**CAN API (Generic)**
- `POST /api/can/query` - Execute GraphQL query on CAN API
- `POST /api/can/mutation` - Execute GraphQL mutation on CAN API

**Badge Printing**
- `POST /api/badge/print` - Mark badge as printed (placeholder)

### Public Routes
- `GET /health` - Health check endpoint (shows API configuration)

## Project Structure

```
flight-deck/
├── server.js                 # Main server file with authentication
├── package.json              # Dependencies and scripts
├── .env                      # Environment variables (create from .env.example)
├── .env.example              # Environment template
├── Dockerfile                # Docker configuration with Brother printer driver
├── docker-compose.yml        # Local Docker deployment
├── task-definition-fargate.json  # AWS ECS task definition
├── public/                   # Frontend files (protected by auth)
│   ├── index.html           # Main HTML page
│   ├── styles.css           # Responsive CSS styling
│   ├── script.js            # Frontend application logic
│   └── services/
│       └── db.js            # IndexedDB wrapper for offline storage
├── scripts/
│   ├── deploy-local.sh      # Local Docker deployment script
│   ├── deploy-production.sh # AWS production deployment script
│   └── deploy-production-fast.sh # Fast production deployment
├── src/
│   ├── config/
│   │   └── passport.js      # Passport.js Google OAuth configuration
│   ├── middleware/
│   │   └── auth.js          # Authentication middleware
│   ├── routes/
│   │   ├── api.js           # Protected API routes
│   │   ├── auth.js          # Authentication routes
│   │   └── management.js    # Management routes
│   └── services/
│       ├── concordApi.js    # Concord GraphQL API client
│       └── canApi.js        # CAN GraphQL API client
├── drivers/
│   └── ql820nwbpdrv-3.1.5-0.i386.deb  # Brother printer driver
└── tests/                   # Test suite (needs updating for Flight Deck)
```

## Usage

### Local Development

1. **Start the application:**
```bash
./scripts/deploy-local.sh
```

2. **Access at:** http://localhost:3005

3. **Select an event:**
   - Events are grouped by city and week
   - Click "Select Event" to view attendees

4. **Sync attendees:**
   - Click "Sync Attendees" to download from CAN API
   - Data is stored locally in IndexedDB
   - Works offline after initial sync

5. **Search attendees:**
   - Use the search box to filter by name, email, or badge number
   - Results update in real-time

6. **Print badges:**
   - Click the Print button next to an attendee
   - Badge printing integration is placeholder (needs Brother printer API)

### Production Deployment

See [DOCKER.md](DOCKER.md) for detailed deployment instructions.

**Quick deployment:**
```bash
./scripts/deploy-production.sh
```

**Prerequisites:**
- AWS CLI configured
- ECR repository created
- ECS cluster and service set up
- SSM parameters configured at `/flight-deck/prod/*`

## Environment Variables

The application uses `API_ENV` to switch between staging and production:
- `API_ENV=staging` - Uses staging URLs and tokens
- `API_ENV=production` - Uses production URLs and tokens

**Local Development:** Use `.env` file with `API_ENV=staging`
**Production:** AWS SSM Parameter Store with `API_ENV=production`

## Data Flow

1. **Events**: Fetched from Concord API (courses with RHEINGOLD genre)
2. **Grouping**: Courses grouped by city + week into events
3. **Attendees**: Fetched from CAN API (privateAttendees query with courseId_in)
4. **Storage**: Events and attendees cached in IndexedDB
5. **Display**: Real-time search and filtering in browser

## GraphQL Queries

**Concord - Get Courses:**
```graphql
query GetCourses($genres: [COURSE_GENRE!], $startDateFrom: String) {
  courses(genre_in: $genres, localizedStartDate_gte: $startDateFrom) {
    Courses {
      _id
      genre
      shortName
      name
      localizedStartDate
      localizedEndDate
      location { city }
      # ... more fields
    }
  }
}
```

**CAN - Get Attendees:**
```graphql
query GetAttendees($courseIds: [String!]!) {
  privateAttendees(from: "REDSYS", courseId_in: $courseIds) {
    Attendees {
      _id
      firstName
      lastName
      swapCardEmail
      badgeNumber
      checkInState
      # ... more fields
    }
  }
}
```

## Technologies

- **Backend**: Node.js 18, Express 4
- **Frontend**: Vanilla JavaScript, IndexedDB (idb library)
- **Authentication**: Passport.js with Google OAuth 2.0
- **APIs**: GraphQL (graphql-request)
- **Deployment**: Docker, AWS ECS Fargate
- **Printer**: Brother QL-820NWBc (CUPS driver)

## Development

**Run tests:**
```bash
npm test
```

**Note**: Current test suite is for old Semantic Chunker app and needs to be rewritten for Flight Deck.

**Code quality:**
- Husky pre-commit hooks (currently disabled)
- Jest for testing
- ESLint configuration recommended

## Troubleshooting

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

The application is ready for the next iteration where actions can be performed on selected documents. The selection functionality is already implemented and accessible via the `flightDeckApp.getSelectedPocIds()` and `flightDeckApp.getSelectedPocs()` methods.