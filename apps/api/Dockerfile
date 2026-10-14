# ==============================================================================
# AssetVault: Production API Dockerfile (Multi-Stage Node.js 20 Alpine)
# Targets minimal footprint, non-root security, and automated Prisma migrations
# ==============================================================================

# Stage 1: Dependencies Resolution
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat

COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY apps/web/package*.json ./apps/web/
COPY apps/api/prisma ./apps/api/prisma/

RUN npm ci --workspace=@assetvault/api

# Stage 2: Compilation & Prisma Generation
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY package*.json ./
COPY apps/api ./apps/api

WORKDIR /app/apps/api
RUN npx prisma generate
RUN node ../../node_modules/typescript/bin/tsc -p tsconfig.json

# Stage 3: Production Runtime (Non-root user, slim footprint)
FROM node:20-alpine AS runner
WORKDIR /app/apps/api

ENV NODE_ENV=production
ENV PORT=5000

# Install runtime utilities (curl/wget for healthcheck)
RUN apk add --no-cache curl wget libc6-compat

# Create node workspace layout
COPY package*.json /app/
COPY apps/api/package*.json ./
COPY apps/web/package*.json /app/apps/web/
COPY apps/api/prisma ./prisma
COPY apps/api/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

# Install production-only dependencies
WORKDIR /app
RUN npm ci --workspace=@assetvault/api --omit=dev && npm cache clean --force

WORKDIR /app/apps/api
# Copy built artifacts from builder
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/apps/api/node_modules/@prisma ./node_modules/@prisma

# Security: Non-root execution
RUN chmod +x /usr/local/bin/docker-entrypoint.sh && \
    chown -R node:node /app

USER node

EXPOSE 5000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:5000/api/health || exit 1

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "dist/server.js"]
