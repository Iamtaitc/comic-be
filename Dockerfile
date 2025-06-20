# Multi-stage build để tối ưu image size
FROM node:18-alpine AS base
WORKDIR /usr/src/app

# Install system dependencies và tools cần thiết
RUN apk add --no-cache \
    wget \
    curl \
    dumb-init \
    && rm -rf /var/cache/apk/*

# Copy package files
COPY package*.json ./

# Stage 1: Install dependencies
FROM base AS deps
# Install all dependencies (including devDependencies for build)
RUN npm ci --include=dev

# Stage 2: Build application (if you have build steps)
FROM deps AS build
COPY . .
# Add build steps here if needed
# RUN npm run build

# Stage 3: Production dependencies only
FROM base AS prod-deps
RUN npm install --omit=dev && npm cache clean --force

# Stage 4: Final production image
FROM base AS production

# Copy production dependencies
COPY --from=prod-deps /usr/src/app/node_modules ./node_modules

# Copy application source
COPY . .

# Create logs directory with proper permissions
RUN mkdir -p /usr/src/app/logs && \
    chown -R node:node /usr/src/app/logs

# Create uploads directory with proper permissions
RUN mkdir -p /usr/src/app/uploads && \
    chown -R node:node /usr/src/app/uploads

# Create non-root user nếu chưa có
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs || true

# Set ownership
RUN chown -R node:node /usr/src/app

# Switch to non-root user
USER node

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-3000}/health || exit 1

# Expose port
EXPOSE ${PORT:-3000}

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "servers.js"]