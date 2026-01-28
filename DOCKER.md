# Flight Deck - Docker Deployment

## Overview

This document describes how to run the Flight Deck application using Docker.

## Prerequisites

- Docker and Docker Compose installed
- `.env` file with required environment variables

## Quick Start

### 1. Build and Start the Container

```bash
# Build the Docker image
docker-compose build

# Start the application in detached mode
docker-compose up -d
```

### 2. Access the Application

- **Main Application**: http://localhost:3001
- **Health Check**: http://localhost:3001/health

### 3. Check Container Status

```bash
# View running containers
docker-compose ps

# View logs
docker-compose logs -f

# View health status
docker-compose logs | grep health
```

### 4. Stop the Application

```bash
# Stop and remove containers
docker-compose down
```

## Container Details

- **Base Image**: `node:18-alpine`
- **Port**: 3001
- **Health Check**: Built-in health monitoring
- **Security**: Runs as non-root user (`nodeuser`)
- **Environment**: Production mode with local development configuration

## Environment Variables

The container uses the same `.env` file as the local development setup:

- `MONGODB_URI` - MongoDB connection string
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `GOOGLE_CALLBACK_URL` - OAuth callback URL
- `SESSION_SECRET` - Session encryption secret
- `AZURE_OPENAI_*` - Azure OpenAI configuration

## Monitoring

The container includes health checks that monitor:
- Application startup
- Health endpoint response
- Container resource usage

Health check runs every 30 seconds and reports status in `docker-compose ps`.