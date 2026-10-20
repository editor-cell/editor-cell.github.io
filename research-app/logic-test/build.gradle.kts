// Runs the app's phone-independent logic (source lists, robots.txt, reading pages) on a computer.
plugins { kotlin("jvm") version "2.3.0" }

repositories { mavenCentral() }

val app = "../app/src/main/java/com/orbis/research"
sourceSets {
    main { kotlin.srcDir(app); kotlin.include("Sources.kt", "Robots.kt", "Extract.kt") }
}

dependencies {
    implementation("org.jsoup:jsoup:1.18.3")
    testImplementation(kotlin("test"))
}


tasks.test { useJUnitPlatform(); testLogging { events("failed"); exceptionFormat = org.gradle.api.tasks.testing.logging.TestExceptionFormat.FULL } }
