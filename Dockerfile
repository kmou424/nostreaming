# Use Bun official Docker image as base
# Reference: https://hub.docker.com/r/oven/bun
FROM oven/bun:1 AS base

# Set working directory
WORKDIR /app

# Install dependencies stage
FROM base AS deps
# Copy package files
COPY package.json bun.lock* ./
# Install all dependencies (including devDependencies for TypeScript)
RUN bun install --frozen-lockfile

# Build stage (optional, for compiled output if needed)
FROM deps AS build
# Install git temporarily to get revision
RUN apt-get update && apt-get install -y --no-install-recommends git && \
    rm -rf /var/lib/apt/lists/*
# Copy source code (including .git for revision detection in build stage)
COPY . .
# Get Git revision and write to VERSION file for runtime use
# This allows the app to know its version even without .git directory in final image
RUN git rev-parse --short HEAD > VERSION 2>/dev/null || echo "unknown" > VERSION
# Build is optional since we're running with bun directly
# RUN bun run build || true

# Production stage
FROM base AS release

# Install curl for health checks
RUN apt-get update && apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN groupadd -r appuser && useradd -r -g appuser appuser

WORKDIR /app

# Copy package files
COPY --chown=appuser:appuser package.json bun.lock* ./

# Install only production dependencies
RUN bun install --frozen-lockfile --production

# Copy application source
COPY --chown=appuser:appuser src ./src
COPY --chown=appuser:appuser tsconfig.json ./
# Copy VERSION file from build stage
COPY --from=build --chown=appuser:appuser /app/VERSION ./VERSION

# Copy config example (user should mount their own config.toml at runtime)
COPY --chown=appuser:appuser config.toml.example ./config.toml.example

# Switch to non-root user
USER appuser

# Expose port (default 3000, can be overridden via config)
EXPOSE 3000

# Health check - check if the service is responding
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Run the application
# Note: config.toml should be mounted as a volume or provided at runtime
# Example: docker run -v $(pwd)/config.toml:/app/config.toml:ro ...
CMD ["bun", "run", "src/index.ts"]

