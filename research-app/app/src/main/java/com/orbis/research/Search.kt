package com.orbis.research

import android.content.Context
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive

enum class Verdict { SUPPORTS, CONTRADICTS }

class Finding(val paragraph: Paragraph, val verdict: Verdict)

/**
 * Looks for paragraphs that bear on a claim. The model only chooses: it labels each candidate
 * paragraph; the words shown are always the paragraph as it was read from the document.
 */
class Search(private val ctx: Context) {
    private val db = Db.get(ctx)

    suspend fun run(claim: String, status: (String) -> Unit, found: (Finding) -> Unit): Int {
        status("İddia İngilizceye çevriliyor…")
        val english = Llm.generate(
            "You translate short statements into English. Output only the translation, nothing else.",
            "Translate into English. If it is already English, repeat it unchanged:\n\n$claim",
            maxTokens = 120,
        )?.lines()?.firstOrNull { it.isNotBlank() }?.trim()?.trim('"') ?: claim
        currentCoroutineContext().ensureActive()

        status("Arama sözcükleri hazırlanıyor…")
        val phrases = Llm.generate(
            "You write search keywords for a library of official reports, statistics and research papers.",
            "Claim: $english\n\nWrite 6 short English search phrases (2 to 4 words each) that the documents " +
                "discussing this claim would contain. Use the words official reports use, including synonyms. " +
                "One phrase per line, no numbering.",
            PHRASES_GRAMMAR, maxTokens = 120,
        )?.lines()?.map { it.trim() }?.filter { it.isNotEmpty() } ?: emptyList()
        currentCoroutineContext().ensureActive()

        status("Telefondaki belgelerde aranıyor…")
        val ids = candidates(claim, english, phrases, Settings.candidates(ctx))
        if (ids.isEmpty()) return 0

        var read = 0
        for ((i, id) in ids.withIndex()) {
            currentCoroutineContext().ensureActive()
            status("Paragraf ${i + 1}/${ids.size} okunuyor…")
            val p = db.paragraph(id) ?: continue
            val answer = Llm.generate(JUDGE_SYSTEM, judgePrompt(claim, english, p), JUDGE_GRAMMAR, maxTokens = 6)
            read++
            when (answer?.trim()) {
                "SUPPORTS" -> found(Finding(p, Verdict.SUPPORTS))
                "CONTRADICTS" -> found(Finding(p, Verdict.CONTRADICTS))
            }
        }
        return read
    }

    /** Paragraph ids, best first: those holding whole search phrases rank above single words. */
    private fun candidates(claim: String, english: String, phrases: List<String>, limit: Int): List<Long> {
        val score = HashMap<Long, Int>()
        for (ph in phrases) {
            val q = ftsTerms(ph).joinToString(" ")
            if (q.isNotEmpty()) for (id in db.match(q, 400)) score[id] = (score[id] ?: 0) + 4
        }
        val words = (ftsTerms(english) + ftsTerms(claim)).distinct()
        for (w in words) for (id in db.match(w, 3000)) score[id] = (score[id] ?: 0) + 1
        val min = if (words.size >= 3) 2 else 1
        return score.entries.filter { it.value >= min }.sortedByDescending { it.value }.take(limit).map { it.key }
    }

    companion object {
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
            "line ::= [a-zA-Z0-9] [a-zA-Z0-9 '-]{1,48} \"\\n\""

        const val JUDGE_GRAMMAR = "root ::= \"SUPPORTS\" | \"CONTRADICTS\" | \"UNRELATED\""

        const val JUDGE_SYSTEM = "You are a careful fact-checker. You read one paragraph taken from a document and " +
            "decide how it bears on a claim. Use only what the paragraph itself says.\n" +
            "SUPPORTS: the paragraph reports a finding, figure or evidence showing the claim is true.\n" +
            "CONTRADICTS: the paragraph reports a finding, figure or evidence showing the claim is false, " +
            "or that the effect was absent or the opposite.\n" +
            "UNRELATED: anything else, including paragraphs that only mention the topic, describe plans or " +
            "methods, or give no finding about the claim."

        fun judgePrompt(claim: String, english: String, p: Paragraph): String {
            val c = if (english.equals(claim, ignoreCase = true)) claim else "$claim\n(English: $english)"
            return "Claim: $c\n\nParagraph from \"${p.docTitle.take(200)}\":\n<<<\n${p.text.take(2400)}\n>>>\n\n" +
                "Answer with one word: SUPPORTS, CONTRADICTS or UNRELATED."
        }
    }
}
