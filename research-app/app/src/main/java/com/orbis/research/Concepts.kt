package com.orbis.research

/** One idea a claim joins, with the English and Turkish words and phrases a report would use for it. */
data class Concept(val name: String, val terms: List<String>)

/**
 * The key concepts of a claim, found once at the start of a search, and the check that a paragraph
 * speaks of them. The language model reads only paragraphs that pass: a small model asked about a
 * paragraph on the competitiveness of banks would sometimes still call it support for a claim on
 * interest rates and stagnation, so a paragraph that does not even use the claim's words never
 * reaches it. Plain Kotlin, no Android and no model, so the tests run it as it is.
 */
object Concepts {
    const val MAX_CONCEPTS = 3
    const val MAX_TERMS = 12

    const val SYSTEM = "You pick out the key ideas of a claim so that documents can be searched for them."

    /**
     * Two or three ideas, each with the words a report would use for it: English ones and Turkish ones
     * (a source may be in either), many of them, other ways of saying the same and close synonyms,
     * because a paragraph that says "monetary tightening" must be found by a claim that says "raising
     * interest rates". Only things and events, never directions (rise, fall, effect): a paragraph that
     * says there was no effect, or the opposite, speaks of the same things. Whether the paragraph
     * means what the claim says is the language model's job afterwards, not this check's.
     */
    fun prompt(claim: String, english: String?): String {
        val c = if (english.isNullOrBlank() || english.equals(claim, ignoreCase = true)) claim else "$claim\n(English: $english)"
        return "List the 2 or 3 key ideas this claim joins, for example a measure or cause, what it aims at, and what " +
            "is said to follow. A short claim, question or topic may have just one. Name only things and events the " +
            "claim is about, never directions or changes (rise, fall, more, less, effect). For each idea write a short " +
            "English name, a colon, and 8 to 10 words or phrases a report would use for it, in lowercase, separated by " +
            "commas: first English ones, then Turkish ones. Give different ways of saying the same thing, close " +
            "synonyms and other word forms, not one phrase repeated. One idea per line, each starting with \"- \".\n\n" +
            "Example claim: Okullarda cep telefonu yasağı koyan ülkelerde öğrenci başarısı arttı.\n" +
            "- school phone ban: phone ban, ban on phones, mobile phone ban, smartphone ban, restrict phones, phones banned, " +
            "telefon yasağı, cep telefonu yasağı, telefonların yasaklanması\n" +
            "- student achievement: achievement, test scores, exam results, academic performance, learning outcomes, " +
            "student attainment, öğrenci başarısı, sınav sonuçları, akademik başarı\n\n" +
            "Claim: $c"
    }

    /** Lines of lowercase letters (English and Turkish): a name, a colon, comma-separated terms. */
    const val GRAMMAR = "root ::= concept+\n" +
        "concept ::= \"- \" name \": \" term (\", \" term)* \"\\n\"\n" +
        "name ::= [a-z] [a-z ]*\n" +
        "term ::= letter (letter | \" \")*\n" +
        "letter ::= [a-zçğıöşüâîû]"

    /**
     * The concepts in the model's answer; a line that does not fit is left out. The concept's own
     * name counts as one of its terms.
     */
    fun parse(raw: String?): List<Concept> {
        if (raw.isNullOrBlank()) return emptyList()
        val out = ArrayList<Concept>()
        for (line in raw.lines()) {
            val t = line.trim().removePrefix("-").removePrefix("•").trim()
            if (!t.contains(':')) continue
            val name = tidy(t.substringBefore(':'))
            if (name.length < 3) continue
            val terms = (listOf(name) + t.substringAfter(':').split(',').map { tidy(it) })
                .filter { it.length >= 3 }.distinct().take(MAX_TERMS)
            out += Concept(name.take(60), terms)
            if (out.size == MAX_CONCEPTS) break
        }
        return out
    }

    /** The concepts as saved with the search; [parse] reads them back. */
    fun format(list: List<Concept>): String = list.joinToString("\n") { "- ${it.name}: ${it.terms.joinToString(", ")}" }

    /** The concepts for showing: the names only. */
    fun names(list: List<Concept>): String = list.joinToString(" · ") { it.name }

    private fun tidy(s: String) = s.replace('İ', 'i').lowercase().replace(Regex("[^\\p{L}\\p{N} ]"), " ").replace(Regex("\\s+"), " ").trim()

    /** Turkish letters as plain ones (and the capital dotted İ), so "yasağı" and "YASAGI", "ısıtma" and "ISITMA" are one word. */
    private fun fold(s: String) = s.replace('İ', 'i').lowercase()
        .replace('ç', 'c').replace('ğ', 'g').replace('ı', 'i').replace('ö', 'o').replace('ş', 's').replace('ü', 'u')
        .replace('â', 'a').replace('î', 'i').replace('û', 'u')

    private val STOP = setOf("a", "an", "the", "of", "in", "on", "to", "for", "and", "or", "by", "with", "at", "as")

    private fun words(text: String): List<String> = Regex("[\\p{L}\\p{N}]+").findAll(fold(text)).map { it.value }.toList()

    /** Whether two words are forms of one word: raise and raised, rate and rates, stagnant and stagnation. */
    fun sameWord(a: String, b: String): Boolean {
        if (a == b) return true
        val short = minOf(a.length, b.length)
        if (short <= 3) return a == b + "s" || a == b + "es" || b == a + "s" || b == a + "es"
        if (kotlin.math.abs(a.length - b.length) > 5) return false
        var p = 0
        while (p < short && a[p] == b[p]) p++
        return p >= maxOf(4, short - 2)
    }

    /** A term is in the text when each of its words, small words aside, is there in some form. */
    private fun has(term: String, tokens: List<String>): Boolean {
        val ws = words(term).filter { it !in STOP }
        return ws.isNotEmpty() && ws.all { w -> tokens.any { sameWord(it, w) } }
    }

    /** How many of the concepts the text speaks of. */
    fun covered(text: String, concepts: List<Concept>): Int {
        val tokens = words(text).distinct()
        return concepts.count { c -> c.terms.any { has(it, tokens) } }
    }

    /** How many of [n] concepts a paragraph must speak of: two thirds, rounded up; one concept, that one. */
    fun needed(n: Int) = (2 * n + 2) / 3

    /** Whether the paragraph may go to the model; with no concepts (none could be found) every one may. */
    fun passes(text: String, concepts: List<Concept>) = concepts.isEmpty() || covered(text, concepts) >= needed(concepts.size)
}
