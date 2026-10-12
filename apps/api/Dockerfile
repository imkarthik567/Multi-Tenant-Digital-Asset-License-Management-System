# ==============================================================================
# AssetVault API Dockerfile (Node.js 20 Alpine)
# ==============================================================================

FROM node:20-alpine AS builder

WORKDIR /app

# Copy root and workspace manifests
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY apps/api/prisma ./apps/api/prisma/

# Install dependencies
RUN npm ci --workspace=@assetvault/api

# Copy API source code
COPY apps/api ./apps/api

# Generate Prisma Client and compile TypeScript
WORKDIR /app/apps/api
RUN npx prisma generate
RUN npm run build

# Production Runner
FROM node:20-alpine AS runner

WORKDIR /app/apps/api

ENV NODE_ENV=production
ENV PORT=5000

# Copy runtime assets from builder
COPY --from=builder /app/package*.json /app/
COPY --from=builder /app/apps/api/package*.json ./
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/apps/api/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/prisma ./prisma

EXPOSE 5000

CMD ["node", "dist/server.js"]
