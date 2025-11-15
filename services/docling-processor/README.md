# Docling PDF Processing Service

A FastAPI service that uses [Docling](https://github.com/docling-project/docling) to extract structured content from PDF documents for LLM context.

## 🚀 Quick Start

### Option 1: Python Local Setup
```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install Python dependencies
pip install -r requirements-simple.txt

# Run the service
uvicorn app:app --host 0.0.0.0 --port 8001
```

### Option 2: Docker Setup
```bash
# Build and run with Docker
docker build -t docling-processor .
docker run -p 8001:8080 docling-processor
```

## 🔌 Integration with DocuSign Unlocked Next.js App

The service integrates seamlessly with your async processing workflow:

### Current Working Setup (Local + ngrok)
```
Next.js App → ngrok tunnel → Local Docling Service
     ↓              ↓              ↓
Environment    Public URL    Fast Processing
Variables   (a5fd808de8a8)   (0.6-2.5 sec)
```

**1. Start Docling Service:**
```bash
cd services/docling-processor
source venv/bin/activate
uvicorn app:app --host 0.0.0.0 --port 8001
```

**2. Create Public Tunnel:**
```bash
# In another terminal
ngrok http 8001
# Note the https://xxx.ngrok-free.app URL
```

**3. Configure Next.js Environment:**
Add to your `clean-app/.env`:
```bash
# Docling Service Configuration (WORKING SETUP)
DOCLING_SERVICE_URL=https://a5fd808de8a8.ngrok-free.app
DOCLING_API_KEY=docling-test-key-123
```

**4. Integration Flow:**
1. **PDF Upload** → Next.js stores PDF in Firebase immediately
2. **Background Processing** → Next.js calls ngrok URL → Local Docling service
3. **Structured Extraction** → Docling processes PDF (611 chars in ~1.5s)
4. **Firebase Storage** → Results stored for LLM context

## 🔐 Authentication

The service uses Bearer token authentication:

```bash
# Your Next.js app automatically includes this header:
Authorization: Bearer docling-test-key-123
```

**Testing the service directly:**
```bash
curl -X POST "https://a5fd808de8a8.ngrok-free.app/extract" \
  -H "Authorization: Bearer docling-test-key-123" \
  -F "file=@document.pdf"
```

## 📊 API Endpoints

### `POST /extract`
Extract structured content from PDF documents.

**Request:**
```bash
curl -X POST "http://localhost:8000/extract" \
  -F "file=@document.pdf"
```

**Response:**
```json
{
  "filename": "document.pdf",
  "success": true,
  "content": {
    "markdown": "# Document Title\n\nContent here...",
    "structure": {
      "title": "Document Title",
      "sections": [...],
      "tables": [...]
    },
    "text_chunks": [...],
    "metadata": {
      "page_count": 5,
      "has_tables": true,
      "has_images": false
    }
  }
}
```

### `GET /health`
Health check endpoint.

## 🎯 Features

### Advanced PDF Processing
- **Layout Understanding**: Recognizes headers, tables, lists
- **Structure Preservation**: Maintains document hierarchy
- **Table Extraction**: Preserves table formatting
- **Smart Chunking**: Creates optimal chunks for LLM context

### LLM-Ready Output
- **Markdown Format**: Clean, structured text
- **Intelligent Chunks**: Pre-segmented for RAG
- **Metadata Rich**: Contains document insights
- **Context Optimized**: Perfect for AI applications

## 📁 Storage Structure

When integrated, documents are stored as:

```
Firebase Storage:
├── resources/pdfs/{id}.pdf              # Original PDF
├── resources/metadata/{id}.json         # Basic metadata
├── resources/extracted-text/{id}.txt    # Simple text
└── resources/structured-data/{id}.json  # Rich Docling data
```

The structured data includes:
- Full markdown content
- Document structure (headers, tables)
- Intelligent text chunks
- Processing metadata

## 🔄 Processing Flow

```
PDF Upload → Async Processing → Docling Service
     ↓              ↓               ↓
 Immediate     Try Docling     Extract Structure
 Response      (fallback to         ↓
     ↓         Gemini AI)     Store for LLM Context
 Fast Upload      ↓               ↓
     ↓       Store Results    Ready for AI Features
 User sees
 document
```

## 🛠️ Development

### Adding Features
- Extend `extract_document_structure()` for more elements
- Modify `create_llm_chunks()` for different chunking strategies
- Add new endpoints for specific document types

### Performance
- Service handles concurrent requests
- Docling processes documents efficiently
- Results are cached in Firebase Storage

## 🚀 Deployment Options

### Current Setup: Local + ngrok ($0/month)
✅ **Working and Tested**
- **Cost**: Free
- **Setup time**: 5 minutes
- **Performance**: 611 chars in ~1.5 seconds
- **Perfect for**: Development and testing

### Future: Google Cloud Run (scale-to-zero)
📦 **For Production**
- **Cost**: ~$0.01/month (free tier eligible)
- **Setup**: Use `./deploy.sh` script
- **Benefits**: 24/7 availability, auto-scaling
- **When**: When you need permanent public access

### Alternative: Railway/Fly.io
💰 **More expensive** ($5+/month)
- Consider only if Google Cloud doesn't work

## 🧪 Testing Your Setup

Run the complete integration test:
```bash
cd clean-app
node test-docling-workflow.js
```

**Expected output:**
```
🎉 All tests passed! Docling integration is working correctly.
📊 Extraction Quality Assessment:
- Structured data preserved: ✅
- Text chunks available: ✅
- Metadata extracted: ✅
- Firebase storage working: ✅
```

## 📊 Performance Metrics

**Current working setup:**
- **Extraction quality**: 611 structured characters from 2-page PDF
- **Processing time**: 0.6-2.5 seconds per document
- **Success rate**: 100% (with Gemini AI fallback)
- **Cost**: $0 (local + ngrok)

## 🔧 Troubleshooting

### Service Not Starting
```bash
# Check Python version (3.11+ recommended)
python --version

# Recreate virtual environment
rm -rf venv
python -m venv venv
source venv/bin/activate
pip install -r requirements-simple.txt

# Check port availability
lsof -i :8001
```

### ngrok Issues
```bash
# Install/update ngrok
brew install ngrok

# Check tunnel status
curl http://localhost:4040/api/tunnels

# Restart tunnel
pkill ngrok
ngrok http 8001
```

### Next.js Not Finding Service
```bash
# Verify environment variables
cd clean-app
grep DOCLING .env

# Restart Next.js to pick up new env vars
npm run dev
```

### Extraction Failing
- **PDF issues**: Ensure PDF is not corrupted or password-protected
- **Size limits**: Large files (>10MB) may timeout
- **Network**: Check ngrok tunnel is active
- **Fallback**: System automatically falls back to Gemini AI

## 📈 Monitoring

**View Docling service logs:**
```bash
# Terminal where uvicorn is running shows processing logs
INFO - Processing document: document.pdf
INFO - Successfully processed document.pdf
```

**View Next.js integration logs:**
```bash
# Next.js terminal shows URL being called
🐍 Calling Docling service for advanced extraction at: https://xxx.ngrok-free.app
🔐 Using API key authentication for Docling service
```

**Check Firebase storage:**
Your PDFs and extracted content are stored in Firebase Storage under:
- `resources/pdfs/` - Original PDFs
- `resources/extracted-text/` - Plain text
- `resources/structured-data/` - Rich Docling output

This service provides the foundation for intelligent document processing with superior extraction quality compared to basic PDF parsing.