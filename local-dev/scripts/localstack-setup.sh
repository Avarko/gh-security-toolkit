#!/bin/bash
# LocalStack S3 bucket setup for local dashboard development
# Creates two tenant buckets with test data for contoso and acme customers

set -euo pipefail

LOCALSTACK_ENDPOINT="${AWS_ENDPOINT_URL:-http://localhost:4566}"
AWS_CLI="aws --endpoint-url=$LOCALSTACK_ENDPOINT --region us-east-1"

# Bucket names
CONTOSO_BUCKET="contoso-security-reports"
ACME_BUCKET="acme-security-reports"

echo "🚀 Setting up LocalStack S3 buckets..."
echo "   Endpoint: $LOCALSTACK_ENDPOINT"

# Wait for LocalStack to be ready
echo "⏳ Waiting for LocalStack to be ready..."
until $AWS_CLI s3 ls 2>/dev/null; do
    sleep 1
done
echo "✅ LocalStack is ready"

# Create buckets
echo "📦 Creating S3 buckets..."
$AWS_CLI s3 mb s3://$CONTOSO_BUCKET 2>/dev/null || echo "   Bucket $CONTOSO_BUCKET already exists"
$AWS_CLI s3 mb s3://$ACME_BUCKET 2>/dev/null || echo "   Bucket $ACME_BUCKET already exists"

# Set CORS for browser access
echo "🔧 Configuring CORS..."
CORS_CONFIG='{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "HEAD"],
      "AllowedOrigins": ["http://localhost:5173", "http://localhost:4173"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3600
    }
  ]
}'

$AWS_CLI s3api put-bucket-cors --bucket $CONTOSO_BUCKET --cors-configuration "$CORS_CONFIG"
$AWS_CLI s3api put-bucket-cors --bucket $ACME_BUCKET --cors-configuration "$CORS_CONFIG"

# Generate test data directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TEST_DATA_DIR="$SCRIPT_DIR/../../local-dev/data"

echo "📝 Generating test data..."
# (Lisää testidatan generointi tähän tarvittaessa)

echo "✅ LocalStack S3 setup complete."
