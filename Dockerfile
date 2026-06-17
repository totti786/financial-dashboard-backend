FROM node:20-alpine AS builder
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
RUN apk add --no-cache curl python3 make g++
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
RUN apk del python3 make g++
COPY --from=builder /app/dist ./dist
RUN mkdir -p /data
ENV DATABASE_PATH=/data/sandouk.db
ENV PORT=5000
ENV NODE_ENV=production
EXPOSE 5000
CMD ["node", "dist/index.js"]
