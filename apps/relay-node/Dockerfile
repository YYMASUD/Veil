# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@12.21.0 --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/core/package.json packages/core/package.json
COPY apps/relay-node/package.json apps/relay-node/package.json
RUN pnpm install --frozen-lockfile --filter @veil/relay-node... --ignore-scripts
RUN pnpm rebuild -r esbuild || true
COPY . .

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S veil && adduser -S veil -G veil
# tsx is used as the TS runtime (Node ESM + workspace .ts imports).
COPY --from=build --chown=veil:veil /app/node_modules ./node_modules
COPY --from=build --chown=veil:veil /app/apps/relay-node/node_modules ./apps/relay-node/node_modules
COPY --from=build --chown=veil:veil /app/apps/relay-node/src ./apps/relay-node/src
COPY --from=build --chown=veil:veil /app/apps/relay-node/package.json ./apps/relay-node/package.json
COPY --from=build --chown=veil:veil /app/packages/core ./packages/core
COPY --from=build --chown=veil:veil /app/package.json /app/pnpm-workspace.yaml /app/tsconfig.base.json ./
USER veil
WORKDIR /app/apps/relay-node
EXPOSE 4001/tcp 4002/tcp 8080/tcp
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npx", "tsx", "src/server.ts"]

