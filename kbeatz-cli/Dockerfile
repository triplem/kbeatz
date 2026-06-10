# Build stage
# Pinned 2026-06-10. Update digest with:
#   docker pull eclipse-temurin:21-jdk
#   docker inspect eclipse-temurin:21-jdk --format='{{index .RepoDigests 0}}'
FROM eclipse-temurin:21-jdk@sha256:949f7645022e8cd5cd65eac4b342e7505c86b721b6338f8b677c6f2edc180262 AS build
WORKDIR /workspace

COPY gradle gradle
COPY gradlew gradlew.bat gradle.properties settings.gradle.kts build.gradle.kts ./
COPY build-logic build-logic
COPY kbeatz-common kbeatz-common
COPY kbeatz-sources kbeatz-sources
COPY kbeatz-tagger kbeatz-tagger
COPY kbeatz-cli kbeatz-cli
COPY kbeatz-catalog kbeatz-catalog

RUN ./gradlew :kbeatz-cli:shadowJar --no-daemon -q

# Runtime stage
# Pinned 2026-06-10. Update digest with:
#   docker pull eclipse-temurin:21-jre
#   docker inspect eclipse-temurin:21-jre --format='{{index .RepoDigests 0}}'
FROM eclipse-temurin:21-jre@sha256:194b590649efee5555de080c634905a30c2885190210e37ada26370ed2a9c781
RUN groupadd --system app && useradd --system --gid app app
WORKDIR /app
COPY --from=build /workspace/kbeatz-cli/build/libs/kbeatz-cli-all.jar ./kbeatz-cli-all.jar
USER app
ENTRYPOINT ["java", "-jar", "/app/kbeatz-cli-all.jar"]
CMD ["--help"]
