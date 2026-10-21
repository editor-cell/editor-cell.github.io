package com.orbis.research

import android.content.Context
import com.tom_roush.pdfbox.android.PDFBoxResourceLoader
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.text.PDFTextStripper
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import java.io.ByteArrayInputStream
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.zip.GZIPInputStream

/** What the collector is doing now; the screen shows it. */
object Progress {
    val text = MutableStateFlow("")
    val running = MutableStateFlow(false)
}

/**
 * Finds the documents a source publishes (its feeds, its sitemaps, the links on its front page)
 * and reads the newest unread ones into the phone. It never leaves the listed sites.
 */
class Crawler(private val ctx: Context, private val stop: () -> Boolean) {
    private val db = Db.get(ctx)
    private var scopes: Set<String> = db.sources().map { it.scope }.toSet()
    private val net = Net { scopes }

    init { PDFBoxResourceLoader.init(ctx.applicationContext) }

    suspend fun run(perSource: Int, onlyIds: Set<Long>? = null) {
        val sources = db.sources().filter { onlyIds == null || it.id in onlyIds }
        scopes = db.sources().map { it.scope }.toSet()
        for ((i, s) in sources.withIndex()) {
            if (stop()) return
            val head = "${i + 1}/${sources.size} ${s.name}"
            Progress.text.value = "$head: belge listesi aranıyor…"
            try { discover(s) } catch (e: Exception) { Progress.text.value = "$head: liste alınamadı (${e.message})" }
            val urls = db.nextInQueue(s.id, perSource)
            for ((j, url) in urls.withIndex()) {
                if (stop()) return
                Progress.text.value = "$head: belge ${j + 1}/${urls.size} okunuyor"
                db.markQueued(url, read(s, url))
                delay(800)
            }
        }
        val (docs, paras) = db.totals()
        Progress.text.value = "Bitti. Telefonda $docs belge, $paras paragraf var."
    }

    /** Reads a source's feeds, sitemaps and front page for document addresses and queues the new ones. */
    suspend fun discover(s: Source, force: Boolean = false) {
        if (!force && db.queueSize(s.id) > MAX_QUEUE) return
        scopes = db.sources().map { it.scope }.toSet()
        val base = s.url.substringBefore("://") + "://" + s.url.substringAfter("://").substringBefore('/')
        val found = ArrayList<Pair<String, String>>()
        val titles = HashMap<String, String>()
        val sitemaps = ArrayDeque<String>()

        val front = fetchText(s.url)
        if (front != null) {
            if (isXml(front)) {
                val l = Extract.listing(front, s.url); found += l.docs; titles += l.titles; sitemaps += l.sitemaps
            } else {
                for (feed in Extract.feedLinks(front, s.url).filter { inScope(it) }.take(5)) {
                    fetchText(feed)?.let { x -> Extract.listing(x, feed).let { found += it.docs; titles += it.titles } }
                }
                val page = Extract.html(s.url, front)
                found += (page.links + page.pdfLinks).map { it to "" }
            }
        }
        sitemaps += net.sitemapsFromRobots(base)
        if (sitemaps.isEmpty()) sitemaps += listOf("$base/sitemap.xml", "$base/sitemap_index.xml")

        val seen = HashSet<String>()
        var n = 0
        while (sitemaps.isNotEmpty() && n < MAX_SITEMAPS && !stop()) {
            val sm = sitemaps.removeFirst()
            if (!seen.add(sm) || !inScope(sm)) continue
            n++
            val xml = fetchText(sm) ?: continue
            val l = Extract.listing(xml, sm)
            found += l.docs
            titles += l.titles
            // Newest sitemaps first when an index names its children by year or number.
            sitemaps.addAll(l.sitemaps.sortedDescending())
            delay(300)
        }
        val docs = found.filter { (u, _) -> inScope(u) && Extract.looksLikeDocument(u) }
            .map { (u, d) -> u.substringBefore('#') to d }
            .distinctBy { it.first }
        db.enqueue(s.id, docs, titles)
    }

    /** Reads one address; returns its queue state: 1 read, 2 nothing usable, 3 refused by the site. */
    fun read(s: Source, url: String): Int {
        if (db.hasDoc(url)) return 1
        return try {
            if (!net.allowed(url)) return 3
            val f = net.get(url) ?: return 2
            val isPdf = f.contentType.contains("pdf", true) || f.bytes.startsWith("%PDF".toByteArray())
            if (isPdf) {
                val (title, date, paras) = pdf(f.bytes, url)
                if (paras.isEmpty()) return 2
                db.saveDoc(s.id, f.url, title, date, paras)
            } else {
                if (!f.contentType.contains("html", true) && !f.contentType.isEmpty()) return 2
                val page = Extract.html(f.url, decode(f.bytes, f.contentType))
                val pdfs = page.pdfLinks.filter { inScope(it) }.map { it to page.date }
                if (pdfs.isNotEmpty()) db.enqueue(s.id, pdfs)
                if (page.paragraphs.isEmpty()) return 2
                db.saveDoc(s.id, f.url, page.title, page.date, page.paragraphs)
            }
            1
        } catch (e: OutOfScope) { 3 } catch (e: Exception) { 2 } catch (e: OutOfMemoryError) { 2 }
    }

    private fun pdf(bytes: ByteArray, url: String): Triple<String, String, List<String>> {
        PDDocument.load(bytes).use { doc ->
            val stripper = PDFTextStripper().apply {
                paragraphEnd = Extract.PARA
                pageEnd = Extract.PARA
                endPage = minOf(doc.numberOfPages, 400)
            }
            val text = stripper.getText(doc)
            val info = doc.documentInformation
            val title = info?.title?.trim()?.ifEmpty { null } ?: url.substringAfterLast('/').substringBefore('?')
            val date = info?.creationDate?.let { SimpleDateFormat("yyyy-MM-dd", Locale.US).format(it.time) } ?: ""
            return Triple(title, date, Extract.pdfParagraphs(text))
        }
    }

    private fun fetchText(url: String): String? = try {
        if (!net.allowed(url)) null
        else net.get(url, 30L * 1024 * 1024)?.let { f ->
            val bytes = if (f.bytes.size > 2 && f.bytes[0] == 0x1f.toByte() && f.bytes[1] == 0x8b.toByte())
                GZIPInputStream(ByteArrayInputStream(f.bytes)).readBytes() else f.bytes
            decode(bytes, f.contentType)
        }
    } catch (e: Exception) { null }

    private fun inScope(url: String) =
        Sources.inScope(url.substringAfter("://").substringBefore('/').substringBefore(':'), scopes)

    private fun isXml(t: String): Boolean {
        val head = t.trimStart().take(400).lowercase()
        return head.startsWith("<?xml") && !head.contains("<html") || head.startsWith("<rss") || head.startsWith("<feed") || head.startsWith("<urlset")
    }

    private fun decode(bytes: ByteArray, contentType: String): String {
        val cs = Regex("charset=([\\w-]+)", RegexOption.IGNORE_CASE).find(contentType)?.groupValues?.get(1)
        return try { String(bytes, charset(cs ?: "UTF-8")) } catch (e: Exception) { String(bytes, Charsets.UTF_8) }
    }

    private fun ByteArray.startsWith(p: ByteArray) = size >= p.size && p.indices.all { this[it] == p[it] }

    companion object {
        const val MAX_SITEMAPS = 40
        const val MAX_QUEUE = 60_000
    }
}
