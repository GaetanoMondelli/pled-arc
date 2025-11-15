#!/bin/bash

# Deploy Workflow Agent to Google Cloud Run
# Ultra-low-cost deployment with scale-to-zero

set -e

# Configuration
PROJECT_ID=${GOOGLE_CLOUD_PROJECT:-"quantmondelli"}
SERVICE_NAME="workflow-agent"
REGION=${REGION:-"us-central1"}
API_KEY=${WORKFLOW_AGENT_API_KEY:-$(openssl rand -hex 32)}

echo "🚀 Deploying Workflow Agent to Google Cloud Run"
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
    --set-env-vars "WORKFLOW_AGENT_API_KEY=$API_KEY,GOOGLE_AI_API_KEY=AIzaSyD9Wa0jy-3C4zb0kVsPS-sDD5DaN8GuJjY,GOOGLE_API_KEY=AIzaSyD9Wa0jy-3C4zb0kVsPS-sDD5DaN8GuJjY" \
    --set-env-vars NODE_ENV=production \
    --memory 2Gi \
    --cpu 1 \
    --min-instances 0 \
    --max-instances 10 \
    --timeout 300 \
    --concurrency 10

# Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format 'value(status.url)')

echo ""
echo "🎉 Deployment successful!"
echo "📍 Service URL: $SERVICE_URL"
echo "🔑 API Key: $API_KEY"
echo ""
echo "📝 Test your deployment:"
echo ""
echo "# Health check"
echo "curl $SERVICE_URL/health"
echo ""
echo "# Create a simple flow"
echo "curl -X POST \"$SERVICE_URL/chat\" \\"
echo "  -H \"Authorization: Bearer $API_KEY\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"message\": \"Create a simple data processing flow\"}'"
echo ""
echo "# Quick flow creation"
echo "curl -X POST \"$SERVICE_URL/quick-flow\" \\"
echo "  -H \"Authorization: Bearer $API_KEY\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"description\": \"Process sensor data with AI validation\", \"flowType\": \"ai_processing\"}'"
echo ""
echo "💰 Cost optimization:"
echo "- Service scales to ZERO when idle (no cost)"
echo "- Only pay during active requests"
echo "- Free tier covers ~2M requests/month"
echo "- Typical cost: <$0.05/month for light usage"
echo ""
echo "🔧 Environment variables to set in your frontend:"
echo "WORKFLOW_AGENT_URL=$SERVICE_URL"
echo "WORKFLOW_AGENT_API_KEY=$API_KEY"