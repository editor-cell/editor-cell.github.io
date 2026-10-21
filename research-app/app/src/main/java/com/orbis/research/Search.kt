package com.orbis.research

import android.content.Context
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext

class Finding(val paragraph: Paragraph, val judgement: Judgement)

/**
 * One search, step by step, each step saved so an interrupted search goes on where it stopped:
 * 1. the meaning model picks the paragraphs closest in meaning to the claim (in any wording or
 *    language) within the chosen dates and sources;
 * 2. the language model puts the claim into English once (it judges English paragraphs better
 *    with it), then reads the paragraphs one by one and labels each; the words shown are always
 *    the paragraph as it was read from the document;
 * 3. if nothing bears on the claim outright, the model looks among the closest paragraphs for a
 *    comparable case to reason from by analogy (kıyas), shown apart from the evidence, and offers
 *    one line on where else to look.
 */
class Search(private val ctx: Context) {
    private val db = Db.get(ctx)

    /**
     * Step 1; false (with a message saved) when the meaning model is missing or unusable. First, live:
     * the sources' newest document lists are fetched, the documents whose titles come closest in
     * meaning to the claim are opened and read, so documents the phone had not collected yet take
     * part in the search too.
     */
    suspend fun prepare(run: SearchRun, say: suspend (String) -> Unit, stopped: () -> Boolean): Boolean {
        val path = Models.embedderPath(ctx)
        if (path == null) { db.setRun(state = Db.RUN_FAILED, message = NO_EMBEDDER); return false }
        if (!Embedder.ensure(ctx, path)) { db.setRun(state = Db.RUN_FAILED, message = "Anlam modeli açılamadı; Model sekmesinden yeniden indirin."); return false }
        try {
            val q = Embedder.embed(Vectors.queryText(path, run.claim)) ?: run {
                db.setRun(state = Db.RUN_FAILED, message = "Yargı okunamadı."); return false
            }
            if (Settings.live(ctx) && !stopped()) {
                try { live(run, q, path, say, stopped) }
                catch (e: CancellationException) { throw e }
                catch (e: Exception) { say("Canlı arama yapılamadı (${e.message}); telefondaki belgelerle sürüyor.") }
            }
            if (stopped()) return false
            say("Yargıya anlamca en yakın paragraflar bulunuyor…")
            db.setItems(db.closest(q, Settings.candidates(ctx), run.range, run.sourceIds))
            db.setRun(prepared = true)
        } finally {
            Embedder.release()
        }
        return true
    }

    private suspend fun live(run: SearchRun, q: FloatArray, path: String, say: suspend (String) -> Unit, stopped: () -> Boolean) {
        val sources = db.sources().filter { run.sourceIds == null || it.id in run.sourceIds }
        if (sources.isEmpty()) return
        val crawler = Crawler(ctx, stopped)
        val now = System.currentTimeMillis()

        // 1. The newest document lists of the sources, at most once in a few hours each.
        for ((i, s) in sources.withIndex()) {
            if (stopped()) return
            if (now - Settings.discovered(ctx, s.id) < REFRESH_MS) continue
            say("Canlı: ${s.name} belge listesi alınıyor (${i + 1}/${sources.size})…")
            try {
                withContext(Dispatchers.IO) { crawler.discover(s, force = true) }
                Settings.setDiscovered(ctx, s.id, now)
            } catch (e: CancellationException) { throw e } catch (e: Exception) { }
        }

        // 2. The documents whose title or address comes closest in meaning to the claim.
        say("Canlı: belge başlıkları yargıyla karşılaştırılıyor…")
        val deadline = System.currentTimeMillis() + TITLE_BUDGET_MS
        val scored = ArrayList<Triple<Float, Source, String>>()
        for (s in sources) {
            for ((url, title, _) in db.liveCandidates(s.id, run.range, TITLES_PER_SOURCE)) {
                if (stopped() || System.currentTimeMillis() > deadline) break
                val text = title.ifEmpty { Extract.slugText(url) }
                if (text.length < 8) continue
                val v = Embedder.embed(Vectors.docText(path, text)) ?: continue
                scored += Triple(Vectors.score(Vectors.toBytes(v), q), s, url)
            }
        }
        val top = scored.sortedByDescending { it.first }.take(Settings.liveRead(ctx))

        // 3. Open them, read them, and give their paragraphs meaning vectors at once.
        for ((n, t) in top.withIndex()) {
            if (stopped()) return
            val (_, s, url) = t
            say("Canlı: belge ${n + 1}/${top.size} okunuyor (${s.name})…")
            val state = withContext(Dispatchers.IO) { crawler.read(s, url) }
            db.markQueued(url, state)
            if (state == 1) {
                val out = ArrayList<Pair<Long, ByteArray>>()
                for ((id, text) in db.paragraphsOfDoc(url)) {
                    val v = Embedder.embed(Vectors.docText(path, text))
                    out += id to (v?.let(Vectors::toBytes) ?: ByteArray(0))
                }
                db.saveVectors(out)
            }
            delay(500)
        }
    }

    /**
     * Step 2 for one paragraph: the model's answers as saved (the verdict, and for a paragraph that
     * bears on the claim, on the next line, whether it says so outright and why not), or null if
     * the search was stopped.
     */
    suspend fun judge(claim: String, english: String?, paraId: Long): String? {
        val p = db.paragraph(paraId) ?: return "UNRELATED"
        val v = Llm.generate(Prompts.JUDGE_SYSTEM, Prompts.judge(claim, english, p), Prompts.JUDGE_GRAMMAR, maxTokens = 8)?.trim() ?: return null
        val verdict = when (v) { "SUPPORTS" -> Verdict.SUPPORTS; "CONTRADICTS" -> Verdict.CONTRADICTS; else -> return v }
        val how = Llm.generate(Prompts.JUDGE_SYSTEM, Prompts.how(claim, english, p, verdict), Prompts.HOW_GRAMMAR, maxTokens = 100)?.trim() ?: return null
        return "$v\n$how"
    }

    /**
     * Step four for one paragraph that step one called unrelated: the answer as saved, with the
     * model's kıyas if it found one, or null if the search was stopped.
     */
    suspend fun analogy(claim: String, english: String?, paraId: Long): String? {
        val p = db.paragraph(paraId) ?: return Prompts.withAnalogy(null)
        val a = Llm.generate(Prompts.JUDGE_SYSTEM, Prompts.analogy(claim, english, p), Prompts.ANALOGY_GRAMMAR, maxTokens = 180) ?: return null
        return Prompts.withAnalogy(a)
    }

    /** The claim in English, once per search; null if the search was stopped. */
    suspend fun translate(claim: String): String? =
        Llm.generate(Prompts.TRANSLATE_SYSTEM, Prompts.translate(claim), maxTokens = 60)?.let { Prompts.firstLine(it) ?: "" }

    /** Step 3. */
    suspend fun suggest(claim: String): String? =
        Llm.generate(Prompts.SUGGEST_SYSTEM, Prompts.suggest(claim), Prompts.SUGGEST_GRAMMAR, maxTokens = 70)?.trim()?.ifEmpty { null }

    /**
     * The paragraphs found so far: outright findings first, then indirect ones, then the model's
     * analogies; within each, supporting before contradicting.
     */
    fun findings(): List<Finding> {
        val claim = db.run()?.claim ?: ""
        return db.answers().mapNotNull { (id, answer) ->
            val p = db.paragraph(id) ?: return@mapNotNull null
            Prompts.parseJudgement(answer, p.text, claim)?.let { Finding(p, it) }
        }.sortedWith(compareBy<Finding>({ it.judgement.analogy != null }, { it.judgement.indirect }, { it.judgement.verdict.ordinal }))
    }

    companion object {
        /** A source's document list is fetched live again after this long. */
        const val REFRESH_MS = 6L * 60 * 60 * 1000
        /** At most this many of a source's newest unread addresses are compared with the claim. */
        const val TITLES_PER_SOURCE = 120
        /** The comparison of titles stops after this long, however many are left. */
        const val TITLE_BUDGET_MS = 150_000L
        /** How many of the closest unrelated paragraphs are tried for a kıyas. */
        const val ANALOGY_TRIES = 5
        const val NO_EMBEDDER = "Önce Model sekmesinden anlam modelini indirin."
    }
}
