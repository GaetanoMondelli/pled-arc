import time
import logging
from typing import List, Dict, Any
from docling.document_converter import DocumentConverter
from models.document_models import ProcessingResult, DocumentStructure, DocumentChunk, ProcessingStatus

logger = logging.getLogger(__name__)

class DoclingProcessor:
    def __init__(self):
        self.converter = DocumentConverter()
        logger.info("Docling processor initialized")

    async def process_document(self, file_content: bytes, document_id: str, filename: str) -> ProcessingResult:
        """
        Process a document using Docling and return structured results
        """
        start_time = time.time()

        try:
            logger.info(f"Starting Docling processing for document: {document_id}")

            # Save content to temporary file for Docling
            import tempfile
            import os

            with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
                temp_file.write(file_content)
                temp_path = temp_file.name

            try:
                # Process with Docling
                result = self.converter.convert(temp_path)
                doc = result.document

                # Extract raw text
                raw_text = doc.export_to_markdown()

                # Extract structured data
                structured_data = self._extract_structure(doc)

                # Create intelligent chunks
                chunks = self._create_chunks(doc, document_id)

                processing_time = time.time() - start_time
                logger.info(f"Docling processing completed for {document_id} in {processing_time:.2f}s")

                return ProcessingResult(
                    document_id=document_id,
                    status=ProcessingStatus.COMPLETED,
                    raw_text=raw_text,
                    structured_data=structured_data,
                    chunks=chunks,
                    processing_time=processing_time
                )

            finally:
                # Clean up temporary file
                if os.path.exists(temp_path):
                    os.unlink(temp_path)

        except Exception as e:
            processing_time = time.time() - start_time
            logger.error(f"Docling processing failed for {document_id}: {str(e)}")

            return ProcessingResult(
                document_id=document_id,
                status=ProcessingStatus.FAILED,
                raw_text="",
                structured_data=DocumentStructure(),
                chunks=[],
                processing_time=processing_time,
                error_message=str(e)
            )

    def _extract_structure(self, doc) -> DocumentStructure:
        """
        Extract structured information from Docling document
        """
        try:
            # Extract title
            title = None
            if hasattr(doc, 'title') and doc.title:
                title = doc.title

            # Extract headers, tables, images, etc.
            headers = []
            tables = []
            images = []

            # Process document elements
            if hasattr(doc, 'texts'):
                for text_item in doc.texts:
                    if text_item.label and 'heading' in text_item.label.lower():
                        headers.append({
                            'level': self._get_header_level(text_item.label),
                            'text': text_item.text,
                            'page': getattr(text_item, 'page_no', None)
                        })

            if hasattr(doc, 'tables'):
                for table in doc.tables:
                    tables.append({
                        'content': table.export_to_html() if hasattr(table, 'export_to_html') else str(table),
                        'page': getattr(table, 'page_no', None),
                        'caption': getattr(table, 'caption', None)
                    })

            return DocumentStructure(
                title=title,
                headers=headers,
                tables=tables,
                images=images,
                metadata={'docling_version': '1.0.0'}
            )

        except Exception as e:
            logger.warning(f"Failed to extract structure: {str(e)}")
            return DocumentStructure()

    def _create_chunks(self, doc, document_id: str) -> List[DocumentChunk]:
        """
        Create intelligent chunks based on document structure
        """
        chunks = []

        try:
            # Get text content
            if hasattr(doc, 'texts'):
                chunk_id = 0
                current_chunk = []
                current_page = None

                for text_item in doc.texts:
                    text = text_item.text.strip()
                    if not text:
                        continue

                    page_no = getattr(text_item, 'page_no', None)

                    # Create new chunk if page changes or chunk gets too long
                    if (current_page and page_no != current_page) or len(' '.join(current_chunk)) > 1000:
                        if current_chunk:
                            chunks.append(DocumentChunk(
                                id=f"{document_id}_chunk_{chunk_id}",
                                content=' '.join(current_chunk),
                                metadata={
                                    'page_number': current_page,
                                    'chunk_index': chunk_id,
                                    'chunk_type': 'text'
                                },
                                page_number=current_page,
                                chunk_type='text'
                            ))
                            chunk_id += 1
                            current_chunk = []

                    current_chunk.append(text)
                    current_page = page_no

                # Add final chunk
                if current_chunk:
                    chunks.append(DocumentChunk(
                        id=f"{document_id}_chunk_{chunk_id}",
                        content=' '.join(current_chunk),
                        metadata={
                            'page_number': current_page,
                            'chunk_index': chunk_id,
                            'chunk_type': 'text'
                        },
                        page_number=current_page,
                        chunk_type='text'
                    ))

            # Add table chunks
            if hasattr(doc, 'tables'):
                for i, table in enumerate(doc.tables):
                    chunks.append(DocumentChunk(
                        id=f"{document_id}_table_{i}",
                        content=table.export_to_html() if hasattr(table, 'export_to_html') else str(table),
                        metadata={
                            'page_number': getattr(table, 'page_no', None),
                            'table_index': i,
                            'chunk_type': 'table'
                        },
                        page_number=getattr(table, 'page_no', None),
                        chunk_type='table'
                    ))

        except Exception as e:
            logger.warning(f"Failed to create chunks: {str(e)}")

        return chunks

    def _get_header_level(self, label: str) -> int:
        """
        Extract header level from label
        """
        if 'h1' in label.lower() or 'title' in label.lower():
            return 1
        elif 'h2' in label.lower():
            return 2
        elif 'h3' in label.lower():
            return 3
        elif 'h4' in label.lower():
            return 4
        else:
            return 1