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
- **Live search**: when a search starts, each selected source's newest document list (feed and
  sitemaps, at most every 6 hours per source) is fetched, the documents whose title or address comes
  closest in meaning to the claim are opened and read, and their paragraphs join the phone's index at
  once. So documents not yet collected are found too. Only listed sources are visited (`Net.kt`);
  the sources' own search pages were measured (`research-app-probe.yml`) and read reliably on only a
  few sites, so they are not used.
- **Concept check**: at the start of a search the language model lists the claim's two or three key
  ideas (things and events, not directions) with many English and Turkish words and synonyms for
  each (`Concepts.kt`). Of the paragraphs closest in meaning (ten times as many as will be read), only
  those that use words of most of the ideas, in any word form, go on; the rest are never read, and with
  none left the answer is "Bulamadım". Only then does the model judge, by meaning, what the paragraph
  says of the claim. `ConceptGateTest` runs the whole path on the phone's small model (Qwen3 1.7B) as
  well as the big one: paragraphs that have nothing to do with the claim (thanks to the authors, a
  figure note, a speech on bank competitiveness, a page on the Basel Process) must not become
  findings, and clear findings must reach the model, or the build stops and no release goes out.
  Close cases, synonyms and Turkish sources are only reported on the run.
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
