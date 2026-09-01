# syntax=docker/dockerfile:1
# Build context: apps/client

# ---------- build ----------
FROM node:22-alpine AS build
WORKDIR /app

# Copy manifests first so `npm ci` is cached until dependencies actually change.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# The API base urls are baked into the bundle at build time (Vite inlines
# import.meta.env), so they are build args rather than runtime env vars.
ARG VITE_CATALOG_API_URL=http://localhost:5080
ARG VITE_ORDERS_API_URL=http://localhost:3000
ARG VITE_DEFAULT_LOCALE=he
ENV VITE_CATALOG_API_URL=$VITE_CATALOG_API_URL \
    VITE_ORDERS_API_URL=$VITE_ORDERS_API_URL \
    VITE_DEFAULT_LOCALE=$VITE_DEFAULT_LOCALE

RUN npm run build

# ---------- runtime ----------
FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

# 127.0.0.1 rather than "localhost": busybox wget resolves localhost to ::1
# first inside the container, so a hostname here makes the check depend on
# whether nginx happens to have an IPv6 listener. Addressing the loopback
# literally removes the ambiguity, and the page must actually contain the
# React mount point rather than merely return 200.
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=5 \
  CMD wget -qO- http://127.0.0.1/ 2>/dev/null | grep -q 'id="root"' || exit 1

CMD ["nginx", "-g", "daemon off;"]
