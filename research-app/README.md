# Orbis Araştırma (Android)

A research tool for the editors: it reads the documents published by a list of sources the
editors choose, and for a claim returns the paragraphs that support or contradict it, word for
word, each with the direct address of its document. It never summarises and never writes
numbers of its own; when nothing fits it says "Bulamadım".

- **Sources** are managed in the app: add one, paste many, import a file (one address per line,
  "Name, address", or a Feedly OPML export), select several and remove them, save the list to a file.
- **Collecting** reads each source's feeds, sitemaps and front page, newest first, into the phone
  (HTML and PDF). Every request is checked against the source list (`Net.kt`); nothing else is
  fetched. robots.txt is respected.
- **Searching**: an open model running on the phone (llama.cpp, Qwen2.5 / Qwen3 GGUF, Apache 2.0)
  translates the claim into English, writes search phrases, and labels each candidate paragraph
  SUPPORTS / CONTRADICTS / UNRELATED under a grammar that allows only those words. The text shown
  is always the stored paragraph, never model output.
- The only address outside the source list is Hugging Face, for the one-time model download.

Build: the "Research app (APK)" workflow tests the logic (`logic-test/`), fetches llama.cpp at the
commit in `llama.cpp.version`, builds the APK and attaches it to a GitHub release
(`arastirma-v0.1.<run>`). The signing key in `app/` is fixed so each APK installs over the last.
