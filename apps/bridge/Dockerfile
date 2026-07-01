# Bridge worker image. Build context = repo root:
#   docker build -f apps/bridge/Dockerfile -t blaze-ignite-bridge .
FROM node:20-slim AS build
WORKDIR /app
# Prisma needs OpenSSL present.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Install workspace deps (postinstall runs `prisma generate`).
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY apps/bridge/package.json apps/bridge/
COPY apps/web/package.json apps/web/
RUN npm ci

# Build the shared package + bridge.
COPY . .
RUN npm run build --workspace packages/shared \
 && npm run db:generate \
 && npm run build --workspace apps/bridge

ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "apps/bridge/dist/main.js"]
