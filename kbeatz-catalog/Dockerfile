# Build stage
# Pinned 2026-06-10. Update digest with:
#   docker pull eclipse-temurin:21-jdk
#   docker inspect eclipse-temurin:21-jdk --format='{{index .RepoDigests 0}}'
FROM eclipse-temurin:21-jdk@sha256:762d16be48b976c97801d198e5085b1f6facb13718a1e8fb67cb25d0b25337e1 AS build
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
FROM eclipse-temurin:21-jre@sha256:8ec353b20d3aab0758572236b81b967c7077c40c4d0819ce97f9a1329d684603
RUN groupadd --system app && useradd --system --gid app app
WORKDIR /app
COPY --from=build /workspace/kbeatz-catalog/build/install/kbeatz-catalog ./
USER app
EXPOSE 8080
ENTRYPOINT ["bin/kbeatz-catalog"]
