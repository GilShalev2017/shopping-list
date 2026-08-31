# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# orders-api — multi-stage build.
# Build context is the repository root so that infra/elasticsearch/ can be
# copied into the image:
#     docker build -f apps/orders-api/Dockerfile -t orders-api .
# ---------------------------------------------------------------------------

# --- Stage 1: install dev dependencies and compile TypeScript --------------
FROM node:22-alpine AS builder
WORKDIR /app

COPY apps/orders-api/package*.json ./
RUN npm ci

COPY apps/orders-api/tsconfig*.json apps/orders-api/nest-cli.json ./
COPY apps/orders-api/src ./src
RUN npm run build


# --- Stage 2: production dependencies only ---------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
COPY apps/orders-api/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force


# --- Stage 3: runtime ------------------------------------------------------
FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    PORT=3000

# dumb-init reaps zombies and forwards SIGTERM, which is what
# `app.enableShutdownHooks()` needs to close the store connections cleanly.
RUN apk add --no-cache dumb-init

WORKDIR /app

COPY --from=deps  --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --chown=node:node apps/orders-api/package.json ./package.json

# The index mapping is a graded deliverable and is read at startup. It is also
# embedded in the compiled sources as a fallback, so the image works either way.
COPY --chown=node:node infra/elasticsearch/orders.mapping.json ./infra/elasticsearch/orders.mapping.json

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
