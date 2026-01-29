# AWS Production Deployment Guide

## Overview

Flight Deck is deployed on AWS using:
- **ECS on EC2** (t3.small instance) for cost optimization (~$180/year vs ~$360-480/year for Fargate)
- **Application Load Balancer** (ALB) for HTTPS and routing
- **ECR** (Elastic Container Registry) for Docker images
- **SSM Parameter Store** for secrets management
- **CloudWatch** for logging

**Domain:** https://flightdeck.sandsmedia.com  
**Region:** eu-west-1  
**Account ID:** 151853531988

## Prerequisites

1. **AWS CLI configured** with credentials for account 151853531988
2. **Docker Desktop running** (required for building AMD64 images)
3. **`.env` file** with all required credentials (see `.env.example`)
4. **Git repository** up to date with latest code

## Deployment Steps

### Step 1: Infrastructure Setup

This creates the ECS cluster, ECR repository, CloudWatch logs, and SSM parameters.

```bash
# Make script executable
chmod +x scripts/setup-aws-production.sh

# Run infrastructure setup
./scripts/setup-aws-production.sh
```

**What it does:**
- Creates ECR repository: `151853531988.dkr.ecr.eu-west-1.amazonaws.com/flight-deck`
- Deploys CloudFormation stack with t3.small EC2 instance
- Creates ECS cluster: `flight-deck-cluster`
- Sets up CloudWatch log group: `/ecs/flight-deck`
- Creates SSM parameters from `.env` file at `/flight-deck/prod/*`
- Verifies IAM roles (ecsTaskExecutionRole)

**Time:** ~5 minutes (includes CloudFormation stack creation and EC2 instance launch)

### Step 2: ALB and Networking Setup

This creates the Application Load Balancer, target groups, and ECS service.

**Before running:**
- Verify you have at least 2 subnets in different availability zones
- Update `SUBNET_2` in `scripts/setup-alb.sh` if needed

```bash
# Make script executable
chmod +x scripts/setup-alb.sh

# Run ALB setup
./scripts/setup-alb.sh
```

**What it does:**
- Creates security groups for ALB and updates ECS security group
- Creates target group for port 3005
- Creates Application Load Balancer
- Requests/checks SSL certificate for flightdeck.sandsmedia.com
- Creates HTTP→HTTPS redirect listener
- Creates HTTPS listener with SSL certificate
- Creates ECS service with 1 task

**Important:** If SSL certificate doesn't exist, you'll need to:
1. Request certificate: `aws acm request-certificate --domain-name flightdeck.sandsmedia.com --validation-method DNS --region eu-west-1`
2. Add DNS validation CNAME records
3. Wait for certificate validation
4. Run `./scripts/setup-alb.sh` again

**Time:** ~3 minutes (plus certificate validation if needed)

### Step 3: DNS Configuration

Point your domain to the ALB:

1. Get ALB DNS name (output from setup-alb.sh or run):
   ```bash
   aws elbv2 describe-load-balancers --names flight-deck-alb --query 'LoadBalancers[0].DNSName' --output text --region eu-west-1
   ```

2. Create CNAME record in your DNS provider:
   ```
   flightdeck.sandsmedia.com → <ALB-DNS-NAME>
   ```

**Time:** DNS propagation can take 5-60 minutes

### Step 4: Deploy Application

This builds the Docker image, pushes to ECR, and deploys to ECS.

```bash
# Make script executable
chmod +x scripts/deploy-production.sh

# Deploy application
./scripts/deploy-production.sh
```

**What it does:**
- Cleans Docker build cache for fresh build
- Builds Docker image for linux/amd64 (with Brother printer driver)
- Tags image with unique timestamp and commit hash
- Pushes to ECR (both unique tag and :latest)
- Registers new ECS task definition
- Updates ECS service with force-new-deployment
- Cleans up old task definitions (keeps 5 most recent)

**Time:** ~5-10 minutes (build + push + deployment)

### Step 5: Verify Deployment

```bash
# Check service status
aws ecs describe-services --cluster flight-deck-cluster --services flight-deck-service --query 'services[0].{Status:status,Running:runningCount,Desired:desiredCount}' --output table --region eu-west-1

# Check deployment rollout
aws ecs describe-services --cluster flight-deck-cluster --services flight-deck-service --query 'services[0].deployments[0].rolloutState' --output text --region eu-west-1

# Check task health
aws ecs list-tasks --cluster flight-deck-cluster --service flight-deck-service --region eu-west-1

# Test health endpoint
curl https://flightdeck.sandsmedia.com/health

# Test application
open https://flightdeck.sandsmedia.com
```

## Architecture

### Cost Analysis (24/7 uptime, low traffic)

- **EC2 t3.small:** $0.0208/hour × 8760 hours = ~$182/year
- **ALB:** ~$16/month = ~$192/year  
- **Total:** ~$374/year

Compare to Fargate:
- **Fargate (0.25 vCPU, 0.5GB):** ~$30-40/month = ~$360-480/year (just compute)
- **ALB:** ~$192/year
- **Total:** ~$552-672/year

**Savings: ~$178-298/year with EC2**

### Network Flow

```
User → Route53/DNS
  ↓
Application Load Balancer (ALB)
  ↓ (HTTPS:443 → HTTP:3005)
Target Group
  ↓
EC2 Instance (t3.small)
  ↓
ECS Task (Docker Container)
  ↓
Node.js Application (port 3005)
```

### Security

- **ALB Security Group:** Allows 80/443 from 0.0.0.0/0
- **ECS Security Group:** Allows 3005 from ALB only, 22 for SSH (optional)
- **Google OAuth:** Restricted to @sandsmedia.com domain
- **Secrets:** Stored in SSM Parameter Store (SecureString for sensitive values)
- **SSL:** ACM certificate with automatic renewal

## Updating the Application

To deploy changes:

```bash
# 1. Commit your changes
git add .
git commit -m "Your changes"
git push

# 2. Deploy to production
./scripts/deploy-production.sh
```

The script automatically:
- Builds fresh Docker image
- Tags with timestamp + commit hash
- Pushes to ECR
- Registers new task definition
- Forces service to deploy new tasks
- Waits for old tasks to drain

**Zero-downtime deployment:** ECS will start new tasks before stopping old ones.

## Monitoring

### CloudWatch Logs

```bash
# Tail logs
aws logs tail /ecs/flight-deck --follow --region eu-west-1

# View specific task logs
aws logs get-log-events \
  --log-group-name /ecs/flight-deck \
  --log-stream-name ecs/flight-deck/<task-id> \
  --region eu-west-1
```

### ECS Console

- Cluster: https://eu-west-1.console.aws.amazon.com/ecs/v2/clusters/flight-deck-cluster
- Service: https://eu-west-1.console.aws.amazon.com/ecs/v2/clusters/flight-deck-cluster/services/flight-deck-service

### ALB Target Health

```bash
# Check target health
aws elbv2 describe-target-health \
  --target-group-arn <TG-ARN> \
  --region eu-west-1
```

## Troubleshooting

### Service won't start

```bash
# Check service events
aws ecs describe-services --cluster flight-deck-cluster --services flight-deck-service --query 'services[0].events[:5]' --region eu-west-1

# Check task stopped reason
aws ecs describe-tasks --cluster flight-deck-cluster --tasks <task-arn> --query 'tasks[0].stoppedReason' --region eu-west-1
```

### Tasks failing health checks

```bash
# Check logs for health check errors
aws logs tail /ecs/flight-deck --follow --filter-pattern "health" --region eu-west-1

# Test health endpoint directly from EC2 instance
# SSH to EC2 instance and run:
curl http://localhost:3005/health
```

### SSL certificate issues

```bash
# Check certificate status
aws acm describe-certificate --certificate-arn <CERT-ARN> --region eu-west-1

# List all certificates
aws acm list-certificates --region eu-west-1
```

### Cannot access application

1. Check DNS propagation: `dig flightdeck.sandsmedia.com`
2. Check ALB status: `aws elbv2 describe-load-balancers --names flight-deck-alb --region eu-west-1`
3. Check target health: See ALB Target Health above
4. Check security groups: Verify ALB SG allows 443, ECS SG allows 3005 from ALB

## Rollback

If deployment fails, rollback to previous task definition:

```bash
# List recent task definitions
aws ecs list-task-definitions --family-prefix flight-deck-task --sort DESC --max-items 5 --region eu-west-1

# Update service to previous revision
aws ecs update-service \
  --cluster flight-deck-cluster \
  --service flight-deck-service \
  --task-definition flight-deck-task:<PREVIOUS-REVISION> \
  --force-new-deployment \
  --region eu-west-1
```

## Teardown

To completely remove all AWS resources:

```bash
# Delete ECS service
aws ecs update-service --cluster flight-deck-cluster --service flight-deck-service --desired-count 0 --region eu-west-1
aws ecs delete-service --cluster flight-deck-cluster --service flight-deck-service --region eu-west-1

# Delete ALB and target group
aws elbv2 delete-load-balancer --load-balancer-arn <ALB-ARN> --region eu-west-1
aws elbv2 delete-target-group --target-group-arn <TG-ARN> --region eu-west-1

# Delete CloudFormation stack (this removes EC2, ECS cluster, etc.)
aws cloudformation delete-stack --stack-name flight-deck-ecs-infrastructure --region eu-west-1

# Delete ECR repository (careful - this deletes all images!)
aws ecr delete-repository --repository-name flight-deck --force --region eu-west-1

# Delete log group
aws logs delete-log-group --log-group-name /ecs/flight-deck --region eu-west-1

# Delete SSM parameters
aws ssm delete-parameters --names $(aws ssm get-parameters-by-path --path /flight-deck/prod --query 'Parameters[].Name' --output text) --region eu-west-1
```

## Support

For issues or questions:
1. Check CloudWatch logs: `/ecs/flight-deck`
2. Review ECS service events
3. Verify security groups and target health
4. Check DNS resolution
5. Test health endpoint: `curl https://flightdeck.sandsmedia.com/health`
