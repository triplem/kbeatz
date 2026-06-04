pluginManagement {
    includeBuild("build-logic")
    repositories {
        gradlePluginPortal()
    }
}

rootProject.name = "kbeatz"

includeBuild("kbeatz-common")

includeBuild("kbeatz-service") {
    dependencySubstitution {
        substitute(module("org.example.kbeatz:kbeatz-service")).using(project(":"))
        substitute(module("org.example.kbeatz:kbeatz-service-spec")).using(project(":"))
    }
}

// Add more services here following the same pattern:
// includeBuild("kbeatz-<name>") {
//     dependencySubstitution {
//         substitute(module("org.example.kbeatz:kbeatz-<name>")).using(project(":"))
//     }
// }
