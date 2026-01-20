#!/bin/bash

# Exit on any error
set -e

echo "🚀 Deploying to production (fast clean build)..."

# Check if Docker Desktop is running
if ! docker info >/dev/null 2>&1; then
    echo "❌ ERROR: Docker Desktop is not running!"
    echo "Please start Docker Desktop and try again."
    exit 1
fi
echo "✅ Docker Desktop is running"

# Generate unique timestamp for this deployment
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
COMMIT_HASH=$(git rev-parse --short HEAD)
UNIQUE_TAG="${TIMESTAMP}-${COMMIT_HASH}"

echo "📋 Deployment Info:"
echo "   Timestamp: ${TIMESTAMP}"
echo "   Commit: ${COMMIT_HASH}"
echo "   Unique Tag: ${UNIQUE_TAG}"

echo "🧹 Performing lighter Docker cleanup (no volumes)..."
docker system prune -f
docker builder prune -f

echo "🔨 Building Docker image for AMD64 (clean build)..."
docker build --no-cache --pull --platform linux/amd64 -t semantic-chunker .

echo "🔐 Logging into AWS ECR..."
aws ecr get-login-password --region eu-west-1 | docker login --username AWS --password-stdin 151853531988.dkr.ecr.eu-west-1.amazonaws.com

echo "🏷️  Tagging images..."
docker tag semantic-chunker:latest 151853531988.dkr.ecr.eu-west-1.amazonaws.com/semantic-chunker:${UNIQUE_TAG}
docker tag semantic-chunker:latest 151853531988.dkr.ecr.eu-west-1.amazonaws.com/semantic-chunker:latest

echo "📤 Pushing to ECR..."
docker push 151853531988.dkr.ecr.eu-west-1.amazonaws.com/semantic-chunker:${UNIQUE_TAG}
docker push 151853531988.dkr.ecr.eu-west-1.amazonaws.com/semantic-chunker:latest

echo "🔄 Forcing ECS service update with new deployment..."
aws ecs update-service \
    --cluster semantic-chunker-cluster \
    --service semantic-chunker-fargate-service \
    --force-new-deployment \
    --no-paginate \
    --output table \
    --query 'service.{ServiceName:serviceName,Status:status,RunningCount:runningCount,PendingCount:pendingCount,DesiredCount:desiredCount}'

echo ""
echo "✅ Production deployment initiated!"
echo "🌐 Application will be available at: https://chunker.sandsmedia.com"
echo "📦 Deployed version: ${UNIQUE_TAG}"
echo "⏳ Deployment may take a few minutes to complete..."
echo ""
echo "🔍 To monitor deployment progress:"
echo "   aws ecs describe-services --cluster semantic-chunker-cluster --services semantic-chunker-fargate-service --query 'services[0].deployments[0].rolloutState' --output text --no-paginate"
echo ""
echo "🏥 To check application health:"
echo "   curl https://chunker.sandsmedia.com/health"
