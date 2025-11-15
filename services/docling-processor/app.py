from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import uvicorn
import logging
import tempfile
import os
from docling.document_converter import DocumentConverter
from typing import Dict, Any, Optional
import secrets

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Docling Extraction Service", version="1.0.0")

# Security configuration
security = HTTPBearer()
API_KEY = os.getenv("DOCLING_API_KEY", "your-secure-api-key-here")

async def verify_api_key(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify API key authentication"""
    if credentials.credentials != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return credentials.credentials

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Docling converter
converter = DocumentConverter()

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "docling-processor"}

@app.post("/extract")
async def extract_document(
    file: UploadFile = File(...),
    api_key: str = Depends(verify_api_key),
    callback_url: str = None,
    resource_id: str = None
):
    """
    Extract structured content from document using Docling
    Focused on providing rich context for LLMs
    """
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    try:
        logger.info(f"Processing document: {file.filename}")

        # Read file content
        file_content = await file.read()

        # Save to temporary file for Docling
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
            temp_file.write(file_content)
            temp_path = temp_file.name

        try:
            # Process with Docling
            result = converter.convert(temp_path)
            doc = result.document

            # Extract structured content for LLM context
            extraction_result = {
                "filename": file.filename,
                "success": True,
                "content": {
                    # Full markdown - great for LLM context
                    "markdown": doc.export_to_markdown(),

                    # Structured elements
                    "structure": extract_document_structure(doc),

                    # Clean text chunks for easy LLM consumption
                    "text_chunks": create_llm_chunks(doc),

                    # Metadata
                    "metadata": {
                        "page_count": get_page_count(doc),
                        "has_tables": has_tables(doc),
                        "has_images": has_images(doc),
                        "processing_method": "docling"
                    }
                }
            }

            logger.info(f"Successfully processed {file.filename}")

            # If callback URL provided, send results there instead of returning
            if callback_url and resource_id:
                logger.info(f"Sending results to callback URL: {callback_url}")
                try:
                    import httpx
                    async with httpx.AsyncClient() as client:
                        callback_response = await client.post(
                            callback_url,
                            json={
                                "resource_id": resource_id,
                                "success": True,
                                "extraction_method": "docling",
                                "content": extraction_result["content"]["markdown"],
                                "structured_data": extraction_result["content"],
                                "characters_extracted": len(extraction_result["content"]["markdown"])
                            },
                            timeout=30.0
                        )
                        logger.info(f"Callback sent successfully: {callback_response.status_code}")

                    return {"success": True, "message": "Results sent to callback URL", "resource_id": resource_id}

                except Exception as callback_error:
                    logger.error(f"Failed to send callback: {callback_error}")
                    # Still return the extraction result even if callback fails
                    return extraction_result
            else:
                return extraction_result

        finally:
            # Clean up temp file
            if os.path.exists(temp_path):
                os.unlink(temp_path)

    except Exception as e:
        logger.error(f"Error processing {file.filename}: {str(e)}")
        return {
            "filename": file.filename,
            "success": False,
            "error": str(e),
            "content": None
        }

def extract_document_structure(doc) -> Dict[str, Any]:
    """Extract document structure for better LLM understanding"""
    structure = {
        "title": None,
        "sections": [],
        "tables": [],
        "key_elements": []
    }

    try:
        # Extract title/heading information
        if hasattr(doc, 'texts'):
            for text_item in doc.texts:
                if hasattr(text_item, 'label') and text_item.label:
                    if 'title' in text_item.label.lower() or 'heading' in text_item.label.lower():
                        level = get_heading_level(text_item.label)
                        structure["sections"].append({
                            "level": level,
                            "text": text_item.text.strip(),
                            "type": text_item.label
                        })

        # Extract tables with context
        if hasattr(doc, 'tables'):
            for i, table in enumerate(doc.tables):
                table_content = table.export_to_markdown() if hasattr(table, 'export_to_markdown') else str(table)
                structure["tables"].append({
                    "index": i,
                    "content": table_content,
                    "description": f"Table {i+1} from document"
                })

    except Exception as e:
        logger.warning(f"Error extracting structure: {e}")

    return structure

def create_llm_chunks(doc, max_chunk_size: int = 2000) -> list:
    """Create optimized text chunks for LLM context"""
    chunks = []

    try:
        full_text = doc.export_to_markdown()

        # Split by paragraphs first, then by size if needed
        paragraphs = full_text.split('\n\n')
        current_chunk = []
        current_size = 0

        for paragraph in paragraphs:
            paragraph = paragraph.strip()
            if not paragraph:
                continue

            # If adding this paragraph exceeds chunk size, save current chunk
            if current_size + len(paragraph) > max_chunk_size and current_chunk:
                chunks.append({
                    "text": '\n\n'.join(current_chunk),
                    "size": current_size,
                    "type": "paragraph_group"
                })
                current_chunk = []
                current_size = 0

            current_chunk.append(paragraph)
            current_size += len(paragraph)

        # Add final chunk
        if current_chunk:
            chunks.append({
                "text": '\n\n'.join(current_chunk),
                "size": current_size,
                "type": "paragraph_group"
            })

    except Exception as e:
        logger.warning(f"Error creating chunks: {e}")
        # Fallback to simple text splitting
        try:
            full_text = doc.export_to_markdown()
            words = full_text.split()
            chunk_words = []

            for word in words:
                chunk_words.append(word)
                if len(' '.join(chunk_words)) > max_chunk_size:
                    chunks.append({
                        "text": ' '.join(chunk_words[:-1]),
                        "size": len(' '.join(chunk_words[:-1])),
                        "type": "word_split"
                    })
                    chunk_words = [word]

            if chunk_words:
                chunks.append({
                    "text": ' '.join(chunk_words),
                    "size": len(' '.join(chunk_words)),
                    "type": "word_split"
                })
        except:
            chunks = [{"text": "Error creating chunks", "size": 0, "type": "error"}]

    return chunks

def get_heading_level(label: str) -> int:
    """Determine heading level from label"""
    label_lower = label.lower()
    if 'title' in label_lower:
        return 1
    elif 'h1' in label_lower:
        return 1
    elif 'h2' in label_lower:
        return 2
    elif 'h3' in label_lower:
        return 3
    elif 'h4' in label_lower:
        return 4
    else:
        return 2  # Default

def get_page_count(doc) -> int:
    """Get number of pages in document"""
    try:
        if hasattr(doc, 'pages'):
            return len(doc.pages)
        return 1
    except:
        return 1

def has_tables(doc) -> bool:
    """Check if document contains tables"""
    try:
        return hasattr(doc, 'tables') and len(doc.tables) > 0
    except:
        return False

def has_images(doc) -> bool:
    """Check if document contains images"""
    try:
        return hasattr(doc, 'pictures') and len(doc.pictures) > 0
    except:
        return False

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)