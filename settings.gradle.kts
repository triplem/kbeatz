pluginManagement {
    includeBuild("build-logic")
    repositories {
        gradlePluginPortal()
    }
}

// Foojay toolchain resolver: allows Gradle to auto-provision the JDK version
// specified by jvmToolchain() when the running JVM is a different version.
// Required because dependabot bumped Docker base images to eclipse-temurin:25
// while the project targets Java 21 via jvmToolchain(21).
plugins {
    id("org.gradle.toolchains.foojay-resolver-convention") version "0.9.0"
}

rootProject.name = "kbeatz"

includeBuild("kbeatz-common") {
    dependencySubstitution {
        substitute(module("org.javafreedom.kbeatz:kbeatz-common")).using(project(":"))
    }
}

includeBuild("kbeatz-tagger") {
    dependencySubstitution {
        substitute(module("org.javafreedom.kbeatz:kbeatz-tagger")).using(project(":"))
    }
}

includeBuild("kbeatz-cli") {
    dependencySubstitution {
        substitute(module("org.javafreedom.kbeatz:kbeatz-cli")).using(project(":"))
    }
}

includeBuild("kbeatz-catalog") {
    dependencySubstitution {
        substitute(module("org.javafreedom.kbeatz:kbeatz-catalog")).using(project(":"))
        substitute(module("org.javafreedom.kbeatz:kbeatz-catalog-spec")).using(project(":"))
    }
}

includeBuild("kbeatz-sources") {
    dependencySubstitution {
        substitute(module("org.javafreedom.kbeatz:kbeatz-sources")).using(project(":"))
    }
}

// Add more services here following the same pattern:
// includeBuild("kbeatz-<name>") {
//     dependencySubstitution {
//         substitute(module("org.javafreedom.kbeatz:kbeatz-<name>")).using(project(":"))
//     }
// }
