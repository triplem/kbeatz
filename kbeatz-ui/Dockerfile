# Build stage
# Pin to digest for supply-chain safety. Update digest with:
#   docker pull node:22-alpine && docker inspect node:22-alpine --format='{{index .RepoDigests 0}}'
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --silent
COPY . .
RUN npm run build

# Runtime stage
# Pin to digest for supply-chain safety. Update digest with:
#   docker pull nginx:alpine && docker inspect nginx:alpine --format='{{index .RepoDigests 0}}'
FROM nginx:alpine
RUN addgroup --system app && adduser --system --ingroup app app
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
