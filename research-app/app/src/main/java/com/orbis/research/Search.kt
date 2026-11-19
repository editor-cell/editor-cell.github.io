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
            // A claim that joins several things (definition, harms, measures) is searched part by part.
            say("Sorgu parçalara ayrılıyor…")
            val parts = CloudReader.split(run.claim)
            val queries = parts.map { part ->
                val vector = Embedder.embed(Vectors.queryText(path, part)) ?: run {
                    db.setRun(state = Db.RUN_FAILED, message = "Sorgunun bir bölümü okunamadı.")
                    return false
                }
                part to vector
            }
            val directUrls = linkedSetOf<String>()
            if (Settings.live(ctx) && !stopped()) {
                try { live(run, queries.map { it.second }, path, say, stopped, directUrls) }
                catch (e: CancellationException) { throw e }
                catch (e: Exception) { say("Canlı arama yapılamadı (${e.message}); telefondaki belgelerle sürüyor.") }
            }
            if (stopped()) return false
            say("Yargıya anlamca en yakın paragraflar bulunuyor…")
            val total = Settings.candidates(ctx)
            val picked = LinkedHashSet<ParagraphReading>()
            // Leave room for both the exact addresses the user supplied and results from the wider crawl.
            if (directUrls.isNotEmpty()) {
                val reserve = maxOf(queries.size, total / 3)
                val direct = queries.map { (part, vector) ->
                    part to db.closest(vector, reserve, run.range, run.sourceIds, directUrls, directOnly = true)
                }
                picked.addAll(SearchSelection.readings(direct).take(reserve).toList())
            }
            val general = queries.map { (part, vector) ->
                part to db.closest(vector, total, run.range, run.sourceIds, directUrls)
            }
            picked.addAll(SearchSelection.readings(general).filterNot { it in picked }.take(total - picked.size).toList())
            return !stopped() && db.prepareItems(run.startedAt, picked.toList())
        } finally {
            Embedder.release()
        }
    }

    private suspend fun live(
        run: SearchRun, qs: List<FloatArray>, path: String, say: suspend (String) -> Unit,
        stopped: () -> Boolean, directUrls: MutableSet<String>,
    ) {
        val sources = db.sources().filter { run.sourceIds == null || it.id in run.sourceIds }
        if (sources.isEmpty()) return
        val crawler = Crawler(ctx, stopped)
        val explicitSources = sources.filter { Sources.hasPageAddress(it.url) }
        val readAddresses = HashSet<String>()
        for (source in explicitSources) {
            if (stopped()) return
            say("Eklenen belge okunuyor (${source.name})…")
            val result = withContext(Dispatchers.IO) { crawler.read(source, source.url) }
            val url = result.documentUrl ?: continue
            if (directUrls.add(url)) indexDocument(url, path)
            readAddresses += source.url
            readAddresses += url
        }

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
            if (url in readAddresses) continue
            // Short titles such as "Obezite", "Kanser" or "HIV" still describe valid documents.
            val text = title.trim().ifEmpty { Extract.slugText(url) }
            if (text.isBlank()) continue
            val v = Embedder.embed(Vectors.docText(path, text)) ?: continue
            val vb = Vectors.toBytes(v)
            scored += Triple(qs.maxOf { Vectors.score(vb, it) }, source, url)
        }
        val top = SearchSelection.diverse(scored.sortedByDescending { it.first }, Settings.liveRead(ctx)) { it.second.id }

        // 3. Open them, read them, and give their paragraphs meaning vectors at once.
        for ((n, t) in top.withIndex()) {
            if (stopped()) return
            val (_, s, url) = t
            say("Canlı: belge ${n + 1}/${top.size} okunuyor (${s.name})…")
            val result = withContext(Dispatchers.IO) { crawler.read(s, url) }
            db.markQueued(url, result.state)
            result.documentUrl?.let { if (it !in directUrls) indexDocument(it, path) }
            delay(500)
        }
    }

    private suspend fun indexDocument(url: String, path: String) {
        val vectors = db.paragraphsOfDoc(url).map { (id, text) ->
            val vector = Embedder.embed(Vectors.docText(path, text))
            id to (vector?.let(Vectors::toBytes) ?: ByteArray(0))
        }
        db.saveVectors(vectors)
    }

    /** The trained NLI model reads the original paragraph and the claim directly. */
    suspend fun judge(reading: ParagraphReading): String {
        val p = db.paragraph(reading.paragraphId) ?: return "UNRELATED"
        return Nli.judge(p.text, reading.query)
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
            .distinctBy { it.paragraph.id to it.judgement.verdict }
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
