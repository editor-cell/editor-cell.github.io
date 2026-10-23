// Runs the app's phone-independent logic (source lists, robots.txt, reading pages) on a computer.
// With ORBIS_LIB (the bridge built for this computer) and ORBIS_MODEL (a GGUF file) set, it also
// runs the app's prompts against the real model.
plugins { kotlin("jvm") version "2.3.0" }

repositories { mavenCentral() }

val app = "../app/src/main/java/com/orbis/research"
sourceSets {
    main { kotlin.srcDir(app); kotlin.include("Sources.kt", "Robots.kt", "Extract.kt", "Prompts.kt", "LlmNative.kt", "DateRange.kt", "Vectors.kt", "Evrak.kt", "Concepts.kt", "NativeTokenizer.kt", "NliEngine.kt", "EvidenceDecision.kt", "SearchSelection.kt", "CloudReader.kt") }
}

dependencies {
    implementation("org.jsoup:jsoup:1.18.3")
    implementation("com.microsoft.onnxruntime:onnxruntime:1.23.2")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.10.2")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.json:json:20250517")
    testImplementation(kotlin("test"))
}


tasks.test {
    useJUnitPlatform()
    System.getenv("ORBIS_TOKENIZER_LIB")?.let { systemProperty("orbis.tokenizer.lib", it) }
    testLogging { events("failed", "skipped"); showStandardStreams = true; exceptionFormat = org.gradle.api.tasks.testing.logging.TestExceptionFormat.FULL }
}
