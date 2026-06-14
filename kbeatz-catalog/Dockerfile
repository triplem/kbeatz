# Build stage
# Pinned 2026-06-10. Update digest with:
#   docker pull eclipse-temurin:21-jdk
#   docker inspect eclipse-temurin:21-jdk --format='{{index .RepoDigests 0}}'
FROM eclipse-temurin:25-jdk@sha256:edb3aa0f621796d8f5f9d602c7611ffdf015cd89e6ddda1894d85a3a99d170a8 AS build
WORKDIR /workspace

COPY gradle gradle
COPY gradlew gradlew.bat gradle.properties settings.gradle.kts build.gradle.kts ./
COPY build-logic build-logic
COPY kbeatz-common kbeatz-common
COPY kbeatz-sources kbeatz-sources
COPY kbeatz-tagger kbeatz-tagger
COPY kbeatz-cli kbeatz-cli
COPY kbeatz-catalog kbeatz-catalog

RUN ./gradlew :kbeatz-catalog:installDist --no-daemon -q

# Runtime stage
# Pinned 2026-06-10. Update digest with:
#   docker pull eclipse-temurin:21-jre
#   docker inspect eclipse-temurin:21-jre --format='{{index .RepoDigests 0}}'
FROM eclipse-temurin:25-jre@sha256:5cf92df78f6dba978777d5cffa3c856e583f86814fde82a6c3534ccdfd794f2f
RUN groupadd --system app && useradd --system --gid app app
WORKDIR /app
COPY --from=build /workspace/kbeatz-catalog/build/install/kbeatz-catalog ./
USER app
EXPOSE 8080
ENTRYPOINT ["bin/kbeatz-catalog"]
