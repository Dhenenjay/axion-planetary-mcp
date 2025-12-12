# Axion MCP SSE Server - Self-Deployable Version
# Node.js 20 + Python 3.11 for ML Classification

FROM node:20-bookworm-slim

# Install Python 3 and dependencies for ML classification
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --legacy-peer-deps

# Copy source code
COPY src/ ./src/
COPY scripts/ ./scripts/
COPY tsconfig*.json ./
COPY tsup.config.ts ./

# Build the SSE server
RUN npm run build:sse

# Install Python dependencies for Classification
RUN pip3 install --no-cache-dir --break-system-packages \
    numpy \
    pystac-client \
    scikit-learn

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV PYTHON_PATH=python3
ENV CLASSIFY_SCRIPT_PATH=/app/scripts/classify.py

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

EXPOSE 3000

CMD ["node", "dist-sse/server-sse.mjs"]
