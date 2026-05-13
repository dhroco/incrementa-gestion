#!/bin/bash

set -e

# Script to deploy CloudFormation stack for GFA Contratos

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

STACK_NAME="gfa-contratos-${ENVIRONMENT}-infra"
TEMPLATE_FILE="infra/cloudformation/main.yaml"
PARAMETERS_FILE="infra/cloudformation/parameters-${ENVIRONMENT}.json"

echo "========================================="
echo "Deploying CloudFormation Stack"
echo "========================================="
echo "Stack Name: $STACK_NAME"
echo "Environment: $ENVIRONMENT"
echo "Template: $TEMPLATE_FILE"
echo "Parameters: $PARAMETERS_FILE"
echo "========================================="

# Check if files exist
if [ ! -f "$TEMPLATE_FILE" ]; then
  echo "Error: Template file not found: $TEMPLATE_FILE"
  exit 1
fi

if [ ! -f "$PARAMETERS_FILE" ]; then
  echo "Error: Parameters file not found: $PARAMETERS_FILE"
  exit 1
fi

# Deploy stack
echo "Deploying stack..."
aws cloudformation deploy \
  --template-file "$TEMPLATE_FILE" \
  --stack-name "$STACK_NAME" \
  --parameter-overrides file://"$PARAMETERS_FILE" \
  --capabilities CAPABILITY_NAMED_IAM \
  --no-fail-on-empty-changeset

echo ""
echo "========================================="
echo "Stack deployed successfully!"
echo "========================================="

# Get stack outputs
echo ""
echo "Stack Outputs:"
aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query 'Stacks[0].Outputs' \
  --output table

echo ""
echo "Deployment complete for environment: $ENVIRONMENT"
