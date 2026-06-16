plugins {
    id("kbeatz.kotlin-base")
    `java-library`
    `maven-publish`
}

group = "org.javafreedom.kbeatz"
version = "0.0.1"

// Publish a -sources.jar alongside the compiled JAR so IDEs can navigate to
// Kotlin source for consumers of this shared library. withSourcesJar() wires
// the sourcesJar task into the java component, so the MavenPublication below
// picks it up automatically via from(components["java"]).
java {
    withSourcesJar()
}

private val catalog get() = the<VersionCatalogsExtension>().named("libs")
private fun lib(alias: String) = catalog.findLibrary(alias).get()

dependencies {
    // kbeatz-common is a leaf library (domain exceptions + metadata value types).
    // It exports only the types that appear in its public API: kotlinx-datetime
    // (LocalDate on Album.date) and kotlinx.serialization (the @Serializable
    // metadata model). KbeatzMetadata.fetchedAt uses kotlin.time.Instant (stdlib).
    // It depends on no Ktor server artifacts and does not log,
    // so no logging dependency is declared here; modules that log declare it
    // themselves (catalog/sources/tagger via the logging bundle, cli directly).
    api(lib("kotlinx-datetime"))
    api(lib("kotlinx-serialization-json"))

    testImplementation(lib("kotlin-test-junit5"))
}

kover {
    reports {
        verify {
            rule { minBound(80) }
        }
    }
}

publishing {
    publications {
        create<MavenPublication>("maven") {
            from(components["java"])
        }
    }
    repositories {
        maven {
            name = "GitHubPackages"
            url = uri("https://maven.pkg.github.com/triplem/kbeatz")
            credentials {
                username = System.getenv("GITHUB_ACTOR")
                password = System.getenv("GITHUB_TOKEN")
            }
        }
    }
}
