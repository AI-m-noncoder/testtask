# Build context: repository root (npm workspaces share one lockfile)
FROM node:24-alpine
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
RUN npm ci -w api --include-workspace-root=false

COPY apps/api apps/api
RUN npm run prisma:generate -w api && npm run build -w api

WORKDIR /app/apps/api
EXPOSE 3000
# Applies pending migrations and seeds demo data (seed is idempotent) before start
CMD ["npm", "run", "start:docker"]
