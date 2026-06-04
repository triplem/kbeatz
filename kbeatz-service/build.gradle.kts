plugins {
    id("kbeatz.ktor-service")
}

group = "org.example.kbeatz.service"
version = "0.0.1"

application {
    mainClass.set("org.example.kbeatz.service.ApplicationKt")
}

openApiGenerate {
    inputSpec.set(layout.projectDirectory.file("api/openapi.yaml").asFile.path)
    outputDir.set("${layout.buildDirectory.get()}/generated/api")
    packageName.set("org.example.kbeatz.service.api")
    apiPackage.set("org.example.kbeatz.service.api")
    modelPackage.set("org.example.kbeatz.service.api.models")
}

kover {
    reports {
        filters {
            excludes {
                classes("org.example.kbeatz.service.ApplicationKt*")
                packages("org.example.kbeatz.service.api")
            }
        }
        verify {
            rule { minBound(80) }
        }
    }
}
