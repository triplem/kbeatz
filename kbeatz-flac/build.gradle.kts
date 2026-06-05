import org.gradle.api.artifacts.VersionCatalog
import org.gradle.api.artifacts.VersionCatalogsExtension

plugins {
    id("kbeatz.kotlin-base")
    `java-library`
    `maven-publish`
    id("org.jetbrains.kotlinx.kover")
}

private fun catalog(): VersionCatalog = project.extensions.getByType<VersionCatalogsExtension>().named("libs")
private fun lib(alias: String) = catalog().findLibrary(alias).get()

dependencies {
    api(lib("kotlinx-io-core"))
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
