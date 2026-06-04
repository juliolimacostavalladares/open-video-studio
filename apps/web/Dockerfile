# Stage 1: Prune monorepo
FROM node:20-alpine AS pruner
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN npm install -g turbo
COPY . .
RUN turbo prune --scope=web --docker

# Stage 2: Install dependencies
FROM node:20-alpine AS installer
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@10.32.1

# Copy pruned workspace configs & package.jsons
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pruner /app/out/pnpm-workspace.yaml ./pnpm-workspace.yaml

# Install dependencies
RUN pnpm install --frozen-lockfile

# Stage 3: Build the project
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@10.32.1

COPY --from=installer /app/ .
COPY --from=pruner /app/out/full/ .
COPY --from=pruner /app/out/pnpm-workspace.yaml ./pnpm-workspace.yaml

# Build Next.js app
RUN pnpm --filter web build

# Stage 4: Production runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Set correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Copy standalone build output
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Start server using the standalone runner
CMD ["node", "apps/web/server.js"]
