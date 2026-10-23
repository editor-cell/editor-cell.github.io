package com.orbis.research

import android.content.Context
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext

class Finding(val paragraph: Paragraph, val judgement: Judgement)

/** Finds candidate paragraphs by meaning, then classifies each with the latest trained NLI model. */
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
        val groups = sources.map { source ->
            db.liveCandidates(source.id, run.range, TITLES_PER_SOURCE).map { source to it }
        }
        for ((source, candidate) in SearchSelection.roundRobin(groups)) {
            if (stopped() || System.currentTimeMillis() > deadline) break
            val (url, title, _) = candidate
            val text = title.ifEmpty { Extract.slugText(url) }
            if (text.length < 8) continue
            val v = Embedder.embed(Vectors.docText(path, text)) ?: continue
            scored += Triple(Vectors.score(Vectors.toBytes(v), q), source, url)
        }
        val top = SearchSelection.diverse(scored.sortedByDescending { it.first }, Settings.liveRead(ctx)) { it.second.id }

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

    /** The trained NLI model reads the original paragraph and the claim directly. */
    suspend fun judge(claim: String, paraId: Long): String? {
        val p = db.paragraph(paraId) ?: return "UNRELATED"
        return Nli.judge(p.text, claim)
    }

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
        const val TITLES_PER_SOURCE = 360
        /** The comparison of titles stops after this long, however many are left. */
        const val TITLE_BUDGET_MS = 150_000L
        const val NO_EMBEDDER = "Önce Model sekmesinden anlam modelini indirin."
    }
}
