# Infrastructure

This directory contains infrastructure-as-code templates and deployment scripts for GFA Contratos AWS infrastructure.

## Structure

- `cloudformation/` - AWS CloudFormation templates for infrastructure provisioning
  - `main.yaml` - Main CloudFormation template (ECS, ECR, ALB, VPC, Security Groups)
  - `parameters-dev.json` - Parameters for dev environment
  - `parameters-prod.json` - Parameters for prod environment
- `scripts/` - Deployment and infrastructure management scripts
  - `deploy-stack.sh` - Deploy CloudFormation stack
  - `delete-stack.sh` - Delete CloudFormation stack
  - `update-env-vars.sh` - Update environment variables without redeploying

## Prerequisites

### AWS Account Setup

1. **AWS Account**: Active AWS account with appropriate permissions
2. **AWS CLI**: Install and configure AWS CLI v2
   ```bash
   aws --version
   aws configure
   ```
3. **Permissions**: IAM user/role with permissions for:
   - CloudFormation (full access)
   - ECS, ECR (full access)
   - EC2, VPC, ALB (create/manage resources)
   - IAM (create roles and policies)
   - CloudWatch Logs

### GitHub Secrets Configuration

Configure the following secrets in your GitHub repository (Settings → Secrets and variables → Actions):

- `AWS_ACCESS_KEY_ID`: AWS access key with deployment permissions
- `AWS_SECRET_ACCESS_KEY`: AWS secret access key
- `AWS_REGION`: AWS region (e.g., `us-east-1`)

## Deployment Instructions

### Initial Deployment

#### Step 1: Deploy CloudFormation Stack

Deploy infrastructure for dev environment:

```bash
./infra/scripts/deploy-stack.sh dev
```

Deploy infrastructure for prod environment:

```bash
./infra/scripts/deploy-stack.sh prod
```

This creates:
- ECR repository for Docker images
- ECS cluster with Fargate
- Application Load Balancer (ALB)
- VPC with public subnets
- Security groups
- IAM roles for ECS tasks
- CloudWatch log groups

#### Step 2: Build and Push Initial Image

After stack deployment, push the first Docker image manually:

```bash
# Login to ECR
aws ecr get-login-password --region <AWS_REGION> | docker login --username AWS --password-stdin <AWS_ACCOUNT_ID>.dkr.ecr.<AWS_REGION>.amazonaws.com

# Build image
cd backend
docker build -t gfa-contratos-backend-dev:latest .

# Tag image
docker tag gfa-contratos-backend-dev:latest <ECR_REPOSITORY_URI>:latest

# Push to ECR
docker push <ECR_REPOSITORY_URI>:latest
```

Get ECR repository URI from stack outputs:
```bash
aws cloudformation describe-stacks --stack-name gfa-contratos-dev-infra --query 'Stacks[0].Outputs[?OutputKey==`ECRRepositoryUri`].OutputValue' --output text
```

#### Step 3: Verify Deployment

1. **Check ECS Service**: Verify tasks are running
   ```bash
   aws ecs describe-services --cluster gfa-contratos-dev-cluster --services gfa-contratos-dev-backend-service
   ```

2. **Get ALB DNS**: Access the backend through ALB
   ```bash
   aws cloudformation describe-stacks --stack-name gfa-contratos-dev-infra --query 'Stacks[0].Outputs[?OutputKey==`ALBDnsName`].OutputValue' --output text
   ```

3. **Test Health Endpoint**:
   ```bash
   curl http://<ALB_DNS>/health
   ```
   Expected response: `{"status":"ok","environment":"dev"}`

### Continuous Deployment (GitHub Actions)

After initial setup, deployments are automated:

- **Push to `develop` branch** → Deploys to `dev` environment
- **Push to `main` branch** → Deploys to `prod` environment

The GitHub Actions workflow automatically:
1. Builds Docker image
2. Pushes to ECR
3. Updates ECS task definition
4. Deploys new version to ECS

## Resource Naming Conventions

All AWS resources follow the naming pattern: `gfa-contratos-{environment}-{resource-type}`

### CloudFormation Stacks
- Dev: `gfa-contratos-dev-infra`
- Prod: `gfa-contratos-prod-infra`

### AWS Resources

| Resource Type | Dev Name | Prod Name |
|--------------|----------|-----------|
| ECR Repository | `gfa-contratos-backend-dev` | `gfa-contratos-backend-prod` |
| ECS Cluster | `gfa-contratos-dev-cluster` | `gfa-contratos-prod-cluster` |
| ECS Service | `gfa-contratos-dev-backend-service` | `gfa-contratos-prod-backend-service` |
| Task Definition | `gfa-contratos-dev-backend-task` | `gfa-contratos-prod-backend-task` |
| ALB | `gfa-contratos-dev-alb` | `gfa-contratos-prod-alb` |
| Target Group | `gfa-contratos-dev-tg` | `gfa-contratos-prod-tg` |
| Security Groups | `gfa-contratos-dev-alb-sg`, `gfa-contratos-dev-ecs-sg` | `gfa-contratos-prod-alb-sg`, `gfa-contratos-prod-ecs-sg` |

## Stack Outputs

After deployment, the stack provides the following outputs:

- **ALBDnsName**: DNS name of the Application Load Balancer (use to access backend)
- **ECRRepositoryUri**: Full URI of the ECR repository
- **ECSClusterName**: Name of the ECS cluster
- **ECSServiceName**: Name of the ECS service
- **TaskDefinitionFamily**: Family name of the task definition

View outputs:
```bash
aws cloudformation describe-stacks --stack-name gfa-contratos-dev-infra --query 'Stacks[0].Outputs' --output table
```

## Rollback Procedures

### Manual Rollback to Previous Image

1. **List available images in ECR**:
   ```bash
   aws ecr describe-images --repository-name gfa-contratos-backend-dev --query 'sort_by(imageDetails,&imagePushedAt)[-10:]' --output table
   ```

2. **Download current task definition**:
   ```bash
   aws ecs describe-task-definition --task-definition gfa-contratos-dev-backend-task --query 'taskDefinition' > task-def.json
   ```

3. **Update image URI in task-def.json** to previous image tag

4. **Register new task definition**:
   ```bash
   aws ecs register-task-definition --cli-input-json file://task-def.json
   ```

5. **Update service with previous task definition**:
   ```bash
   aws ecs update-service --cluster gfa-contratos-dev-cluster --service gfa-contratos-dev-backend-service --task-definition gfa-contratos-dev-backend-task:<REVISION> --force-new-deployment
   ```

### Rollback via GitHub Actions

Re-run a previous successful workflow from GitHub Actions UI, or revert the commit and push to trigger new deployment.

## Environment Variables

The backend requires only one environment variable in the ECS task definition:

- `ENVIRONMENT`: Set to `dev` or `prod`

All other configuration (Supabase credentials, API keys, etc.) is managed internally by `backend/config.js` based on the `ENVIRONMENT` value.

## Monitoring and Logs

### CloudWatch Logs

Logs are available in CloudWatch Logs:
- Dev: `/ecs/gfa-contratos-dev-backend` (7 days retention)
- Prod: `/ecs/gfa-contratos-prod-backend` (30 days retention)

View logs:
```bash
aws logs tail /ecs/gfa-contratos-dev-backend --follow
```

### ECS Service Events

Monitor deployment events:
```bash
aws ecs describe-services --cluster gfa-contratos-dev-cluster --services gfa-contratos-dev-backend-service --query 'services[0].events[0:10]'
```

## Cost Optimization

### Estimated Monthly Costs (per environment)

- **ALB**: ~$16/month
- **Fargate**: ~$10-30/month (depends on usage)
- **ECR**: Minimal (storage for ~10 images)
- **CloudWatch Logs**: Minimal

**Total**: ~$26-46/month per environment

### Cost Saving Tips

- Stop dev environment outside business hours (manually scale to 0 tasks)
- Use lifecycle policies to clean up old ECR images (already configured)
- Monitor CloudWatch Logs retention

## Troubleshooting

### Tasks Not Starting

1. Check ECS service events for errors
2. Verify ECR image exists and is accessible
3. Check CloudWatch logs for application errors
4. Verify security group rules allow ALB → ECS communication

### Health Checks Failing

1. Verify `/health` endpoint is accessible in container
2. Check target group health check configuration
3. Review CloudWatch logs for application startup errors

### Cannot Access ALB

1. Verify ALB security group allows inbound port 80
2. Check ALB listener configuration
3. Ensure at least one healthy target in target group

## Cleanup

To delete all infrastructure:

```bash
# Delete dev environment
./infra/scripts/delete-stack.sh dev

# Delete prod environment
./infra/scripts/delete-stack.sh prod
```

**Warning**: This deletes all resources including ECR images. Backup any important data first.
