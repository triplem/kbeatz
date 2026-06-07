# Build stage
# Pinned 2026-06-07. Update digest with:
#   docker pull node:22-alpine
#   docker inspect node:22-alpine --format='{{index .RepoDigests 0}}'
FROM node:22-alpine@sha256:968df39aedcea65eeb078fb336ed7191baf48f972b4479711397108be0966920 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --silent
COPY . .
RUN npm run build

# Runtime stage
# Pinned 2026-06-07. Update digest with:
#   docker pull nginx:alpine
#   docker inspect nginx:alpine --format='{{index .RepoDigests 0}}'
FROM nginx:alpine@sha256:8b1e78743a03dbb2c95171cc58639fef29abc8816598e27fb910ed2e621e589a
RUN addgroup --system app && adduser --system --ingroup app app
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
