# deps -> build -> runner
FROM node:24-alpine AS deps
WORKDIR /repo/backend
COPY backend/package.json backend/package-lock.json ./
COPY packages/shared /repo/packages/shared
RUN npm ci

FROM node:24-alpine AS build
WORKDIR /repo/backend
COPY --from=deps /repo/backend/node_modules ./node_modules
COPY --from=deps /repo/packages /repo/packages
COPY backend/ .
# The type check and lint gate the build: any error fails `docker compose up --build`.
RUN npm run typecheck && npm run lint && npm run build

FROM node:24-alpine AS prod-deps
WORKDIR /repo/backend
COPY backend/package.json backend/package-lock.json ./
COPY packages/shared /repo/packages/shared
RUN npm ci --omit=dev

FROM node:24-alpine AS runner
WORKDIR /repo/backend
ENV NODE_ENV=production TZ=Asia/Dhaka
RUN apk add --no-cache tzdata && mkdir -p /app/uploads && addgroup -S app && adduser -S app -G app && chown -R app:app /app
COPY --from=prod-deps --chown=app:app /repo/backend/node_modules ./node_modules
COPY --from=prod-deps --chown=app:app /repo/packages /repo/packages
COPY --from=build --chown=app:app /repo/backend/dist ./dist
COPY --chown=app:app backend/package.json ./
USER app
EXPOSE 4000
CMD ["node", "dist/server.js"]
