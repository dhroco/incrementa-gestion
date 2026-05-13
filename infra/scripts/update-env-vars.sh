#!/bin/bash

set -e

# Script to update environment variables in ECS task definition without redeploying image

ENVIRONMENT=$1

if [ -z "$ENVIRONMENT" ]; then
  echo "Usage: $0 <environment>"
  echo "  environment: dev or prod"
  exit 1
fi

if [ "$ENVIRONMENT" != "dev" ] && [ "$ENVIRONMENT" != "prod" ]; then
  echo "Error: Environment must be 'dev' or 'prod'"
  exit 1
fi

TASK_DEFINITION="gfa-contratos-${ENVIRONMENT}-backend-task"
ECS_CLUSTER="gfa-contratos-${ENVIRONMENT}-cluster"
ECS_SERVICE="gfa-contratos-${ENVIRONMENT}-backend-service"

echo "========================================="
echo "Updating Environment Variables"
echo "========================================="
echo "Environment: $ENVIRONMENT"
echo "Task Definition: $TASK_DEFINITION"
echo "========================================="

# Download current task definition
echo "Downloading current task definition..."
aws ecs describe-task-definition \
  --task-definition "$TASK_DEFINITION" \
  --query 'taskDefinition' > /tmp/task-definition.json

echo "Current task definition saved to /tmp/task-definition.json"
echo ""
echo "Edit the environment variables in the file, then press Enter to continue..."
echo "Look for the 'environment' array in containerDefinitions[0]"
read

# Register new task definition
echo "Registering new task definition..."
TASK_DEF_ARN=$(aws ecs register-task-definition \
  --cli-input-json file:///tmp/task-definition.json \
  --query 'taskDefinition.taskDefinitionArn' \
  --output text)

echo "New task definition registered: $TASK_DEF_ARN"

# Update service
echo "Updating ECS service..."
aws ecs update-service \
  --cluster "$ECS_CLUSTER" \
  --service "$ECS_SERVICE" \
  --task-definition "$TASK_DEF_ARN" \
  --force-new-deployment

echo ""
echo "========================================="
echo "Environment variables updated!"
echo "========================================="
echo "Service is being updated with new task definition"
echo "Monitor deployment status in AWS Console"
