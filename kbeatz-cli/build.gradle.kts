plugins {
    id("kbeatz.cli-app")
}

group = "org.javafreedom.kbeatz"
version = "0.0.1"

dependencies {
    implementation("org.javafreedom.kbeatz:kbeatz-tagger")
}

application {
    mainClass.set("org.javafreedom.kbeatz.cli.KbeatzTaggerCliKt")
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
