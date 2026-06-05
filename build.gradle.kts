plugins {
    id("org.asciidoctor.jvm.convert") version "4.0.5"
}

repositories {
    mavenCentral()
}

// -- Service list --------------------------------------------------------------
// Add each backend service name here when creating it. kbeatz-common is a
// shared library and is included automatically via dependency substitution.
val libraryBuilds = listOf(
    "kbeatz-common",
    "kbeatz-flac",
)

val serviceBuilds = listOf(
    "kbeatz-catalog",
    "kbeatz-metadata-discogs",
    "kbeatz-tagger",
)

// -- Frontend (kbeatz-ui npm) --------------------------------------------------
val buildFrontend by tasks.registering(Exec::class) {
    group = "build"
    description = "Builds the kbeatz-ui React frontend (npm ci + npm run build)."
    workingDir(layout.projectDirectory.dir("kbeatz-ui"))
    commandLine("bash", "-c", "npm ci --silent && npm run build")
}

// -- Backend aggregate (no frontend) ------------------------------------------
val allModuleBuilds = libraryBuilds + serviceBuilds

val buildBackends by tasks.registering {
    group = "build"
    description = "Builds all libraries and service backends via Gradle (no frontend)."
    dependsOn(allModuleBuilds.map { gradle.includedBuild(it).task(":build") })
}

// -- Compile-only (CodeQL / fast feedback) ------------------------------------
val compileBackends by tasks.registering {
    group = "build"
    description = "Compiles all backends without running tests."
    dependsOn(allModuleBuilds.map { gradle.includedBuild(it).task(":classes") })
}

// -- Full build ----------------------------------------------------------------
tasks.named("build") {
    dependsOn(buildBackends, buildFrontend)
}

// -- Full check ----------------------------------------------------------------
tasks.named("check") {
    dependsOn(allModuleBuilds.map { gradle.includedBuild(it).task(":check") })
}

// -- Clean ---------------------------------------------------------------------
val cleanFrontend by tasks.registering(Exec::class) {
    group = "build"
    workingDir(layout.projectDirectory.dir("kbeatz-ui"))
    commandLine("bash", "-c", "rm -rf dist node_modules/.vite")
}

tasks.named("clean") {
    dependsOn(allModuleBuilds.map { gradle.includedBuild(it).task(":clean") })
    dependsOn(cleanFrontend)
}

// -- AsciiDoc docs -------------------------------------------------------------
tasks.named<org.asciidoctor.gradle.jvm.AsciidoctorTask>("asciidoctor") {
    sourceDir(file("docs"))
    setOutputDir(file("build/docs/asciidoc"))
    attributes(mapOf("project-version" to (project.findProperty("version") ?: "dev")))
}
