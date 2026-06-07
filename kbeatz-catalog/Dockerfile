# Build stage
# Pinned 2026-06-07. Update digest with:
#   docker pull eclipse-temurin:21-jdk
#   docker inspect eclipse-temurin:21-jdk --format='{{index .RepoDigests 0}}'
FROM eclipse-temurin:21-jdk@sha256:b9142586f9712700c6c9e07adcedfb18608b1a3a056e4001423a3354adfa9d80 AS build
WORKDIR /workspace

COPY gradle gradle
COPY gradlew gradlew.bat gradle.properties settings.gradle.kts build.gradle.kts ./
COPY build-logic build-logic
COPY kbeatz-common kbeatz-common
COPY kbeatz-sources kbeatz-sources
COPY kbeatz-tagger kbeatz-tagger
COPY kbeatz-catalog kbeatz-catalog

RUN ./gradlew :kbeatz-catalog:installDist --no-daemon -q

# Runtime stage
# Pinned 2026-06-07. Update digest with:
#   docker pull eclipse-temurin:21-jre
#   docker inspect eclipse-temurin:21-jre --format='{{index .RepoDigests 0}}'
FROM eclipse-temurin:21-jre@sha256:010e0a06bd4e0184dec58626afb3ba727b42c56c91b977e2f0a9e0837e0fa3fb
RUN groupadd --system app && useradd --system --gid app app
WORKDIR /app
COPY --from=build /workspace/kbeatz-catalog/build/install/kbeatz-catalog ./
USER app
EXPOSE 8080
ENTRYPOINT ["bin/kbeatz-catalog"]
