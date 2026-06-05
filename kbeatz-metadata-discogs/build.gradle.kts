plugins {
    id("kbeatz.ktor-service")
}

group = "org.javafreedom.kbeatz.metadata.discogs"
version = "0.0.1"

application {
    mainClass.set("org.javafreedom.kbeatz.metadata.discogs.ApplicationKt")
}

openApiGenerate {
    inputSpec.set(layout.projectDirectory.file("api/openapi.yaml").asFile.path)
    outputDir.set("${layout.buildDirectory.get()}/generated/api")
    packageName.set("org.javafreedom.kbeatz.metadata.discogs.api")
    apiPackage.set("org.javafreedom.kbeatz.metadata.discogs.api")
    modelPackage.set("org.javafreedom.kbeatz.metadata.discogs.api.models")
}

kover {
    reports {
        filters {
            excludes {
                classes("org.javafreedom.kbeatz.metadata.discogs.ApplicationKt*")
                packages("org.javafreedom.kbeatz.metadata.discogs.api")
            }
        }
        verify {
            rule { minBound(80) }
        }
    }
}
