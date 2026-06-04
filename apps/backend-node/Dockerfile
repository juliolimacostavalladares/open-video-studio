# Stage 1: Prune monorepo
FROM node:20-bullseye-slim AS pruner
WORKDIR /app
RUN npm install -g turbo
COPY . .
RUN turbo prune --scope=backend-node --docker

# Stage 2: Install dependencies
FROM node:20-bullseye-slim AS installer
WORKDIR /app
RUN npm install -g pnpm@10.32.1
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pruner /app/out/pnpm-workspace.yaml ./pnpm-workspace.yaml
RUN pnpm install --frozen-lockfile

# Stage 3: Build the project
FROM node:20-bullseye-slim AS builder
WORKDIR /app
RUN npm install -g pnpm@10.32.1
COPY --from=installer /app/ .
COPY --from=pruner /app/out/full/ .
COPY --from=pruner /app/out/pnpm-workspace.yaml ./pnpm-workspace.yaml

# Generate Prisma Client and compile typescript
RUN pnpm --filter @repo/database build
RUN pnpm --filter backend-node build

# Stage 4: Production runner
FROM node:20-bullseye-slim AS runner
WORKDIR /app

# Install system dependencies for Chrome headless (Puppeteer/Remotion)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libxshmfence1 \
    libxss1 \
    fonts-liberation \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

# Install pnpm
RUN npm install -g pnpm@10.32.1

# Copy built workspace and node_modules
COPY --from=builder /app/ .

# Expose backend port (Zod env PORT defaults to 4000)
EXPOSE 4000

# Run the backend service via pnpm filter
CMD ["pnpm", "--filter", "backend-node", "start"]
