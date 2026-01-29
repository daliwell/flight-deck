# Flight Deck - Quick Deployment Reference

## 🚀 First-Time Production Setup

```bash
# 1. Infrastructure (creates ECS cluster, ECR, SSM parameters)
chmod +x scripts/setup-aws-production.sh
./scripts/setup-aws-production.sh

# 2. Networking (creates ALB, target groups, ECS service)
chmod +x scripts/setup-alb.sh
./scripts/setup-alb.sh

# 3. Configure DNS
# CNAME: flightdeck.sandsmedia.com → <ALB-DNS-from-step-2>

# 4. Deploy application
chmod +x scripts/deploy-production.sh
./scripts/deploy-production.sh
```

**Total time:** ~15-20 minutes (excluding DNS propagation)

## 📦 Regular Deployments

```bash
# Commit changes
git add .
git commit -m "Your changes"
git push

# Deploy
./scripts/deploy-production.sh
```

**Time:** ~5-10 minutes

## 🔍 Quick Checks

```bash
# Service status
aws ecs describe-services --cluster flight-deck-cluster --services flight-deck-service --query 'services[0].{Status:status,Running:runningCount,Desired:desiredCount}' --output table --region eu-west-1

# View logs
aws logs tail /ecs/flight-deck --follow --region eu-west-1

# Test health
curl https://flightdeck.sandsmedia.com/health

# Test app
open https://flightdeck.sandsmedia.com
```

## 🏗️ Architecture

- **Compute:** ECS on EC2 t3.small (~$182/year)
- **Load Balancer:** ALB with HTTPS (~$192/year)  
- **Total Cost:** ~$374/year (vs ~$552-672/year with Fargate)
- **Region:** eu-west-1
- **Domain:** https://flightdeck.sandsmedia.com

## 📝 Key Resources

- **Cluster:** flight-deck-cluster
- **Service:** flight-deck-service
- **Task:** flight-deck-task
- **ECR:** 151853531988.dkr.ecr.eu-west-1.amazonaws.com/flight-deck
- **Logs:** /ecs/flight-deck
- **SSM:** /flight-deck/prod/*

## 🛠️ Troubleshooting

```bash
# Service not starting?
aws ecs describe-services --cluster flight-deck-cluster --services flight-deck-service --query 'services[0].events[:5]' --region eu-west-1

# Tasks failing?
aws logs tail /ecs/flight-deck --follow --filter-pattern "error" --region eu-west-1

# Health checks failing?
# SSH to EC2 and run: curl http://localhost:3005/health

# ALB target health?
aws elbv2 describe-target-groups --names flight-deck-tg --query 'TargetGroups[0].TargetGroupArn' --output text --region eu-west-1 | xargs -I {} aws elbv2 describe-target-health --target-group-arn {} --region eu-west-1
```

## 🔄 Rollback

```bash
# List recent versions
aws ecs list-task-definitions --family-prefix flight-deck-task --sort DESC --max-items 5 --region eu-west-1

# Rollback to previous
aws ecs update-service --cluster flight-deck-cluster --service flight-deck-service --task-definition flight-deck-task:<REVISION> --force-new-deployment --region eu-west-1
```

## 📚 Full Documentation

See [AWS-DEPLOYMENT.md](AWS-DEPLOYMENT.md) for complete deployment guide.
