# deps -> build -> runner
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# The type check and lint gate the build: any error fails `docker compose up --build`.
RUN npm run typecheck && npm run lint && npm run build

FROM node:24-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production TZ=Asia/Dhaka
RUN apk add --no-cache tzdata && mkdir -p /app/uploads && addgroup -S app && adduser -S app -G app && chown -R app:app /app
COPY --from=prod-deps --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/dist ./dist
COPY --chown=app:app package.json ./
USER app
EXPOSE 4000
CMD ["node", "dist/server.js"]
