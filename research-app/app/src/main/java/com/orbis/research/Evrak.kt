package com.orbis.research

/**
 * One document's part of the evrak: where it comes from, and its paragraphs in the document's own
 * order. A part with [Part.gap] follows text of the document that was left out.
 */
data class EvrakDoc(val title: String, val source: String, val date: String, val url: String, val parts: List<Part>) {
    data class Part(val text: String, val gap: Boolean)
}

/**
 * The evrak: the paragraphs that support the claim, then those that go against it, joined into one
 * document, word for word, each
 * under its document's title, source, date and address. No labels, reasons or analogies: only the
 * documents' own words.
 */
object Evrak {
    /**
     * [found]: each supporting paragraph with its place in its document (-1 if unknown), best first.
     * Documents keep the order of their best paragraph; within a document the paragraphs follow
     * the document. A paragraph whose words already appear (the same page under two addresses) is
     * left out.
     */
    fun group(found: List<Pair<Paragraph, Int>>): List<EvrakDoc> {
        val seen = HashSet<String>()
        val byDoc = LinkedHashMap<String, MutableList<Pair<Paragraph, Int>>>()
        for ((p, at) in found) {
            if (!seen.add(p.text.trim())) continue
            byDoc.getOrPut(p.docUrl) { ArrayList() } += p to at
        }
        return byDoc.values.map { list ->
            val first = list.first().first
            val sorted = list.sortedBy { it.second }
            val parts = sorted.mapIndexed { i, (p, at) ->
                EvrakDoc.Part(p.text.trim(), gap = i > 0 && (at < 0 || sorted[i - 1].second < 0 || at != sorted[i - 1].second + 1))
            }
            EvrakDoc(first.docTitle.ifBlank { first.docUrl }, first.sourceName, first.docDate, first.docUrl, parts)
        }
    }

    /** The file name: the claim's first words and the day. */
    fun fileName(claim: String, day: String): String {
        val ascii = claim.lowercase().map { "çğıöşüâîû".indexOf(it).let { i -> if (i >= 0) "cgiosuaiu"[i] else it } }.joinToString("")
        val words = ascii.replace(Regex("[^\\p{L}\\p{N}]+"), " ").trim().split(' ').filter { it.isNotEmpty() }.take(5)
        return "Orbis-evrak-" + (words.joinToString("-").ifEmpty { "arama" }) + "-$day.pdf"
    }
}
