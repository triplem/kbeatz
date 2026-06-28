plugins {
    id("kbeatz.cli-app")
    id("com.gradleup.shadow") version "9.4.3"
    `maven-publish`
}

group = "org.javafreedom.kbeatz"
version = "0.0.1"

dependencies {
    implementation("org.javafreedom.kbeatz:kbeatz-tagger")
    implementation("org.javafreedom.kbeatz:kbeatz-sources")
    // cli uses KotlinLogging directly (TagAlbumsCommand, MigrateIdFilesCommand);
    // declare the facade here instead of relying on a transitive re-export from
    // kbeatz-common.
    implementation(libs.kotlin.logging)
}

application {
    mainClass.set("org.javafreedom.kbeatz.cli.KbeatzTaggerCliKt")
}

tasks.shadowJar {
    archiveBaseName.set("kbeatz-cli")
    archiveVersion.set("")
    archiveClassifier.set("all")
    mergeServiceFiles()
}

publishing {
    publications {
        create<MavenPublication>("maven") {
            // Publish the shadow (fat) JAR so consumers get a self-contained artifact.
            artifact(tasks.shadowJar)
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

kover {
    reports {
        filters {
            excludes {
                classes("org.javafreedom.kbeatz.cli.KbeatzTaggerCliKt*")
            }
        }
        verify {
            rule { minBound(80) }
        }
    }
}
