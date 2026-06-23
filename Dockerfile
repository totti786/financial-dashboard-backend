FROM node:20-alpine AS builder
RUN apk add --no-cache python3 make g++
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache curl
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && corepack prepare pnpm@9 --activate && pnpm install --frozen-lockfile --prod --ignore-scripts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/node_modules/better-sqlite3/build ./node_modules/better-sqlite3/build
RUN mkdir -p /data
ENV DATABASE_PATH=/data/sandouk.db
ENV PORT=5000
ENV NODE_ENV=production
EXPOSE 5000
CMD ["node", "dist/index.js"]
