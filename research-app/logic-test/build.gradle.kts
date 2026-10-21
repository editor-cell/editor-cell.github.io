// Runs the app's phone-independent logic (source lists, robots.txt, reading pages) on a computer.
// With ORBIS_LIB (the bridge built for this computer) and ORBIS_MODEL (a GGUF file) set, it also
// runs the app's prompts against the real model.
plugins { kotlin("jvm") version "2.3.0" }

repositories { mavenCentral() }

val app = "../app/src/main/java/com/orbis/research"
sourceSets {
    main { kotlin.srcDir(app); kotlin.include("Sources.kt", "Robots.kt", "Extract.kt", "Prompts.kt", "LlmNative.kt", "DateRange.kt", "Vectors.kt") }
}

dependencies {
    implementation("org.jsoup:jsoup:1.18.3")
    testImplementation(kotlin("test"))
}


tasks.test { useJUnitPlatform(); testLogging { events("failed", "skipped"); showStandardStreams = true; exceptionFormat = org.gradle.api.tasks.testing.logging.TestExceptionFormat.FULL } }
