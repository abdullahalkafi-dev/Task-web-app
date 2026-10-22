# deps -> build -> runner
FROM node:24-alpine AS deps
WORKDIR /repo/frontend
COPY frontend/package.json frontend/package-lock.json ./
COPY packages/shared /repo/packages/shared
COPY packages/editor /repo/packages/editor
RUN cd /repo/packages/editor && npm ci --omit=dev
RUN npm ci

FROM node:24-alpine AS build
WORKDIR /repo/frontend
ARG BACKEND_URL=http://dayflow-api:4000
ENV BACKEND_URL=$BACKEND_URL NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /repo/frontend/node_modules ./node_modules
COPY --from=deps /repo/packages /repo/packages
COPY frontend/ .
# The type check and lint gate the build: any error fails `docker compose up --build`.
RUN npm run typecheck && npm run lint && npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production TZ=Asia/Dhaka NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
RUN apk add --no-cache tzdata && addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /repo/frontend/.next/standalone ./
COPY --from=build --chown=app:app /repo/frontend/.next/static ./frontend/.next/static
COPY --from=build --chown=app:app /repo/frontend/public ./frontend/public
USER app
EXPOSE 3000
CMD ["node", "frontend/server.js"]
