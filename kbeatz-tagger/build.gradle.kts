plugins {
    id("kbeatz.cli-app")
}

group = "org.javafreedom.kbeatz"
version = "0.0.1"

application {
    mainClass.set("org.javafreedom.kbeatz.tagger.cli.ApplicationKt")
}

kover {
    reports {
        filters {
            excludes {
                classes("org.javafreedom.kbeatz.tagger.cli.ApplicationKt*")
            }
        }
        verify {
            rule { minBound(80) }
        }
    }
}
