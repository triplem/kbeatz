# Build stage
FROM eclipse-temurin:21-jdk AS build
WORKDIR /workspace

COPY gradle gradle
COPY gradlew gradlew.bat gradle.properties settings.gradle.kts build.gradle.kts ./
COPY build-logic build-logic
COPY kbeatz-common kbeatz-common
COPY kbeatz-sources kbeatz-sources
COPY kbeatz-tagger kbeatz-tagger
COPY kbeatz-cli kbeatz-cli

RUN ./gradlew :kbeatz-cli:shadowJar --no-daemon -q

# Runtime stage
FROM eclipse-temurin:21-jre
RUN groupadd --system app && useradd --system --gid app app
WORKDIR /app
COPY --from=build /workspace/kbeatz-cli/build/libs/kbeatz-cli-all.jar ./kbeatz-cli-all.jar
USER app
ENTRYPOINT ["java", "-jar", "/app/kbeatz-cli-all.jar"]
CMD ["--help"]
