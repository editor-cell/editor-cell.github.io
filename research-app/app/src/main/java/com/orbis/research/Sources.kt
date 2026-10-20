package com.orbis.research

import java.net.URI

data class Source(val id: Long, val url: String, val name: String, val scope: String, val addedAt: Long, val docCount: Int = 0)

data class Paragraph(
    val id: Long, val text: String, val docUrl: String, val docTitle: String,
    val docDate: String, val sourceName: String,
)

data class SourceInput(val url: String, val name: String, val scope: String)

/**
 * Turns whatever the owner pastes or imports into sources: one address per line, a CSV with a
 * name and an address, a plain list separated by commas or spaces, or a Feedly/OPML export.
 * A source covers its site (and its subdomains): who.int covers www.who.int and iris.who.int.
 */
object Sources {
    private val opmlOutline = Regex("""<outline\b[^>]*>""", RegexOption.IGNORE_CASE)
    private fun attr(tag: String, name: String) =
        Regex("""\b$name\s*=\s*"([^"]*)"""", RegexOption.IGNORE_CASE).find(tag)?.groupValues?.get(1)?.let(::unescape)

    private val urlLike = Regex("""(?i)\b((?:https?://)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}(?::\d+)?(?:/[^\s,;"'<>|]*)?)""")

    fun parse(text: String): List<SourceInput> {
        val out = LinkedHashMap<String, SourceInput>()
        fun add(raw: String, name: String?) {
            val s = toSource(raw, name) ?: return
            out.putIfAbsent(s.scope, s)
        }
        if (opmlOutline.containsMatchIn(text)) {
            for (m in opmlOutline.findAll(text)) {
                val tag = m.value
                val site = attr(tag, "htmlUrl")
                val feed = attr(tag, "xmlUrl")
                val title = attr(tag, "title") ?: attr(tag, "text")
                // A feed address is kept: it is the surest way to find a source's new documents.
                (feed ?: site)?.let { add(it, title) }
            }
            return out.values.toList()
        }
        for (line in text.lines()) {
            val l = line.trim()
            if (l.isEmpty() || l.startsWith("#")) continue
            val urls = urlLike.findAll(l).map { it.value.trimEnd('.', ')', ']') }.toList()
            if (urls.isEmpty()) continue
            // "Name, https://…" or "Name | https://…": the words before a single address name it.
            val name = if (urls.size == 1) {
                l.substring(0, l.indexOf(urls[0])).trim().trim(',', ';', '|', '\t', '-', ':', '"').trim().ifEmpty { null }
            } else null
            urls.forEach { add(it, name) }
        }
        return out.values.toList()
    }

    fun toSource(raw: String, name: String? = null): SourceInput? {
        val withScheme = if (raw.startsWith("http://", true) || raw.startsWith("https://", true)) raw else "https://$raw"
        val uri = try { URI(withScheme.replace(" ", "%20")) } catch (e: Exception) { return null }
        val host = uri.host?.lowercase() ?: return null
        if (!host.contains('.')) return null
        val scope = host.removePrefix("www.")
        val url = uri.toString()
        return SourceInput(url, name?.takeIf { it.isNotBlank() } ?: scope, scope)
    }

    /** Does an address belong to one of the given scopes? */
    fun inScope(host: String, scopes: Collection<String>): Boolean {
        val h = host.lowercase().removePrefix("www.")
        return scopes.any { h == it || h.endsWith(".$it") }
    }

    /** A plain list the owner can keep, edit and import again: "Name, address" per line. */
    fun export(list: List<Source>): String = buildString {
        appendLine("# Orbis kaynak listesi — her satırda: Ad, adres")
        for (s in list) appendLine("${s.name.replace(",", " ")}, ${s.url}")
    }

    private fun unescape(s: String) = s.replace("&amp;", "&").replace("&quot;", "\"").replace("&apos;", "'")
        .replace("&lt;", "<").replace("&gt;", ">")
}
