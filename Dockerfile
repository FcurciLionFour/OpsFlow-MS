FROM node:22-bookworm-slim AS base
WORKDIR /app

FROM base AS deps
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate

FROM deps AS builder
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY prisma ./prisma
RUN npx prisma generate

COPY --from=builder /app/dist ./dist
COPY docker/entrypoint.sh ./docker/entrypoint.sh

RUN useradd --uid 10001 --create-home appuser \
  && chmod +x ./docker/entrypoint.sh \
  && chown -R appuser:appuser /app

USER appuser
EXPOSE 3000

ENTRYPOINT ["./docker/entrypoint.sh"]
