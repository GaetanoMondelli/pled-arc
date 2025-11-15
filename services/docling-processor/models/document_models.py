from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from enum import Enum

class ProcessingStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class DocumentChunk(BaseModel):
    id: str
    content: str
    metadata: Dict[str, Any]
    page_number: Optional[int] = None
    chunk_type: Optional[str] = None  # text, table, image, etc.

class DocumentStructure(BaseModel):
    title: Optional[str] = None
    headers: List[Dict[str, Any]] = []
    tables: List[Dict[str, Any]] = []
    images: List[Dict[str, Any]] = []
    metadata: Dict[str, Any] = {}

class ProcessingResult(BaseModel):
    document_id: str
    status: ProcessingStatus
    raw_text: str
    structured_data: DocumentStructure
    chunks: List[DocumentChunk] = []
    processing_time: float
    error_message: Optional[str] = None

class QueryRequest(BaseModel):
    query: str
    document_ids: Optional[List[str]] = None
    max_results: int = 5
    include_metadata: bool = True

class QueryResult(BaseModel):
    query: str
    results: List[Dict[str, Any]]
    total_results: int
    processing_time: float