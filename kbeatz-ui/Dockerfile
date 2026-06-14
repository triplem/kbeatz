# Build stage
# Pinned 2026-06-07. Update digest with:
#   docker pull node:26-alpine
#   docker inspect node:26-alpine --format='{{index .RepoDigests 0}}'
FROM node:26-alpine@sha256:3ad34ca6292aec4a91d8ddeb9229e29d9c2f689efd0dd242860889ac71842eba AS build
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
# Run as the built-in nginx user (uid 101).
# nginx:alpine starts the master as root so it can bind privileged ports; we
# avoid that by listening on 8080 (unprivileged) so the entire process tree
# can run as the nginx user without CAP_NET_BIND_SERVICE.
# Writable runtime dirs are chowned to nginx so pid/temp file writes succeed.
RUN chown -R nginx:nginx /var/cache/nginx /var/run /var/log/nginx \
    && touch /var/run/nginx.pid \
    && chown nginx:nginx /var/run/nginx.pid
COPY --chown=nginx:nginx --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
USER nginx
