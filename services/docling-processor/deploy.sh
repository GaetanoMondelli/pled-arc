#!/bin/bash

# Deploy Docling Service to Google Cloud Run
# Ultra-low-cost deployment with scale-to-zero

set -e

# Configuration
PROJECT_ID=${GOOGLE_CLOUD_PROJECT:-"your-project-id"}
SERVICE_NAME="docling-processor"
REGION=${REGION:-"us-central1"}
API_KEY=${DOCLING_API_KEY:-$(openssl rand -hex 32)}

echo "🚀 Deploying Docling Processor to Google Cloud Run"
echo "📋 Project: $PROJECT_ID"
echo "🌍 Region: $REGION"
echo "🔑 API Key: ${API_KEY:0:8}..."

# Ensure we're authenticated
echo "🔐 Checking Google Cloud authentication..."
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo "❌ Please run 'gcloud auth login' first"
    exit 1
fi

# Set the project
gcloud config set project $PROJECT_ID

# Build and deploy to Cloud Run
echo "🏗️ Building and deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
    --source . \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --set-env-vars DOCLING_API_KEY=$API_KEY \
    --memory 4Gi \
    --cpu 2 \
    --min-instances 0 \
    --max-instances 10 \
    --timeout 3600 \
    --concurrency 5 \
    --port 8080

# Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format 'value(status.url)')

echo ""
echo "🎉 Deployment successful!"
echo "📍 Service URL: $SERVICE_URL"
echo "🔑 API Key: $API_KEY"
echo ""
echo "📝 Test your deployment:"
echo "curl -X POST \"$SERVICE_URL/extract\" \\"
echo "  -H \"Authorization: Bearer $API_KEY\" \\"
echo "  -F \"file=@your-document.pdf\""
echo ""
echo "💰 Cost optimization tips:"
echo "- Service scales to ZERO when idle (no cost)"
echo "- Only pay during document processing"
echo "- Free tier covers ~2M requests/month"
echo "- Typical cost: <$0.01/month for light usage"