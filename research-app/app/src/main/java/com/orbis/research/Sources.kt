package com.orbis.research

import java.net.URI

data class Source(
    val id: Long, val url: String, val name: String, val scope: String, val addedAt: Long,
    val docCount: Int = 0, val groups: List<String> = emptyList(),
)

/** A heading the owner files sources under ("Sağlık", "Ekonomi"); a source can sit under several. */
data class Group(val id: Long, val name: String, val sourceCount: Int)

data class Paragraph(
    val id: Long, val text: String, val docUrl: String, val docTitle: String,
    val docDate: String, val sourceName: String,
)

data class SourceInput(val url: String, val name: String, val scope: String, val groups: List<String> = emptyList())

/**
 * Turns whatever the owner pastes or imports into sources: one address per line, a CSV with a
 * name, an address and headings ("Name, address, Heading; Heading"), a plain list separated by
 * commas or spaces, or a Feedly/OPML export, whose folders become headings.
 * A source covers its site (and its subdomains): who.int covers www.who.int and iris.who.int.
 */
object Sources {
    private val opmlTag = Regex("""<outline\b[^>]*>|</outline\s*>""", RegexOption.IGNORE_CASE)
    private fun attr(tag: String, name: String) =
        Regex("""\b$name\s*=\s*"([^"]*)"""", RegexOption.IGNORE_CASE).find(tag)?.groupValues?.get(1)?.let(::unescape)

    private val urlLike = Regex("""(?i)\b((?:https?://)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}(?::\d+)?(?:/[^\s,;"'<>|]*)?)""")

    fun parse(text: String): List<SourceInput> {
        val out = LinkedHashMap<String, SourceInput>()
        fun add(raw: String, name: String?, groups: List<String>) {
            val s = toSource(raw, name, groups) ?: return
            val had = out[s.scope]
            out[s.scope] = had?.copy(groups = (had.groups + s.groups).distinct()) ?: s
        }
        if (opmlTag.containsMatchIn(text) && text.contains("<opml", ignoreCase = true)) {
            // Folders are outlines without an address; the feeds inside one sit under its name.
            val folders = ArrayList<String?>()
            for (m in opmlTag.findAll(text)) {
                val tag = m.value
                if (tag.startsWith("</")) { if (folders.isNotEmpty()) folders.removeAt(folders.size - 1); continue }
                val site = attr(tag, "htmlUrl")
                val feed = attr(tag, "xmlUrl")
                val title = attr(tag, "title") ?: attr(tag, "text")
                // A feed address is kept: it is the surest way to find a source's new documents.
                (feed ?: site)?.let { add(it, title, listOfNotNull(folders.lastOrNull { f -> f != null })) }
                if (!tag.endsWith("/>")) folders += if (feed == null && site == null) title?.trim()?.ifEmpty { null } else null
            }
            return out.values.toList()
        }
        for (line in text.lines()) {
            val l = line.trim()
            if (l.isEmpty() || l.startsWith("#")) continue
            val urls = urlLike.findAll(l).map { it.value.trimEnd('.', ')', ']') }.toList()
            if (urls.isEmpty()) continue
            if (urls.size > 1) { urls.forEach { add(it, null, emptyList()) }; continue }
            // "Name, https://…, Heading; Heading": words before the address name it, and after a
            // separator the headings follow.
            val at = l.indexOf(urls[0])
            val name = l.substring(0, at).trim().trim(',', ';', '|', '\t', '-', ':', '"').trim().ifEmpty { null }
            val rest = l.substring(at + urls[0].length).trim()
            val groups = if (rest.isNotEmpty() && rest[0] in ",|\t;") splitGroups(rest.substring(1)) else emptyList()
            add(urls[0], name, groups)
        }
        return out.values.toList()
    }

    fun splitGroups(text: String): List<String> =
        text.split(';', ',').map { it.trim().trim('"').trim() }.filter { it.isNotEmpty() }.distinct()

    fun toSource(raw: String, name: String? = null, groups: List<String> = emptyList()): SourceInput? {
        val withScheme = if (raw.startsWith("http://", true) || raw.startsWith("https://", true)) raw else "https://$raw"
        val uri = try { URI(withScheme.replace(" ", "%20")) } catch (e: Exception) { return null }
        val host = uri.host?.lowercase() ?: return null
        if (!host.contains('.')) return null
        val scope = host.removePrefix("www.")
        val url = uri.toString()
        return SourceInput(url, name?.takeIf { it.isNotBlank() } ?: scope, scope, groups)
    }

    /** Does an address belong to one of the given scopes? */
    fun inScope(host: String, scopes: Collection<String>): Boolean {
        val h = host.lowercase().removePrefix("www.")
        return scopes.any { h == it || h.endsWith(".$it") }
    }

    /** A plain list the owner can keep, edit and import again: "Name, address, Heading; Heading" per line. */
    fun export(list: List<Source>): String = buildString {
        appendLine("# Orbis kaynak listesi — her satırda: Ad, adres, Başlık; Başlık")
        for (s in list) {
            append("${s.name.replace(",", " ")}, ${s.url}")
            if (s.groups.isNotEmpty()) append(", ").append(s.groups.joinToString("; ") { it.replace(",", " ").replace(";", " ") })
            appendLine()
        }
    }

    private fun unescape(s: String) = s.replace("&amp;", "&").replace("&quot;", "\"").replace("&apos;", "'")
        .replace("&lt;", "<").replace("&gt;", ">")
}
