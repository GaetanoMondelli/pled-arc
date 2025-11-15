FROM python:3.12-slim

# Set environment variables for Cloud Run
ENV PYTHONUNBUFFERED=1
ENV PORT=8080
ENV PIP_NO_CACHE_DIR=1
ENV PIP_DISABLE_PIP_VERSION_CHECK=1

# Set working directory
WORKDIR /app

# Install system dependencies for Docling
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip first
RUN pip install --upgrade pip

# Copy requirements and install Python dependencies
COPY requirements-simple.txt .
RUN pip install --no-cache-dir -r requirements-simple.txt

# Copy application code
COPY . .

# Expose port (Cloud Run uses $PORT environment variable)
EXPOSE $PORT

# Health check for Cloud Run
HEALTHCHECK --interval=30s --timeout=30s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:$PORT/health || exit 1

# Run the application with uvicorn (Cloud Run compatible)
CMD uvicorn app:app --host 0.0.0.0 --port $PORT