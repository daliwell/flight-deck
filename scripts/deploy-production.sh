#!/bin/bash

# Exit on any error
set -e

echo "🚀 Deploying to production..."

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

echo "🧹 Performing complete Docker cleanup..."
# Clean up Docker completely for fresh build
docker system prune -af --volumes
docker builder prune -af
docker image prune -af

echo "🔨 Building Docker image for AMD64 (completely fresh build)..."
# Use --no-cache and --pull to ensure completely fresh build
docker build --no-cache --pull --platform linux/amd64 -t flight-deck .

echo "🔐 Logging into AWS ECR..."
aws ecr get-login-password --region eu-west-1 | docker login --username AWS --password-stdin 151853531988.dkr.ecr.eu-west-1.amazonaws.com

echo "🏷️  Tagging images..."
# Tag with unique identifier to ensure new deployment
docker tag flight-deck:latest 151853531988.dkr.ecr.eu-west-1.amazonaws.com/flight-deck:${UNIQUE_TAG}
docker tag flight-deck:latest 151853531988.dkr.ecr.eu-west-1.amazonaws.com/flight-deck:latest

echo "📤 Pushing to ECR..."
# Push both tags
docker push 151853531988.dkr.ecr.eu-west-1.amazonaws.com/flight-deck:${UNIQUE_TAG}
docker push 151853531988.dkr.ecr.eu-west-1.amazonaws.com/flight-deck:latest

echo "📝 Registering new Fargate task definition with unique image tag..."
# Create a new task definition with the unique tag (without requiring jq)
sed 's|:latest"|:'"${UNIQUE_TAG}"'"|g' task-definition-fargate.json > /tmp/task-def-new.json

# Register the new task definition
NEW_REVISION=$(aws ecs register-task-definition --cli-input-json file:///tmp/task-def-new.json --query 'taskDefinition.revision' --output text --no-paginate)

echo "✅ Registered new task definition revision: ${NEW_REVISION}"

echo "🔄 Updating Fargate service to use new task definition..."
aws ecs update-service \
    --cluster flight-deck-cluster \
    --service flight-deck-fargate-service \
    --task-definition flight-deck-fargate-task:${NEW_REVISION} \
    --force-new-deployment \
    --no-paginate \
    --output table \
    --query 'service.{ServiceName:serviceName,Status:status,RunningCount:runningCount,PendingCount:pendingCount,DesiredCount:desiredCount}'

echo ""
echo "✅ Production deployment initiated!"
echo "🌐 Application will be available at: https://flightdeck.sandsmedia.com"
echo "📦 Deployed version: ${UNIQUE_TAG}"
echo "📋 Task definition revision: ${NEW_REVISION}"
echo "⏳ Monitoring deployment progress..."
echo ""

# Monitor deployment until healthy
MAX_WAIT=1200  # 20 minutes
INTERVAL=10
ELAPSED=0
LAST_STATE=""

while [ $ELAPSED -lt $MAX_WAIT ]; do
    # Get ALL tasks to find the one with our new revision
    ALL_TASKS=$(aws ecs list-tasks \
        --cluster flight-deck-cluster \
        --service-name flight-deck-fargate-service \
        --region eu-west-1 \
        --query 'taskArns' \
        --output text \
        --no-paginate 2>/dev/null)
    
    if [ -n "$ALL_TASKS" ]; then
        # Check each task to find the new revision
        NEW_REV_FOUND=false
        for TASK_ARN in $ALL_TASKS; do
            TASK_INFO=$(aws ecs describe-tasks \
                --cluster flight-deck-cluster \
                --tasks "$TASK_ARN" \
                --region eu-west-1 \
                --query 'tasks[0].{status:lastStatus,health:healthStatus,revision:taskDefinitionArn}' \
                --output json \
                --no-paginate 2>/dev/null)
            
            TASK_STATUS=$(echo "$TASK_INFO" | grep -o '"status": *"[^"]*"' | cut -d'"' -f4)
            HEALTH_STATUS=$(echo "$TASK_INFO" | grep -o '"health": *"[^"]*"' | cut -d'"' -f4)
            TASK_REV=$(echo "$TASK_INFO" | grep -o 'flight-deck-fargate-task:[0-9]*' | cut -d: -f2)
            
            # Check if this is our new revision
            if [ "$TASK_REV" = "$NEW_REVISION" ]; then
                NEW_REV_FOUND=true
                CURRENT_STATE="$TASK_STATUS|$HEALTH_STATUS|$TASK_REV"
                
                # Only print if state changed
                if [ "$CURRENT_STATE" != "$LAST_STATE" ]; then
                    echo "   Status: $TASK_STATUS | Health: $HEALTH_STATUS | Revision: $TASK_REV"
                    LAST_STATE="$CURRENT_STATE"
                fi
                
                # Check if deployment is complete
                if [ "$TASK_STATUS" = "RUNNING" ] && [ "$HEALTH_STATUS" = "HEALTHY" ]; then
                    echo ""
                    echo "✅ Deployment is LIVE and HEALTHY!"
                    echo "🌐 https://flightdeck.sandsmedia.com"
                    
                    # macOS notification
                    if command -v osascript &> /dev/null; then
                        osascript -e "display notification \"Flight Deck is live and healthy at flightdeck.sandsmedia.com\" with title \"Deployment Complete ✅\" sound name \"Glass\""
                        say "Flight Deck deployment is complete and healthy"
                    fi
                    
                    exit 0
                fi
                break
            fi
        done
        
        # Only print waiting message if we haven't found the new revision yet and state changed
        if [ "$NEW_REV_FOUND" = false ] && [ "$LAST_STATE" != "WAITING" ]; then
            echo "   Waiting for new revision $NEW_REVISION to start..."
            LAST_STATE="WAITING"
        fi
    fi
    
    sleep $INTERVAL
    ELAPSED=$((ELAPSED + INTERVAL))
done

echo ""
echo "⚠️  Deployment monitoring timed out after $((MAX_WAIT / 60)) minutes"
echo "   The deployment may still be in progress. Check status manually:"
echo "   aws ecs describe-services --cluster flight-deck-cluster --services flight-deck-fargate-service --region eu-west-1"
exit 1

echo ""

echo ""
echo "🧹 Cleaning up old task definitions..."
# Get all task definition revisions
ALL_REVISIONS=$(aws ecs list-task-definitions --family-prefix flight-deck-fargate-task --query 'taskDefinitionArns' --output text --no-paginate | tr '\t' '\n')

# Count total revisions
TOTAL_REVISIONS=$(echo "$ALL_REVISIONS" | wc -l | tr -d ' ')

if [ "$TOTAL_REVISIONS" -gt 5 ]; then
    # Keep only the 5 most recent revisions, deregister the rest
    # Use tail to skip last 5, compatible with both Linux and macOS
    KEEP_COUNT=5
    DELETE_COUNT=$((TOTAL_REVISIONS - KEEP_COUNT))
    REVISIONS_TO_DELETE=$(echo "$ALL_REVISIONS" | head -n $DELETE_COUNT)
    
    DELETED_COUNT=0
    for REVISION_ARN in $REVISIONS_TO_DELETE; do
        echo "   Deregistering: $REVISION_ARN"
        aws ecs deregister-task-definition --task-definition "$REVISION_ARN" --no-paginate > /dev/null
        DELETED_COUNT=$((DELETED_COUNT + 1))
    done
    
    echo "✅ Cleaned up $DELETED_COUNT old task definition(s), kept 5 most recent"
else
    echo "✅ Only $TOTAL_REVISIONS task definition(s) exist, no cleanup needed (keeping all)"
fi
