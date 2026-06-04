plugins {
    id("kbeatz.kotlin-base")
    `java-library`
    `maven-publish`
}

group = "org.example.kbeatz"
version = "0.0.1"

private val catalog get() = the<VersionCatalogsExtension>().named("libs")
private fun lib(alias: String) = catalog.findLibrary(alias).get()

dependencies {
    api(lib("ktor-server-auth-jwt"))
    api(lib("ktor-server-call-id"))
    api(lib("ktor-server-call-logging"))
    api(lib("ktor-server-status-pages"))
    api(lib("kotlin-logging"))
    api(lib("kotlinx-datetime"))
    implementation(lib("ktor-server-core"))
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
