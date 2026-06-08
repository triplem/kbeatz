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
    "kbeatz-sources",
    "kbeatz-tagger",
)

val serviceBuilds = listOf(
    "kbeatz-catalog",
    "kbeatz-cli",
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
// AsciidoctorJ 4.x is not compatible with the Gradle configuration cache:
// its AsciidoctorJExtension holds a DefaultDependencyScopeConfiguration that
// cannot be serialized. Mark the task explicitly so Gradle degrades gracefully
// instead of failing the cache-write step.
tasks.withType<org.asciidoctor.gradle.jvm.AsciidoctorTask>().configureEach {
    notCompatibleWithConfigurationCache("AsciidoctorJ Gradle plugin does not support the configuration cache")
}

tasks.named<org.asciidoctor.gradle.jvm.AsciidoctorTask>("asciidoctor") {
    sourceDir(file("docs"))
    setOutputDir(file("build/docs/asciidoc"))
    val resolvedVersion = (project.findProperty("project-version") as String?
        ?: project.findProperty("version") as String?
        ?: "dev")
    attributes(mapOf(
        // {project-version} can be referenced in AsciiDoc source
        "project-version" to resolvedVersion,
        // revnumber is the standard AsciiDoc revision attribute displayed in the doc header and footer
        "revnumber" to resolvedVersion,
        // revdate is the build date; shown in the footer via docinfo-footer.html
        "revdate" to java.time.LocalDate.now().toString(),
        // shared docinfo: Asciidoctor reads docs/docinfo-footer.html and injects it before </body>
        "docinfo" to "shared",
        // explicit docinfo directory so the Gradle plugin resolves files against docs/ not the project root
        "docinfodir" to file("docs").absolutePath,
    ))
}
