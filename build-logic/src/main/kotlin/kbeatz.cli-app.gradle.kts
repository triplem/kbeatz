import org.gradle.api.artifacts.VersionCatalog
import org.gradle.api.artifacts.VersionCatalogsExtension

plugins {
    id("kbeatz.kotlin-base")
    application
    id("org.jetbrains.kotlinx.kover")
}

private fun catalog(): VersionCatalog = project.extensions.getByType<VersionCatalogsExtension>().named("libs")
private fun lib(alias: String) = catalog().findLibrary(alias).get()
private fun bundle(alias: String) = catalog().findBundle(alias).get()

dependencies {
    "implementation"("org.javafreedom.kbeatz:kbeatz-common")
    "implementation"("org.javafreedom.kbeatz:kbeatz-flac")
    "implementation"(bundle("logging"))
    "implementation"(lib("kotlinx-datetime"))
    "implementation"(lib("kotlinx-coroutines-core"))
    "implementation"(lib("kotlinx-serialization-json"))
    "implementation"(lib("kaml"))
    "implementation"(lib("clikt"))
    "implementation"(lib("kotlinx-io-core"))

    "testImplementation"(lib("kotlin-test-junit5"))
    "testImplementation"(lib("mockk"))
    "testImplementation"(lib("kotlinx-coroutines-test"))
}

kover {
    reports {
        verify {
            rule { minBound(80) }
        }
    }
}
