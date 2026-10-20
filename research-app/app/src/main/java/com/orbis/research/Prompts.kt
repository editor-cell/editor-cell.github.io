package com.orbis.research

/**
 * Everything the app says to the model, kept free of Android so the tests run these exact prompts
 * against the real model. The model's answers only steer the search; they are never shown as text.
 */
object Prompts {
    const val TRANSLATE_SYSTEM = "You are a professional Turkish-English translator. You translate a statement into " +
        "accurate English, keeping every term's exact meaning. Output only the translation."
    fun translate(claim: String) = "Translate into English. If it is already English, repeat it unchanged.\n\n" +
        "Example: Tütün vergisini artıran ülkelerde sigara içme oranı azaldı.\n" +
        "Translation: In countries that raised tobacco taxes, smoking rates fell.\n\n" +
        "$claim\nTranslation:"

    /**
     * The start of the model's answer. Qwen3 thinks aloud first; an empty thinking block, as its
     * own template writes when thinking is off, makes it answer at once.
     */
    fun answerPrefix(modelPath: String) =
        if (modelPath.contains("qwen3", ignoreCase = true)) "<think>\n\n</think>\n\n" else ""

    const val PHRASES_SYSTEM = "You write search keywords for a library of official reports, statistics and research papers."
    fun phrases(english: String) = "Claim: $english\n\nWrite 6 short English search phrases (2 to 4 words each) that the documents " +
        "discussing this claim would contain. Use the words official reports use, including synonyms. " +
        "One phrase per line, no numbering."

    /** Drops the thinking block Qwen3 may write before its answer. */
    fun clean(raw: String) = raw.replace(Regex("(?s)<think>.*?</think>"), "").trim()

    fun firstLine(raw: String?) = raw?.lines()?.firstOrNull { it.isNotBlank() }?.trim()
        ?.removePrefix("Translation:")?.trim()?.trim('"')

    private val stop = setOf(
        "the", "and", "for", "that", "with", "from", "this", "those", "these", "are", "was", "were", "has", "have",
        "had", "its", "their", "which", "who", "into", "than", "then", "there", "they", "been", "being", "not",
        "but", "all", "any", "can", "did", "does", "per", "via", "also", "more", "less", "most", "such",
        "bir", "ve", "ile", "için", "olan", "olarak", "daha", "gibi", "kadar", "sonra", "önce", "ama", "veya",
        "bu", "şu", "o", "da", "de", "ki", "mi", "çok", "az", "her", "hem", "ise", "yani",
    )

    /** Words safe to hand to the word index: letters and digits only, no index operators. */
    fun ftsTerms(text: String): List<String> =
        Regex("[\\p{L}\\p{N}]+").findAll(text.lowercase()).map { it.value }
            .filter { it.length >= 3 && it !in stop && it != "or" && it != "near" }
            .distinct().toList()

    const val PHRASES_GRAMMAR = "root ::= line line line line? line? line? line? line?\n" +
        "line ::= [a-zA-Z] [a-zA-Z0-9 '-]{1,48} \"\\n\""

    const val JUDGE_GRAMMAR = "root ::= \"SUPPORTS\" | \"CONTRADICTS\" | \"UNRELATED\""

    const val JUDGE_SYSTEM = "You are a careful fact-checker. You read one paragraph taken from a document and " +
        "decide how it bears on a claim. Use only what the paragraph itself says.\n" +
        "SUPPORTS: the paragraph reports a finding, figure or evidence showing the claim is true.\n" +
        "CONTRADICTS: the paragraph reports a finding, figure or evidence showing the claim is false, " +
        "or that the effect was absent or the opposite.\n" +
        "UNRELATED: anything else, including paragraphs that only mention the topic, describe plans or " +
        "methods, or give no finding about the claim."

    fun judge(claim: String, english: String, p: Paragraph): String {
        val c = if (english.equals(claim, ignoreCase = true)) claim else "$claim\n(English: $english)"
        return "Claim: $c\n\nParagraph from \"${p.docTitle.take(200)}\":\n<<<\n${p.text.take(2400)}\n>>>\n\n" +
            "Answer with one word: SUPPORTS, CONTRADICTS or UNRELATED."
    }
}
