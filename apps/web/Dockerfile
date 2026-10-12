# ==============================================================================
# AssetVault Web Dockerfile (React + Vite + Nginx)
# ==============================================================================

FROM node:20-alpine AS builder

WORKDIR /app

# Copy root and workspace manifests
COPY package*.json ./
COPY apps/web/package*.json ./apps/web/

# Install dependencies
RUN npm ci --workspace=@assetvault/web

# Copy web source code
COPY apps/web ./apps/web

# Compile React TypeScript bundle
WORKDIR /app/apps/web
RUN npm run build

# Production Nginx Server
FROM nginx:alpine AS runner

COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# Nginx Single Page Application configuration
RUN echo 'server { \
    listen 80; \
    server_name localhost; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
