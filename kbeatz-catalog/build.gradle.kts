plugins {
    id("kbeatz.ktor-service")
}

group = "org.javafreedom.kbeatz.catalog"
version = "0.0.1"

application {
    mainClass.set("org.javafreedom.kbeatz.catalog.ApplicationKt")
}

dependencies {
    "implementation"("org.javafreedom.kbeatz:kbeatz-tagger")
    "implementation"(libs.exposed.core)
    "implementation"(libs.exposed.jdbc)
    "implementation"(libs.exposed.kotlin.datetime)
    "implementation"(libs.exposed.json)
    "implementation"(libs.hikaricp)
    "implementation"(libs.h2)
    "implementation"(libs.liquibase.core)
}

openApiGenerate {
    inputSpec.set(layout.projectDirectory.file("api/openapi.yaml").asFile.path)
    outputDir.set("${layout.buildDirectory.get()}/generated/api")
    packageName.set("org.javafreedom.kbeatz.catalog.api")
    apiPackage.set("org.javafreedom.kbeatz.catalog.api")
    modelPackage.set("org.javafreedom.kbeatz.catalog.api.models")
}

tasks.named<Test>("e2eTest") {
    environment("CATALOG_LIBRARY_ROOT", System.getenv("CATALOG_LIBRARY_ROOT") ?: System.getProperty("java.io.tmpdir"))
    environment("CATALOG_JDBC_URL", "jdbc:h2:mem:kbeatz_e2e;DB_CLOSE_DELAY=-1;MODE=PostgreSQL")
}

kover {
    reports {
        filters {
            excludes {
                classes("org.javafreedom.kbeatz.catalog.ApplicationKt*")
                packages("org.javafreedom.kbeatz.catalog.api")
                // Domain model data classes: constructors/copy/equals/hashCode/toString are
                // auto-generated and not worth testing directly; semantics tested via integration tests.
                classes(
                    "org.javafreedom.kbeatz.catalog.domain.model.Track",
                    "org.javafreedom.kbeatz.catalog.domain.model.ImageDescriptor",
                    "org.javafreedom.kbeatz.catalog.domain.model.ImageSource",
                )
                // Status page lambdas are exercised by e2eTest error scenarios; low value to cover
                // the internal Ktor DSL glue here.
                classes("org.javafreedom.kbeatz.catalog.plugins.StatusPagesKt*")
            }
        }
        verify {
            rule { minBound(80) }
        }
    }
}
