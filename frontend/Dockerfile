# ==============================================================================
# CivicPulse AI — Frontend Production Dockerfile (Next.js Standalone on Cloud Run)
# Multi-stage build leveraging Next.js output: 'standalone'
# ==============================================================================

# Stage 1: Build dependencies and standalone Next.js bundle
FROM node:22-alpine AS builder

WORKDIR /app

# Copy root workspace manifests
COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/package.json ./shared/
COPY frontend/package.json ./frontend/

# Install dependencies for all workspaces
RUN npm ci

# Copy shared and frontend source code
COPY shared/ ./shared/
COPY frontend/ ./frontend/

# Build shared types/schemas first
RUN npm run build:shared

# Build-time environment variables for Next.js public client inlining
ARG NEXT_PUBLIC_DEMO_MODE=false
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ARG NEXT_PUBLIC_FIREBASE_APP_ID

ENV NEXT_PUBLIC_DEMO_MODE=$NEXT_PUBLIC_DEMO_MODE
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY
ENV NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ENV NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID
ENV NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ENV NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID

# Build frontend standalone application
RUN npm run build:frontend

# Stage 2: Minimal production runtime image
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME="0.0.0.0"

USER node

# Copy standalone output and static assets
COPY --chown=node:node --from=builder /app/frontend/.next/standalone ./
COPY --chown=node:node --from=builder /app/frontend/.next/static ./frontend/.next/static

EXPOSE 8080

WORKDIR /app/frontend
CMD ["node", "server.js"]
