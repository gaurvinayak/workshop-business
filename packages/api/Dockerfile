# Multi-stage build for the API (also runs as the worker in later phases).
FROM node:20-slim AS base
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS build
COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY packages/api/package.json packages/api/
RUN npm install
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY packages/api packages/api
RUN npm run build --workspace @workshopos/shared \
 && npm run db:generate --workspace @workshopos/api \
 && npm run build --workspace @workshopos/api

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/packages/api/dist ./packages/api/dist
COPY --from=build /app/packages/api/package.json ./packages/api/package.json
COPY --from=build /app/packages/api/prisma ./packages/api/prisma
WORKDIR /app/packages/api
EXPOSE 3000
# Run pending migrations then start the API.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
