# ==============================================================================
# CivicPulse AI — Backend Production Dockerfile (Google Cloud Run)
# Multi-stage build for monorepo structure
# ==============================================================================

# Stage 1: Build dependencies and compiled TypeScript
FROM node:22-alpine AS builder

WORKDIR /app

# Copy root workspace manifests
COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/

# Install dependencies for all workspaces
RUN npm ci

# Copy shared and backend source code
COPY shared/ ./shared/
COPY backend/ ./backend/
COPY data/ ./data/

# Build shared types/schemas first, then backend
RUN npm run build:shared
RUN npm run build:backend

# Prune devDependencies for production runtime
RUN npm prune --production

# Stage 2: Minimal production runtime image
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Security: Run as non-root user
USER node

# Copy built artifacts and production dependencies
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/package.json ./package.json
COPY --chown=node:node --from=builder /app/shared/package.json ./shared/package.json
COPY --chown=node:node --from=builder /app/shared/dist ./shared/dist
COPY --chown=node:node --from=builder /app/backend/package.json ./backend/package.json
COPY --chown=node:node --from=builder /app/backend/dist ./backend/dist
COPY --chown=node:node --from=builder /app/data ./data

EXPOSE 8080

WORKDIR /app/backend
CMD ["node", "dist/index.js"]
