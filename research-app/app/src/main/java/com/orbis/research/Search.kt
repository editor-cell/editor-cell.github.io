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

    suspend fun run(claim: String, range: DateRange, sourceIds: Set<Long>?, status: (String) -> Unit, found: (Finding) -> Unit): Int {
        status("İddia İngilizceye çevriliyor…")
        val english = Prompts.firstLine(Llm.generate(Prompts.TRANSLATE_SYSTEM, Prompts.translate(claim), maxTokens = 120)) ?: claim
        currentCoroutineContext().ensureActive()

        status("Arama sözcükleri hazırlanıyor…")
        val phrases = Llm.generate(Prompts.PHRASES_SYSTEM, Prompts.phrases(english), Prompts.PHRASES_GRAMMAR, maxTokens = 120)
            ?.lines()?.map { it.trim() }?.filter { it.isNotEmpty() } ?: emptyList()
        currentCoroutineContext().ensureActive()

        status("Telefondaki belgelerde aranıyor…")
        val ids = candidates(claim, english, phrases, range, sourceIds, Settings.candidates(ctx))
        if (ids.isEmpty()) return 0

        var read = 0
        val started = System.currentTimeMillis()
        for ((i, id) in ids.withIndex()) {
            currentCoroutineContext().ensureActive()
            // After the first few paragraphs the phone's own pace gives an honest estimate.
            val left = if (i >= 2) ((System.currentTimeMillis() - started) / i * (ids.size - i) / 1000).toInt() else -1
            status("Paragraf ${i + 1}/${ids.size} okunuyor…" + if (left >= 0) " (yaklaşık ${duration(left)} kaldı)" else "")
            val p = db.paragraph(id) ?: continue
            val answer = Llm.generate(Prompts.JUDGE_SYSTEM, Prompts.judge(claim, english, p), Prompts.JUDGE_GRAMMAR, maxTokens = 6)
            read++
            when (answer?.trim()) {
                "SUPPORTS" -> found(Finding(p, Verdict.SUPPORTS))
                "CONTRADICTS" -> found(Finding(p, Verdict.CONTRADICTS))
            }
        }
        return read
    }

    /** Paragraph ids, best first: those holding whole search phrases rank above single words. */
    private fun candidates(
        claim: String, english: String, phrases: List<String>, range: DateRange, sourceIds: Set<Long>?, limit: Int,
    ): List<Long> {
        val score = HashMap<Long, Int>()
        for (ph in phrases) {
            val q = Prompts.ftsTerms(ph).joinToString(" ")
            if (q.isNotEmpty()) for (id in db.match(q, 400, range, sourceIds)) score[id] = (score[id] ?: 0) + 4
        }
        val words = (Prompts.ftsTerms(english) + Prompts.ftsTerms(claim)).distinct()
        for (w in words) for (id in db.match(w, 3000, range, sourceIds)) score[id] = (score[id] ?: 0) + 1
        val min = if (words.size >= 3) 2 else 1
        return score.entries.filter { it.value >= min }.sortedByDescending { it.value }.take(limit).map { it.key }
    }

    private fun duration(sec: Int) = if (sec < 60) "$sec sn" else "${(sec + 30) / 60} dk"
}
