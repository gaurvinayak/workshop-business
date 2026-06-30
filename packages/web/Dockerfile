# Build the SPA and serve it as static files via nginx.
FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY packages/web/package.json packages/web/
RUN npm install
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY packages/web packages/web
ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build --workspace @workshopos/shared \
 && npm run build --workspace @workshopos/web

FROM nginx:1.27-alpine AS runtime
COPY packages/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/packages/web/dist /usr/share/nginx/html
EXPOSE 80
