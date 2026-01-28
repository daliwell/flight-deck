# Local Docker Deployment Instructions

## Prerequisites
- Docker Desktop must be running
- Navigate to the project directory: /Users/david-work/Developer/flight-deck

## Option 1: Using Docker Compose (Recommended)
```bash
# Build and run the container in detached mode
docker-compose up --build -d

# Check the container status
docker-compose ps

# View logs
docker-compose logs -f flight-deck

# Stop the container
docker-compose down
```

## Option 2: Using Docker directly
```bash
# Build the image
docker build -t flight-deck .

# Run the container with environment file
docker run -d \
  --name flight-deck \
  -p 3001:3001 \
  --env-file .env \
  flight-deck

# Check container status
docker ps

# View logs
docker logs -f flight-deck

# Stop and remove container
docker stop flight-deck
docker rm flight-deck
```

## Accessing the Application
Once running, the application will be available at:
- http://localhost:3001
- Health check: http://localhost:3001/health

## Environment Configuration
The container uses the same .env file as local development, with:
- MongoDB Atlas connection
- Azure OpenAI configuration
- Google OAuth with localhost callback URL

## Health Monitoring
The container includes health checks that run every 30 seconds using the healthcheck.js file.