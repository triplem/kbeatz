# Build stage
# Pinned 2026-06-07. Update digest with:
#   docker pull node:22-alpine
#   docker inspect node:22-alpine --format='{{index .RepoDigests 0}}'
FROM node:26-alpine@sha256:144769ec3f32e8ee36b3cfde91e82bee25d9367b20f31a151f3f7eea3a2a8541 AS build
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
