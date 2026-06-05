import org.gradle.api.artifacts.VersionCatalog
import org.gradle.api.artifacts.VersionCatalogsExtension

plugins {
    id("kbeatz.kotlin-base")
    `java-library`
    `maven-publish`
}

private fun catalog(): VersionCatalog = project.extensions.getByType<VersionCatalogsExtension>().named("libs")
private fun lib(alias: String) = catalog().findLibrary(alias).get()
private fun bundle(alias: String) = catalog().findBundle(alias).get()

dependencies {
    api(lib("kotlinx-io-core"))
    api(lib("kotlinx-datetime"))
    implementation("org.javafreedom.kbeatz:kbeatz-common")
    implementation(lib("ktor-client-cio"))
    implementation(lib("ktor-client-content-negotiation"))
    implementation(lib("ktor-serialization-kotlinx-json"))
    implementation(bundle("logging"))
    implementation(lib("kotlinx-coroutines-core"))
    implementation(lib("kotlinx-serialization-json"))

    testImplementation(lib("kotlin-test-junit5"))
    testImplementation(lib("mockk"))
    testImplementation(lib("kotlinx-coroutines-test"))
    testImplementation(lib("ktor-client-mock"))
}

group = "org.javafreedom.kbeatz"
version = "0.0.1"

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
