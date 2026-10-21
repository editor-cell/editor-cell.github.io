package com.orbis.research

import org.jsoup.Jsoup
import org.jsoup.parser.Parser
import java.text.SimpleDateFormat
import java.util.Locale

class Page(val title: String, val date: String, val paragraphs: List<String>, val links: List<String>, val pdfLinks: List<String>)

class Listing(val docs: List<Pair<String, String>>, val sitemaps: List<String>, val titles: Map<String, String> = emptyMap())

/** Reads documents and listings into plain parts. The words of a paragraph are never changed. */
object Extract {
    private const val MIN_CHARS = 60
    private const val MAX_CHARS = 1500

    fun html(url: String, html: String): Page {
        val doc = Jsoup.parse(html, url)
        val title = meta(doc, "citation_title") ?: meta(doc, "og:title") ?: doc.title().trim().ifEmpty { url }
        val date = normDate(
            meta(doc, "citation_publication_date") ?: meta(doc, "article:published_time") ?: meta(doc, "dcterms.date")
                ?: meta(doc, "DC.date") ?: meta(doc, "date") ?: doc.selectFirst("time[datetime]")?.attr("datetime") ?: "",
        )
        val links = doc.select("a[href]").map { it.absUrl("href").substringBefore('#') }.filter { it.startsWith("http") }.distinct()
        val pdfLinks = (links.filter { looksPdf(it) } + listOfNotNull(meta(doc, "citation_pdf_url"))).distinct()

        val body = doc.body() ?: return Page(title, date, emptyList(), links, pdfLinks)
        body.select("script, style, noscript, nav, header, footer, aside, form, svg, button, [role=navigation], [aria-hidden=true]").remove()
        val main = body.selectFirst("main, article, [role=main]") ?: body

        val seen = HashSet<String>()
        val out = ArrayList<String>()
        fun take(t: String) {
            val text = t.trim()
            if (text.length >= MIN_CHARS && text.count { it == ' ' } >= 7 && seen.add(text)) out += splitLong(text)
        }
        for (el in main.select("p, li, blockquote, dd")) {
            // A list item or quote that holds paragraphs is read through those paragraphs.
            if (el.tagName() != "p" && el.select("p, li").any { it !== el }) continue
            take(el.text())
        }
        if (out.size < 3) {
            // Pages without paragraph tags: blocks of text that sit directly in a container.
            for (el in main.select("div, section, td")) if (el.ownText().length >= 120) take(el.ownText())
        }
        return Page(title, date, out, links, pdfLinks)
    }

    /**
     * PDF text arrives line by line; [PARA] marks where the PDF reader saw a paragraph end.
     * Lines of one paragraph are joined; a word broken at a line end keeps its hyphen.
     */
    fun pdfParagraphs(text: String): List<String> {
        val out = ArrayList<String>()
        val seen = HashSet<String>()
        for (block in text.split(PARA, "\n\n", "\r\n\r\n")) {
            val lines = block.lines().map { it.trim() }.filter { it.isNotEmpty() }
            if (lines.isEmpty()) continue
            val sb = StringBuilder()
            for (l in lines) {
                if (sb.isEmpty()) sb.append(l)
                else if (sb.last() == '-' && l.first().isLowerCase()) sb.append(l)
                else sb.append(' ').append(l)
            }
            val p = sb.toString().replace(Regex("\\s+"), " ").trim()
            if (p.length >= MIN_CHARS && p.count { it == ' ' } >= 7 && seen.add(p)) out += splitLong(p)
        }
        return out
    }

    const val PARA = " "

    /** Over-long blocks are cut between sentences, so each piece is still the source's own words. */
    fun splitLong(p: String): List<String> {
        if (p.length <= MAX_CHARS) return listOf(p)
        val sentences = Regex("(?<=[.!?])\\s+(?=[A-Z0-9\"“(])").split(p)
        val out = ArrayList<String>()
        val sb = StringBuilder()
        for (s in sentences) {
            if (sb.isNotEmpty() && sb.length + s.length + 1 > 1200) { out += sb.toString(); sb.clear() }
            if (sb.isNotEmpty()) sb.append(' ')
            sb.append(s)
        }
        if (sb.isNotEmpty()) out += sb.toString()
        return out
    }

    /** A sitemap, sitemap index, RSS or Atom feed: the document addresses in it, with their dates. */
    fun listing(xml: String, base: String): Listing {
        val doc = Jsoup.parse(xml, base, Parser.xmlParser())
        val sitemaps = doc.select("sitemapindex > sitemap > loc").map { it.text().trim() }
        val docs = ArrayList<Pair<String, String>>()
        val titles = HashMap<String, String>()
        for (u in doc.select("urlset > url")) {
            val loc = u.selectFirst("loc")?.text()?.trim() ?: continue
            docs += loc to normDate(u.selectFirst("lastmod")?.text() ?: "")
        }
        for (item in doc.select("item")) {
            val link = item.selectFirst("link")?.text()?.trim()?.ifEmpty { null }
                ?: item.selectFirst("guid")?.text()?.trim()?.takeIf { it.startsWith("http") } ?: continue
            docs += link to normDate(item.selectFirst("pubDate, dc|date, date")?.text() ?: "")
            item.selectFirst("title")?.text()?.trim()?.takeIf { it.isNotEmpty() }?.let { titles[link] = it }
        }
        for (entry in doc.select("entry")) {
            val links = entry.select("link")
            val link = (links.firstOrNull { it.attr("rel").isEmpty() || it.attr("rel") == "alternate" } ?: links.firstOrNull())
                ?.attr("href")?.trim()?.ifEmpty { null } ?: continue
            docs += link to normDate(entry.selectFirst("published, updated")?.text() ?: "")
            entry.selectFirst("title")?.text()?.trim()?.takeIf { it.isNotEmpty() }?.let { titles[link] = it }
        }
        return Listing(docs, sitemaps, titles)
    }

    /**
     * What an address says about its document, for choosing which to open: the last two parts of
     * its path as words ("/en/news/sugar-tax-report-2023.html" -> "news sugar tax report 2023").
     */
    fun slugText(url: String): String {
        val path = url.substringAfter("://").substringAfter('/', "").substringBefore('?').substringBefore('#')
        return path.split('/').filter { it.isNotEmpty() }.takeLast(2).joinToString(" ")
            .replace(Regex("(?i)\\.(html?|aspx?|php|pdf)$"), "")
            .replace(Regex("[-_+.]+"), " ").replace(Regex("%20"), " ").replace(Regex("\\s+"), " ").trim()
    }

    fun feedLinks(html: String, base: String): List<String> =
        Jsoup.parse(html, base).select("link[rel=alternate][type~=(?i)(rss|atom)]")
            .map { it.absUrl("href") }.filter { it.isNotEmpty() }.distinct()

    private val skipExt = Regex("(?i)\\.(jpe?g|png|gif|webp|svg|ico|css|js|json|zip|gz|rar|7z|mp3|mp4|m4a|wav|avi|mov|webm|xlsx?|csv|docx?|pptx?|xml|rss|epub|exe|dmg|apk)(\\?.*)?$")
    private val skipPath = Regex("(?i)/(tag|tags|category|categories|author|search|login|signin|signup|register|cart|account|share|print|feed|wp-admin|wp-json)(/|$|\\?)")

    fun looksPdf(url: String) = Regex("(?i)\\.pdf(\\?.*)?$").containsMatchIn(url) || url.contains("/bitstream/") || url.contains("/download/")

    /** Could this address be a document to read (a page or a PDF), rather than a picture or a menu? */
    fun looksLikeDocument(url: String): Boolean {
        if (!url.startsWith("http")) return false
        if (skipExt.containsMatchIn(url) || skipPath.containsMatchIn(url)) return false
        val path = url.substringAfter("://").substringAfter('/', "")
        return path.isNotEmpty()
    }

    private fun meta(doc: org.jsoup.nodes.Document, name: String): String? =
        (doc.selectFirst("meta[name=$name]") ?: doc.selectFirst("meta[property=$name]"))?.attr("content")?.trim()?.ifEmpty { null }

    private val rfc822 = listOf("EEE, dd MMM yyyy HH:mm:ss Z", "EEE, d MMM yyyy HH:mm:ss Z", "dd MMM yyyy HH:mm:ss Z", "EEE, dd MMM yyyy HH:mm Z", "EEE, dd MMM yyyy HH:mm:ss zzz")

    /** Any date the sources write, as yyyy-MM-dd (or yyyy-MM, yyyy); empty when unknown. */
    fun normDate(raw: String): String {
        val s = raw.trim()
        if (s.isEmpty()) return ""
        Regex("^(\\d{4})[-/](\\d{1,2})(?:[-/](\\d{1,2}))?").find(s)?.let { m ->
            val (y, mo, d) = m.destructured
            return if (d.isEmpty()) "%s-%02d".format(y, mo.toInt()) else "%s-%02d-%02d".format(y, mo.toInt(), d.toInt())
        }
        for (f in rfc822) {
            try {
                val dt = SimpleDateFormat(f, Locale.US).apply { isLenient = true }.parse(s) ?: continue
                return SimpleDateFormat("yyyy-MM-dd", Locale.US).format(dt)
            } catch (e: Exception) { }
        }
        Regex("^(\\d{4})$").find(s)?.let { return it.value }
        return ""
    }
}
