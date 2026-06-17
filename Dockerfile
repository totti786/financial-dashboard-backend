FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache curl
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
RUN mkdir -p /data
ENV DATABASE_PATH=/data/sandouk.db
ENV PORT=5000
ENV NODE_ENV=production
EXPOSE 5000
CMD ["node", "dist/index.js"]
