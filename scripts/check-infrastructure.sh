#!/bin/bash

# Flight Deck - Infrastructure Status Check (Fargate)
# Shows current status of all AWS resources

set -e

REGION="eu-west-1"

echo ""
echo "📋 Flight Deck Infrastructure Status"
echo "========================================"
echo ""

# Check ALB
echo "🌐 Application Load Balancer:"
ALB_DNS=$(aws elbv2 describe-load-balancers --names flight-deck-alb --query 'LoadBalancers[0].DNSName' --output text --region $REGION 2>/dev/null || echo "Not found")
echo "   DNS: $ALB_DNS"

# Check Target Group
echo ""
echo "🎯 Target Group (Fargate - IP type):"
TG_INFO=$(aws elbv2 describe-target-groups --names flight-deck-tg-fargate --region $REGION 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "   Name: flight-deck-tg-fargate"
    echo "   Type: IP (for Fargate)"
    echo "   Health Check: /health"
else
    echo "   Not found"
fi

# Check Listeners
echo ""
echo "🔀 ALB Listeners:"
aws elbv2 describe-listeners \
    --load-balancer-arn $(aws elbv2 describe-load-balancers --names flight-deck-alb --query 'LoadBalancers[0].LoadBalancerArn' --output text --region $REGION 2>/dev/null) \
    --region $REGION \
    --query 'Listeners[*].{Port:Port,Protocol:Protocol}' \
    --output table 2>/dev/null || echo "   Not found"

# Check SSL Certificate
echo ""
echo "🔐 SSL Certificate:"
CERT_STATUS=$(aws acm describe-certificate \
    --certificate-arn arn:aws:acm:eu-west-1:151853531988:certificate/81f24b1c-1c52-4fe4-9ded-3be455cd5617 \
    --query 'Certificate.{Domain:DomainName,Status:Status}' \
    --output text \
    --region $REGION 2>/dev/null || echo "Not found")
echo "   $CERT_STATUS"

# Check Route53
echo ""
echo "🌍 Route53:"
echo "   Domain: flightdeck.sandsmedia.com"
echo "   Hosted Zone ID: Z04984802PNRL6HRRYI60"

# Check Fargate Service
echo ""
echo "🚀 Fargate Service:"
SERVICE_INFO=$(aws ecs describe-services \
    --cluster flight-deck-cluster \
    --services flight-deck-fargate-service \
    --query 'services[0].{Status:status,Running:runningCount,Desired:desiredCount,TaskDef:taskDefinition}' \
    --output text \
    --region $REGION 2>/dev/null)

if [ $? -eq 0 ]; then
    echo "   $SERVICE_INFO"
else
    echo "   Not found"
fi

# Check ECR
echo ""
echo "📦 ECR Repository:"
IMAGE_COUNT=$(aws ecr describe-images \
    --repository-name flight-deck \
    --query 'length(imageDetails)' \
    --output text \
    --region $REGION 2>/dev/null || echo "0")
echo "   Images: $IMAGE_COUNT"

# Test health endpoint
echo ""
echo "🏥 Health Check:"
HEALTH=$(curl -s --max-time 5 https://flightdeck.sandsmedia.com/health 2>/dev/null | jq -r '.status' 2>/dev/null || echo "unavailable")
echo "   Status: $HEALTH"

echo ""
echo "========================================"
echo "✅ Infrastructure Status Check Complete"
echo "🌐 Application: https://flightdeck.sandsmedia.com"
echo "========================================"
echo ""
