FROM node:18-slim

# Install curl for health checks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Set environment variables for Cloud Run
ENV NODE_ENV=production

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies (including devDependencies for build)
RUN npm ci --include=dev

# Copy source code and config
COPY tsconfig.json ./
COPY src/ ./src/

# Build the application
RUN npx tsc src/chat-workflow-agent.ts --outDir dist --target ES2022 --module commonjs --moduleResolution node --esModuleInterop --skipLibCheck --allowJs

# Remove dev dependencies and clean cache
RUN npm prune --production && npm cache clean --force

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs
USER nodejs

# Expose port
EXPOSE $PORT

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:$PORT/health || exit 1

# Start the application
CMD ["node", "dist/chat-workflow-agent.js"]