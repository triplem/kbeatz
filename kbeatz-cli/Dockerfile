# Build stage
# Pinned 2026-06-07. Update digest with:
#   docker pull eclipse-temurin:21-jdk
#   docker inspect eclipse-temurin:21-jdk --format='{{index .RepoDigests 0}}'
FROM eclipse-temurin:25-jdk@sha256:c2b7ea21649875fb9052237ac4e3cd4ef63968a2a389a0a1b1a72a5e53e5c93f AS build
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
# Pinned 2026-06-07. Update digest with:
#   docker pull eclipse-temurin:21-jre
#   docker inspect eclipse-temurin:21-jre --format='{{index .RepoDigests 0}}'
FROM eclipse-temurin:25-jre@sha256:04262e8782d6b034ee5d7c1c5d4e8938fcf2063a76b4bfcd84e5d994d09c27bc
RUN groupadd --system app && useradd --system --gid app app
WORKDIR /app
COPY --from=build /workspace/kbeatz-cli/build/libs/kbeatz-cli-all.jar ./kbeatz-cli-all.jar
USER app
ENTRYPOINT ["java", "-jar", "/app/kbeatz-cli-all.jar"]
CMD ["--help"]
