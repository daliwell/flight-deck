#!/bin/bash

# Flight Deck - AWS Production Infrastructure Setup (Fargate)
# This script sets up all AWS resources needed for production deployment on AWS Fargate

set -e

REGION="eu-west-1"
CLUSTER_NAME="flight-deck-cluster"
SERVICE_NAME="flight-deck-fargate-service"
TASK_FAMILY="flight-deck-fargate-task"
ECR_REPO="flight-deck"
ACCOUNT_ID="151853531988"

echo "🚀 Setting up AWS infrastructure for Flight Deck (Fargate)..."
echo "Region: $REGION"
echo "Account: $ACCOUNT_ID"
echo ""

# Step 1: Create ECR Repository
echo "📦 Step 1: Creating ECR repository..."
if aws ecr describe-repositories --repository-names $ECR_REPO --region $REGION >/dev/null 2>&1; then
    echo "✅ ECR repository '$ECR_REPO' already exists"
else
    aws ecr create-repository \
        --repository-name $ECR_REPO \
        --region $REGION \
        --image-scanning-configuration scanOnPush=true \
        --encryption-configuration encryptionType=AES256
    echo "✅ ECR repository created: $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$ECR_REPO"
fi

# Step 2: Create ECS Cluster
echo ""
echo "🏗️  Step 2: Creating ECS cluster..."
if aws ecs describe-clusters --clusters $CLUSTER_NAME --region $REGION --query 'clusters[0].status' --output text 2>/dev/null | grep -q "ACTIVE"; then
    echo "✅ ECS cluster '$CLUSTER_NAME' already exists"
else
    aws ecs create-cluster \
        --cluster-name $CLUSTER_NAME \
        --region $REGION
    echo "✅ ECS cluster created: $CLUSTER_NAME"
fi

# Step 3: Create CloudWatch Log Group
echo ""
echo "📊 Step 3: Creating CloudWatch log group..."
if aws logs describe-log-groups --log-group-name-prefix "/ecs/flight-deck" --region $REGION --query 'logGroups[0].logGroupName' --output text 2>/dev/null | grep -q "/ecs/flight-deck"; then
    echo "✅ Log group '/ecs/flight-deck' already exists"
else
    aws logs create-log-group \
        --log-group-name "/ecs/flight-deck" \
        --region $REGION
    aws logs put-retention-policy \
        --log-group-name "/ecs/flight-deck" \
        --retention-in-days 30 \
        --region $REGION
    echo "✅ Log group created with 30-day retention"
fi

# Step 4: Create SSM Parameters
echo ""
echo "🔐 Step 4: Creating SSM parameters..."
echo "Loading values from .env file..."
echo ""

# Read from .env file if it exists
if [ -f ".env" ]; then
    source .env
else
    echo "⚠️  .env file not found. You'll need to set parameters manually."
fi

# Function to create or update SSM parameter
create_param() {
    local param_name=$1
    local param_value=$2
    local param_type=${3:-String}
    
    if [ -z "$param_value" ]; then
        echo "⚠️  Skipping $param_name (no value provided)"
        return
    fi
    
    if aws ssm get-parameter --name "$param_name" --region $REGION >/dev/null 2>&1; then
        aws ssm put-parameter \
            --name "$param_name" \
            --value "$param_value" \
            --type "$param_type" \
            --overwrite \
            --region $REGION >/dev/null
        echo "✅ Updated: $param_name"
    else
        aws ssm put-parameter \
            --name "$param_name" \
            --value "$param_value" \
            --type "$param_type" \
            --region $REGION >/dev/null
        echo "✅ Created: $param_name"
    fi
}

# Create all required parameters
create_param "/flight-deck/prod/PORT" "3005"
create_param "/flight-deck/prod/NODE_ENV" "production"
create_param "/flight-deck/prod/API_ENV" "production"
create_param "/flight-deck/prod/GOOGLE_CLIENT_ID" "$GOOGLE_CLIENT_ID"
create_param "/flight-deck/prod/GOOGLE_CLIENT_SECRET" "$GOOGLE_CLIENT_SECRET" "SecureString"
create_param "/flight-deck/prod/GOOGLE_CALLBACK_URL" "https://flightdeck.sandsmedia.com/auth/google/callback"
create_param "/flight-deck/prod/SESSION_SECRET" "${SESSION_SECRET:-$(openssl rand -base64 32)}" "SecureString"
create_param "/flight-deck/prod/CONCORD_STAGE_TOKEN" "$CONCORD_STAGE_TOKEN" "SecureString"
create_param "/flight-deck/prod/CONCORD_PROD_TOKEN" "$CONCORD_PROD_TOKEN" "SecureString"
create_param "/flight-deck/prod/CAN_STAGE_TOKEN" "$CAN_STAGE_TOKEN" "SecureString"
create_param "/flight-deck/prod/CAN_PROD_TOKEN" "$CAN_PROD_TOKEN" "SecureString"
create_param "/flight-deck/prod/MANAGEMENT_TOKEN" "${MANAGEMENT_TOKEN:-flight-deck-mgmt-$(date +%s)}" "SecureString"

echo ""
echo "✅ SSM parameters configured"

# Step 5: Verify ecsTaskExecutionRole exists
echo ""
echo "🔑 Step 5: Verifying IAM role..."
if aws iam get-role --role-name ecsTaskExecutionRole >/dev/null 2>&1; then
    echo "✅ ecsTaskExecutionRole exists"
else
    echo "Creating ecsTaskExecutionRole..."
    aws iam create-role \
        --role-name ecsTaskExecutionRole \
        --assume-role-policy-document '{
          "Version": "2012-10-17",
          "Statement": [{
            "Effect": "Allow",
            "Principal": {"Service": "ecs-tasks.amazonaws.com"},
            "Action": "sts:AssumeRole"
          }]
        }'
    
    aws iam attach-role-policy \
        --role-name ecsTaskExecutionRole \
        --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
    
    aws iam attach-role-policy \
        --role-name ecsTaskExecutionRole \
        --policy-arn arn:aws:iam::aws:policy/AmazonSSMReadOnlyAccess
    
    echo "✅ ecsTaskExecutionRole created with required policies"
fi

echo ""
echo "======================================"
echo "✅ AWS Infrastructure Setup Complete!"
echo "======================================"
echo ""
echo "Infrastructure deployed:"
echo "- ECR Repository: $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$ECR_REPO"
echo "- ECS Cluster: $CLUSTER_NAME (Fargate)"
echo "- CloudWatch Logs: /ecs/flight-deck"
echo "- SSM Parameters: /flight-deck/prod/*"
echo ""
echo "Next steps:"
echo "1. Set up Application Load Balancer (ALB) if not already configured:"
echo "   ./scripts/setup-alb.sh"
echo "2. Create Route53 hosted zone and configure DNS for flightdeck.sandsmedia.com"
echo "3. Request SSL certificate via ACM for flightdeck.sandsmedia.com"
echo "4. Create Fargate service and task definition:"
echo "   - Task definition: task-definition-fargate.json"
echo "   - Register: aws ecs register-task-definition --cli-input-json file://task-definition-fargate.json --region $REGION"
echo "   - Create service with ALB integration"
echo "5. Deploy application: ./scripts/deploy-production.sh"
echo ""
