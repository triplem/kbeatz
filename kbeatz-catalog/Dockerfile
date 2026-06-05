# Build stage
FROM eclipse-temurin:21-jdk AS build
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
FROM eclipse-temurin:21-jre
RUN groupadd --system app && useradd --system --gid app app
WORKDIR /app
COPY --from=build /workspace/kbeatz-catalog/build/install/kbeatz-catalog ./
USER app
EXPOSE 8080
ENTRYPOINT ["bin/kbeatz-catalog"]
