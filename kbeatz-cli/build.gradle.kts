plugins {
    id("kbeatz.cli-app")
    id("com.gradleup.shadow") version "9.4.2"
}

group = "org.javafreedom.kbeatz"
version = "0.0.1"

dependencies {
    implementation("org.javafreedom.kbeatz:kbeatz-tagger")
    implementation("org.javafreedom.kbeatz:kbeatz-sources")
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
