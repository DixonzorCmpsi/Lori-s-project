# Stage 1: Build the React app
FROM node:20-alpine AS build
WORKDIR /app

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci

COPY frontend/ .

# Optional: pick up .env.production if present (local/manual builds). The
# bracket glob makes this a no-op when the file doesn't exist (e.g. CI),
# instead of failing the build.
COPY .env.productio[n] .env.production

# CI/CD (Cloud Run) passes build-time config as build args instead of a file.
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID

RUN npx vite build

# Stage 2: Serve with nginx
FROM nginx:alpine

# Copy built assets
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx config
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
