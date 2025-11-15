# 🚀 Docling Service Deployment Guide

Deploy your Docling PDF processing service to Google Cloud Run with **scale-to-zero** for ultra-low costs.

## 💰 Cost Overview

**Google Cloud Run Pricing (2024):**
- 🆓 **Free Tier**: 2 million requests/month, 400,000 GB-seconds
- 💸 **Pay-per-use**: Only during document processing
- 📉 **Scale-to-zero**: $0 when idle
- 💵 **Typical monthly cost**: <$0.01 for light usage

## 🛠️ Prerequisites

1. **Google Cloud Account** with billing enabled
2. **gcloud CLI** installed and configured
3. **Docker** (optional - Cloud Run can build from source)

```bash
# Install gcloud CLI (if not already installed)
curl https://sdk.cloud.google.com | bash
exec -l $SHELL

# Authenticate with Google Cloud
gcloud auth login
gcloud auth application-default login
```

## 🚀 Quick Deployment

### Option 1: One-Click Deploy (Recommended)

```bash
cd /path/to/docling-processor
./deploy.sh
```

### Option 2: Manual Deployment

```bash
# Set your project ID
export GOOGLE_CLOUD_PROJECT="your-project-id"

# Generate a secure API key
export DOCLING_API_KEY=$(openssl rand -hex 32)

# Deploy to Cloud Run
gcloud run deploy docling-processor \
    --source . \
    --platform managed \
    --region us-central1 \
    --allow-unauthenticated \
    --set-env-vars DOCLING_API_KEY=$DOCLING_API_KEY \
    --memory 4Gi \
    --cpu 2 \
    --min-instances 0 \
    --max-instances 10 \
    --timeout 3600 \
    --concurrency 5 \
    --port 8080
```

## 🔐 Authentication

The service uses **Bearer token authentication** for security:

```bash
# Your API key is set during deployment
# Use it in the Authorization header
curl -X POST "https://your-service-url/extract" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "file=@document.pdf"
```

## 📊 Integration with Next.js App

Update your Next.js environment variables:

```env
# .env.local
DOCLING_SERVICE_URL=https://your-cloud-run-url
DOCLING_API_KEY=your-generated-api-key
```

The service will automatically integrate with your existing async workflow!

## 🎯 Cost Optimization Features

### 1. Scale-to-Zero Configuration
```yaml
min-instances: 0        # Scales to zero when idle
max-instances: 10       # Handles traffic spikes
concurrency: 5          # Multiple requests per instance
```

### 2. Resource Optimization
```yaml
memory: 4Gi            # Sufficient for Docling models
cpu: 2                 # Fast processing
timeout: 3600          # 1 hour max (prevents runaway costs)
```

### 3. Cold Start Optimization
- Minimal base image (python:3.11-slim)
- Cached dependency layers
- Health check for faster startups

## 📈 Monitoring & Logs

View logs and metrics:
```bash
# View logs
gcloud logging read "resource.type=cloud_run_revision"

# Monitor performance
gcloud run services describe docling-processor --region=us-central1
```

## 🔧 Configuration Options

### Environment Variables
- `DOCLING_API_KEY`: Authentication token
- `PORT`: Server port (automatically set by Cloud Run)

### Resource Limits
- **Memory**: 4Gi (adjustable based on usage)
- **CPU**: 2 cores (faster processing)
- **Timeout**: 1 hour max

## 🚨 Security Best Practices

1. **API Key Security**:
   - Store in Google Secret Manager for production
   - Rotate regularly
   - Never commit to version control

2. **Network Security**:
   - HTTPS-only endpoints
   - Private VPC (optional)
   - Cloud Armor for DDoS protection

3. **Access Control**:
   - IAM roles for service accounts
   - Audit logs enabled

## 💡 Production Enhancements

### 1. Secret Management
```bash
# Store API key in Secret Manager
gcloud secrets create docling-api-key --data-file=-
echo "your-secure-api-key" | gcloud secrets create docling-api-key --data-file=-

# Update service to use secret
gcloud run services update docling-processor \
    --set-env-vars DOCLING_API_KEY=projects/PROJECT_ID/secrets/docling-api-key:latest
```

### 2. Custom Domain
```bash
# Map custom domain
gcloud run domain-mappings create --service docling-processor --domain api.yourdomain.com
```

### 3. Monitoring Alerts
```bash
# Set up billing alerts
gcloud billing accounts list
gcloud alpha billing budgets create --billing-account=ACCOUNT_ID --budget-name=docling-budget
```

## 🎉 Testing Your Deployment

```bash
# Health check
curl https://your-service-url/health

# Test document extraction
curl -X POST "https://your-service-url/extract" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "file=@test-document.pdf"
```

## 🆘 Troubleshooting

### Common Issues:

1. **Authentication Error (401)**
   - Check API key in Authorization header
   - Verify environment variable is set

2. **Memory Limit Exceeded**
   - Increase memory allocation
   - Process smaller documents

3. **Cold Start Timeout**
   - Increase startup timeout
   - Optimize Docker image size

### Debug Commands:
```bash
# Check service status
gcloud run services describe docling-processor --region=us-central1

# View recent logs
gcloud logging read "resource.type=cloud_run_revision" --limit=50

# Check environment variables
gcloud run services describe docling-processor --region=us-central1 --format="value(spec.template.spec.template.spec.containers[0].env[])"
```

---

**🎯 Result**: A production-ready, cost-optimized Docling service that scales to zero and handles thousands of documents per month for under $1!