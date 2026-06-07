import org.gradle.api.artifacts.VersionCatalog
import org.gradle.api.artifacts.VersionCatalogsExtension
import org.gradle.api.tasks.testing.logging.TestExceptionFormat

plugins {
    kotlin("jvm")
    kotlin("plugin.serialization")
    id("io.gitlab.arturbosch.detekt")
    id("org.jetbrains.kotlinx.kover")
    id("org.owasp.dependencycheck")
}

repositories {
    mavenCentral()
}

private fun catalog(): VersionCatalog = project.extensions.getByType<VersionCatalogsExtension>().named("libs")
private fun lib(alias: String) = catalog().findLibrary(alias).get()

dependencies {
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

dependencyCheck {
    // Fail build on HIGH (CVSS >= 7.0) and CRITICAL CVEs.
    failBuildOnCVSS = 7.0f
    // NVD API key speeds up database updates; set via NVD_API_KEY env var in CI.
    nvd.apiKey = System.getenv("NVD_API_KEY") ?: ""
    // Suppress known false positives. Add entries when a CVE is reviewed and accepted.
    suppressionFile = "${project.rootDir}/config/dependency-check/suppressions.xml"
    // Store NVD database in a stable Gradle cache path so CI can cache it across runs.
    data.directory = "${System.getProperty("user.home")}/.gradle/dependency-check-data"
}
