#!/bin/bash

echo "🚀 Deploying to localhost..."

# Check if Docker Desktop is running
if ! docker info >/dev/null 2>&1; then
    echo "❌ ERROR: Docker Desktop is not running!"
    echo "Please start Docker Desktop and try again."
    exit 1
fi
echo "✅ Docker Desktop is running"
echo "📦 Stopping containers..."
docker-compose down

echo "🧹 Cleaning up old images..."
docker-compose rm -f

echo "🔨 Building containers (no cache)..."
docker-compose build --no-cache

echo "▶️  Starting containers..."
docker-compose up -d

echo "✅ Local deployment complete!"
echo "🌐 Application available at: http://localhost:3005"