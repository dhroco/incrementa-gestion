#!/bin/bash

set -e

# Script to delete CloudFormation stack for GFA Contratos

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

echo "========================================="
echo "Deleting CloudFormation Stack"
echo "========================================="
echo "Stack Name: $STACK_NAME"
echo "Environment: $ENVIRONMENT"
echo "========================================="
echo ""
echo "WARNING: This will delete all resources in the stack!"
echo "Press Ctrl+C to cancel, or Enter to continue..."
read

echo "Deleting stack..."
aws cloudformation delete-stack --stack-name "$STACK_NAME"

echo ""
echo "Waiting for stack deletion to complete..."
aws cloudformation wait stack-delete-complete --stack-name "$STACK_NAME"

echo ""
echo "========================================="
echo "Stack deleted successfully!"
echo "========================================="
echo "Environment: $ENVIRONMENT"
