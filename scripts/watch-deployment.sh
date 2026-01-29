#!/bin/bash

# Watch deployment and notify when healthy
# Usage: bash scripts/watch-deployment.sh

REGION="eu-west-1"
CLUSTER="flight-deck-cluster"
SERVICE="flight-deck-fargate-service"

echo "🔍 Monitoring deployment status..."
echo "   Cluster: $CLUSTER"
echo "   Service: $SERVICE"
echo ""

while true; do
    # Get task info
    TASK_ARN=$(aws ecs list-tasks \
        --cluster "$CLUSTER" \
        --service-name "$SERVICE" \
        --desired-status RUNNING \
        --region "$REGION" \
        --query 'taskArns[0]' \
        --output text)
    
    if [ "$TASK_ARN" != "None" ] && [ -n "$TASK_ARN" ]; then
        TASK_INFO=$(aws ecs describe-tasks \
            --cluster "$CLUSTER" \
            --tasks "$TASK_ARN" \
            --region "$REGION" \
            --query 'tasks[0].{lastStatus:lastStatus,healthStatus:healthStatus}' \
            --output json)
        
        STATUS=$(echo "$TASK_INFO" | jq -r '.lastStatus')
        HEALTH=$(echo "$TASK_INFO" | jq -r '.healthStatus')
        
        echo -ne "\r⏳ Status: $STATUS | Health: $HEALTH        "
        
        if [ "$STATUS" = "RUNNING" ] && [ "$HEALTH" = "HEALTHY" ]; then
            echo ""
            echo ""
            echo "✅ Deployment is LIVE and HEALTHY!"
            echo "🌐 https://flightdeck.sandsmedia.com"
            echo ""
            
            # macOS notification
            osascript -e 'display notification "Flight Deck is live and healthy at flightdeck.sandsmedia.com" with title "Deployment Complete ✅" sound name "Glass"'
            
            # Audio notification
            say "Flight Deck deployment is complete and healthy"
            
            exit 0
        fi
        
        if [ "$STATUS" = "STOPPED" ]; then
            echo ""
            echo ""
            echo "❌ Deployment FAILED - task stopped"
            
            # macOS notification
            osascript -e 'display notification "Flight Deck deployment failed - check logs" with title "Deployment Failed ❌" sound name "Basso"'
            
            exit 1
        fi
    else
        echo -ne "\r⏳ Waiting for task to start...        "
    fi
    
    sleep 10
done
