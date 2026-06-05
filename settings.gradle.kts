pluginManagement {
    includeBuild("build-logic")
    repositories {
        gradlePluginPortal()
    }
}

rootProject.name = "kbeatz"

includeBuild("kbeatz-common") {
    dependencySubstitution {
        substitute(module("org.javafreedom.kbeatz:kbeatz-common")).using(project(":"))
    }
}

includeBuild("kbeatz-tag") {
    dependencySubstitution {
        substitute(module("org.javafreedom.kbeatz:kbeatz-tag")).using(project(":"))
    }
}

includeBuild("kbeatz-tagger") {
    dependencySubstitution {
        substitute(module("org.javafreedom.kbeatz:kbeatz-tagger")).using(project(":"))
    }
}

includeBuild("kbeatz-catalog") {
    dependencySubstitution {
        substitute(module("org.javafreedom.kbeatz:kbeatz-catalog")).using(project(":"))
        substitute(module("org.javafreedom.kbeatz:kbeatz-catalog-spec")).using(project(":"))
    }
}

includeBuild("kbeatz-metadata") {
    dependencySubstitution {
        substitute(module("org.javafreedom.kbeatz:kbeatz-metadata")).using(project(":"))
    }
}

// Add more services here following the same pattern:
// includeBuild("kbeatz-<name>") {
//     dependencySubstitution {
//         substitute(module("org.javafreedom.kbeatz:kbeatz-<name>")).using(project(":"))
//     }
// }
