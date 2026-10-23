# Orbis Araştırma (Android)

This Android trial finds paragraphs in sources chosen by the editor and compares each original paragraph with a Turkish or English claim. Supporting and contradicting paragraphs appear verbatim with direct document links. The classifier does not write answers or explanations.

## Current trained reader

The APK pins the latest trained checkpoint through `app/src/main/assets/nli_model.json`. The current trial uses `orbisthereadingatlas/orbis-nli-paragraf-bin-39932763272`, after its 1,000 human-authored five-choice reading questions. A separate frozen 97-question exam scored 44/97 (45.4%); this is not a measurement of the app's end-to-end source retrieval quality.

The model runs locally through ONNX Runtime 1.23.2 and the checkpoint's exact Hugging Face tokenizer JSON. A small Rust JNI library provides the tokenizer on Android and in the host tests. Paragraph/claim order, Unicode normalization, truncation at 1,024 tokens and label order match the verified export. Only the paragraph is truncated. The original baseline and Qwen are not selectable or loaded for classification.

The first trial preserves float32 weights: an int8 conversion failed decision parity and was rejected. The private ZIP downloads separately (878 MB compressed; 1.13 GB installed). Weights and credentials are not in the public GitHub repository, APK, release or shared Actions cache. The owner can download the private package through their Hugging Face browser session and import it, or use a read-only Hugging Face token stored with Android Keystore encryption. Imports and downloads require exact package and per-file SHA-256 hashes pinned by the APK. Allow 3 GB free storage while importing. Actual phone latency and memory remain to be measured.

## Source collection and search

- Manage sources individually, paste a list, or import text/Feedly OPML; group, filter and export them.
- Collect each chosen source's feeds, sitemaps and front page, newest first, including HTML and PDF. Requests are restricted to the chosen sources and respect robots.txt.
- Build a meaning index using multilingual-e5-small (recommended for 4 GB phones) or EmbeddingGemma 300M. These models select candidate paragraphs; the trained NLI model judges them.
- Search the phone's stored documents or read new documents from the selected sources. Restrict searches by source and dates. The configured number of candidate paragraphs is passed directly to the trained reader.
- Searching runs in a foreground worker, saving each classification and supporting pause/resume. E5 is released after candidate selection; the reader is released after judging. Model migration resets the current search results while keeping documents, source lists and meaning vectors.
- The legacy Qwen translation, keyword gate, generated analogy and suggestion stages do not run in this trial.

## Build and verification

The `Research app (export current trained model for Android)` workflow exports only `train/latest_model.json`, verifies float output and option ranking against that checkpoint, reruns the frozen independent exam, and uploads the package to a private Hugging Face repository. It commits only the public package manifest and technical tokenizer/runtime parity fixtures. These fixtures are implementation checks, not invented semantic training questions.

The `Research app (APK)` workflow checks the private package hashes, compiles the same tokenizer for host and arm64 Android, tests real tokenization and ONNX logits against the verified export, runs existing source/reading logic and E5 tests, and builds the signed APK. No baseline or Qwen weights are fetched. It publishes only the APK to `arastirma-v0.1.<versionCode>`; version codes are above prior phone releases and the fixed signing key allows updating the installed app. On `anlam-okuma`, a push must include `[android-latest-build]` to trigger publication. The website is not deployed by this workflow.

See [phone installation notes](ANDROID-TRIAL.md).
