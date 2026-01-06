# syntax=docker/dockerfile:1

FROM node:20-slim AS base
WORKDIR /app
ENV NODE_ENV=production

FROM base AS deps
RUN corepack enable && corepack prepare pnpm@10 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

FROM base AS build
RUN corepack enable && corepack prepare pnpm@10 --activate
COPY package.json pnpm-lock.yaml tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM base AS runtime
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json config.example.yaml ./

EXPOSE 18081

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:18081/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

USER node
ENTRYPOINT ["node", "dist/cli.js"]
CMD ["--config", "/app/config.example.yaml"]
