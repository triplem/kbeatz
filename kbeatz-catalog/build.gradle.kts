plugins {
    id("kbeatz.ktor-service")
}

group = "org.javafreedom.kbeatz.catalog"
version = "0.0.1"

application {
    mainClass.set("org.javafreedom.kbeatz.catalog.ApplicationKt")
}

openApiGenerate {
    inputSpec.set(layout.projectDirectory.file("api/openapi.yaml").asFile.path)
    outputDir.set("${layout.buildDirectory.get()}/generated/api")
    packageName.set("org.javafreedom.kbeatz.catalog.api")
    apiPackage.set("org.javafreedom.kbeatz.catalog.api")
    modelPackage.set("org.javafreedom.kbeatz.catalog.api.models")
}

kover {
    reports {
        filters {
            excludes {
                classes("org.javafreedom.kbeatz.catalog.ApplicationKt*")
                packages("org.javafreedom.kbeatz.catalog.api")
            }
        }
        verify {
            rule { minBound(80) }
        }
    }
}
