import org.gradle.api.artifacts.VersionCatalog
import org.gradle.api.artifacts.VersionCatalogsExtension
import org.gradle.api.tasks.testing.logging.TestExceptionFormat

plugins {
    kotlin("jvm")
    kotlin("plugin.serialization")
    id("io.gitlab.arturbosch.detekt")
    id("org.jetbrains.kotlinx.kover")
}

repositories {
    mavenCentral()
}

private fun catalog(): VersionCatalog = project.extensions.getByType<VersionCatalogsExtension>().named("libs")
private fun lib(alias: String) = catalog().findLibrary(alias).get()
private fun version(alias: String) = catalog().findVersion(alias).get().requiredVersion

dependencies {
    // Force the patched jackson artifacts wherever jackson is resolved. It is
    // pulled transitively (logstash-logback-encoder, liquibase) at 2.17.2, which
    // Trivy fails on for CVE-2026-54512 / CVE-2026-54513. A constraint (not a
    // platform) bumps only modules that already depend on jackson, leaving
    // jackson-free modules untouched. Remove once the transitive versions ship
    // the fix on their own.
    val jacksonVersion = version("jackson")
    constraints {
        listOf(
            "com.fasterxml.jackson.core:jackson-databind",
            "com.fasterxml.jackson.core:jackson-core",
            "com.fasterxml.jackson.core:jackson-annotations",
        ).forEach { coord ->
            "implementation"("$coord:$jacksonVersion") {
                because("CVE-2026-54512 / CVE-2026-54513 in jackson-databind < 2.18.8")
            }
        }
    }
    "testImplementation"(lib("kotlin-test-junit5"))
}

kotlin {
    jvmToolchain(21)
    compilerOptions {
        optIn.add("kotlin.uuid.ExperimentalUuidApi")
    }
}

testing {
    suites {
        @Suppress("UnstableApiUsage")
        val test by getting(JvmTestSuite::class) {
            useJUnitJupiter()
        }
    }
}

tasks.withType<Test> {
    jvmArgs("-Djdk.attach.allowAttachSelf=true", "-XX:+EnableDynamicAgentLoading")
    testLogging {
        events("passed", "skipped", "failed")
        showStandardStreams = true
        exceptionFormat = TestExceptionFormat.FULL
    }
}

dependencyLocking {
    // Lock all configurations so Trivy's gradle-lockfile analyzer finds every
    // resolved dependency in gradle.lockfile. After any version change in
    // libs.versions.toml, regenerate with:
    //   ./gradlew --project-dir <module> dependencies --write-locks
    lockAllConfigurations()
}

detekt {
    buildUponDefaultConfig = true
    allRules = false
    config.setFrom(files("${project.rootDir}/config/detekt/detekt.yml"))
    baseline = file("${project.rootDir}/config/detekt/baseline.xml")
    source.setFrom(files("src/main/kotlin"))
}

tasks.named<io.gitlab.arturbosch.detekt.Detekt>("detektMain") {
    source = objects.fileCollection().from("src/main/kotlin").asFileTree
}

tasks.withType<io.gitlab.arturbosch.detekt.Detekt>().configureEach {
    reports {
        html.required.set(true)
        xml.required.set(true)
        sarif.required.set(true)
    }
}

