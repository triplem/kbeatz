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

tasks.test {
    useJUnitPlatform {
        excludeTags("generators")
    }
}

tasks.register<Test>("generateFixtures") {
    description = "Regenerates committed FLAC fixture files from FixtureGenerator."
    group = "verification"
    testClassesDirs = sourceSets.test.get().output.classesDirs
    classpath = sourceSets.test.get().runtimeClasspath
    useJUnitPlatform {
        includeTags("generators")
    }
}

dependencies {
    api(lib("kotlinx-io-core"))
    implementation("org.javafreedom.kbeatz:kbeatz-common")
    implementation("org.javafreedom.kbeatz:kbeatz-sources")
    implementation(lib("kotlinx-datetime"))
    implementation(lib("kotlinx-coroutines-core"))
    implementation(lib("kotlinx-serialization-json"))
    implementation(lib("kaml"))
    implementation(bundle("logging"))

    testImplementation(lib("kotlin-test-junit5"))
    testImplementation(lib("mockk"))
    testImplementation(lib("kotlinx-coroutines-test"))
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
