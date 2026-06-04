plugins {
    id("org.asciidoctor.jvm.convert") version "4.0.5"
}

repositories {
    mavenCentral()
}

// -- Service list --------------------------------------------------------------
// Add each backend service name here when creating it. kbeatz-common is a
// shared library and is included automatically via dependency substitution.
val serviceBuilds = listOf(
    "kbeatz-service",
    // "kbeatz-<next-service>",
)

// -- Frontend (kbeatz-ui npm) --------------------------------------------------
val buildFrontend by tasks.registering(Exec::class) {
    group = "build"
    description = "Builds the kbeatz-ui React frontend (npm ci + npm run build)."
    workingDir(layout.projectDirectory.dir("kbeatz-ui"))
    commandLine("bash", "-c", "npm ci --silent && npm run build")
}

// -- Backend aggregate (no frontend) ------------------------------------------
val buildBackends by tasks.registering {
    group = "build"
    description = "Builds all service backends via Gradle (no frontend)."
    dependsOn(serviceBuilds.map { gradle.includedBuild(it).task(":build") })
}

// -- Compile-only (CodeQL / fast feedback) ------------------------------------
val compileBackends by tasks.registering {
    group = "build"
    description = "Compiles all service backends without running tests."
    dependsOn(serviceBuilds.map { gradle.includedBuild(it).task(":classes") })
}

// -- Full build ----------------------------------------------------------------
tasks.named("build") {
    dependsOn(buildBackends, buildFrontend)
}

// -- Full check ----------------------------------------------------------------
tasks.named("check") {
    dependsOn(serviceBuilds.map { gradle.includedBuild(it).task(":check") })
}

// -- Clean ---------------------------------------------------------------------
val cleanFrontend by tasks.registering(Exec::class) {
    group = "build"
    workingDir(layout.projectDirectory.dir("kbeatz-ui"))
    commandLine("bash", "-c", "rm -rf dist node_modules/.vite")
}

tasks.named("clean") {
    dependsOn(serviceBuilds.map { gradle.includedBuild(it).task(":clean") })
    dependsOn(cleanFrontend)
}

// -- AsciiDoc docs -------------------------------------------------------------
tasks.named<org.asciidoctor.gradle.jvm.AsciidoctorTask>("asciidoctor") {
    sourceDir(file("docs"))
    setOutputDir(file("build/docs/asciidoc"))
    attributes(mapOf("project-version" to (project.findProperty("version") ?: "dev")))
}
