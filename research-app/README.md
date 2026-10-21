# Orbis Araştırma (Android)

A research tool for the editors: it reads the documents published by a list of sources the
editors choose, and for a claim returns the paragraphs that support or contradict it, word for
word, each with the direct address of its document. It never summarises and never writes
numbers of its own; when nothing fits it says "Bulamadım".

- **Sources** are managed in the app: add one, paste many, import a file (one address per line,
  "Name, address, Heading; Heading", or a Feedly OPML export whose folders become headings), select
  several and remove them, file them under headings, save the list to a file.
- **Searching** can be limited to some headings, to sources picked one by one, and to a date range.
- **Collecting** reads each source's feeds, sitemaps and front page, newest first, into the phone
  (HTML and PDF). Every request is checked against the source list (`Net.kt`); nothing else is
  fetched. robots.txt is respected.
- **Meaning index**: every collected paragraph gets a meaning vector from a small embedding model
  (multilingual-e5-small, converted from its publisher's files by `research-app-model-files.yml`,
  or EmbeddingGemma 300M on phones with 6 GB or more). A Turkish claim then finds English paragraphs
  that say the same thing in other words.
- **Searching** runs as a background job with a notification (`SearchWorker`), saving each answer,
  so it survives leaving the app and resumes if the phone stops it. The paragraphs closest in
  meaning, within the chosen headings, sources and dates, are read by an open language model
  (llama.cpp; Qwen3 4B, or Qwen3 1.7B on 4 GB phones; Apache 2.0) in two steps: SUPPORTS /
  CONTRADICTS / UNRELATED under a grammar, then for a hit DIRECT or INDIRECT with a one-line reason.
  A reason carrying a figure the paragraph lacks is dropped. With no outright finding, the model
  tries a kıyas (reasoning by analogy, as in usul) on the closest paragraphs it found unrelated:
  the case in the paragraph (asıl), the case in the claim (fer), the shared cause (illet) and what
  follows (hüküm, as a likelihood), shown on a card of its own as the model's reasoning, with the
  paragraph beside it; one figure outside the paragraph and claim and the analogy is not shown.
  Then it offers one digit-free line on where else to look, shown apart as a suggestion. The quote shown is
  always the stored paragraph, never model output. "Durdur" stops within one 32-token step.
- The only addresses outside the source list are the model downloads (Hugging Face, and this
  repository's release `models-1`), fetched once when the owner asks.

Build: the "Research app (APK)" workflow tests the logic and the models (`logic-test/`), fetches llama.cpp at the
commit in `llama.cpp.version`, builds the APK and attaches it to a GitHub release
(`arastirma-v0.1.<run>`). The signing key in `app/` is fixed so each APK installs over the last.
