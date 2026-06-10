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
    api(lib("ktor-server-auth-jwt"))
    api(lib("ktor-server-call-id"))
    api(lib("ktor-server-call-logging"))
    api(lib("ktor-server-status-pages"))
    api(lib("kotlin-logging"))
    api(lib("kotlinx-datetime"))
    api(lib("kotlinx-serialization-json"))
    implementation(lib("ktor-server-core"))

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
