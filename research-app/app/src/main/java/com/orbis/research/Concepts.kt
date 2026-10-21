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
            "claim is about, not years or numbers. Never use words that only say a direction or a change (rise, fall, higher, " +
            "lower, reduce, increase, effect) in a name or in the words. For each idea write a short English name, a colon, and 8 to 10 " +
            "words or phrases a report would use for it, mostly one or two words, in lowercase, separated by commas: first " +
            "English ones, then Turkish ones. Give different ways of saying the same thing: synonyms and related words, " +
            "not one phrase repeated. One idea per line, each starting with \"- \".\n\n" +
            "Example claim: Okullarda cep telefonu yasağı koyan ülkelerde öğrenci başarısı arttı.\n" +
            "- school phone ban: phone ban, smartphone ban, phones banned, restrict phones, mobile phone restrictions, " +
            "telefon yasağı, cep telefonu yasağı, telefonların yasaklanması\n" +
            "- student achievement: achievement, attainment, test scores, exam results, academic performance, learning outcomes, " +
            "öğrenci başarısı, sınav sonuçları, akademik başarı\n\n" +
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
            if (name.length < 3 || !namesSomething(name)) continue
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

    /** Words that say only which way a thing goes, not what it is: "reduce inflation" is about inflation. */
    private val DIRECTION = setOf(
        "increase", "increased", "increases", "increasing", "rise", "rises", "rising", "rose", "risen", "raise", "raised", "raises",
        "raising", "higher", "high", "hike", "hikes", "hiked", "growth", "grow", "grows", "growing", "grew", "boost", "boosted", "surge",
        "jump", "elevation", "elevated", "upward", "lower", "lowered", "lowering", "reduce", "reduced", "reduces", "reducing",
        "reduction", "decrease", "decreased", "decreases", "decreasing", "decline", "declined", "declines", "declining", "fall",
        "falling", "falls", "fell", "drop", "dropped", "drops", "dropping", "cut", "cuts", "cutting", "downward", "less", "more",
        "fewer", "effect", "effects", "impact", "impacts", "change", "changes", "changing", "control", "combat", "fight", "curb",
        "tackle", "artis", "artisi", "artmasi", "yukselis", "yukselme", "yukseltilmesi", "dusus", "dususu", "dusme", "azalma",
        "azalis", "azalmasi", "azaltilmasi",
    )

    /** Words that make a name no idea: negations and years ("did not reduce", "twenty twenty three"). */
    private val FILLER = setOf(
        "did", "do", "does", "not", "no", "never", "without", "year", "years", "zero", "one", "two", "three", "four", "five", "six",
        "seven", "eight", "nine", "ten", "twenty", "thirty", "forty", "fifty", "hundred", "thousand",
    )

    /** Whether a concept's name holds a word that names a thing, not only a direction, a negation or a number. */
    private fun namesSomething(name: String) =
        words(name).any { it !in STOP && it !in DIRECTION && it !in FILLER && !it.all(Char::isDigit) }

    /** How many of [ws] must be in the text: all, but of a term of three or more words one may be missing. */
    private fun enough(found: Int, n: Int) = found >= if (n >= 3) n - 1 else n

    /**
     * A term is in the text when each of its words, small words aside, is there in some form (one may be
     * missing from a term of three or more). If not, the term is tried without the words that only say
     * direction, when what is left still names something: two words, or one of six letters or more.
     */
    private fun has(term: String, tokens: List<String>): Boolean {
        val all = words(term).filter { it !in STOP }
        if (all.isEmpty()) return false
        fun count(ws: List<String>) = ws.count { w -> tokens.any { sameWord(it, w) } }
        if (enough(count(all), all.size)) return true
        val core = all.filter { it !in DIRECTION }
        if (core.isEmpty() || core.size == all.size) return false
        if (core.size == 1 && core[0].length < 6) return false
        return enough(count(core), core.size)
    }

    /** How many of the concepts the text speaks of. */
    fun covered(text: String, concepts: List<Concept>): Int {
        val tokens = words(text).distinct()
        return concepts.count { c -> c.terms.any { has(it, tokens) } }
    }

    /** How many of [n] concepts a paragraph must speak of: two thirds, rounded up; one concept, that one. */
    fun needed(n: Int) = (2 * n + 2) / 3

    /**
     * Whether the paragraph may go to the model; with no concepts (none could be found) every one may.
     * A paragraph that speaks of one of the ideas also passes when its neighbours in the document
     * ([near], the paragraph before and after) speak of enough of the others together with it.
     */
    fun passes(text: String, concepts: List<Concept>, near: String = ""): Boolean {
        if (concepts.isEmpty()) return true
        val need = needed(concepts.size)
        val own = covered(text, concepts)
        if (own >= need) return true
        return near.isNotBlank() && own >= 1 && covered("$text $near", concepts) >= need
    }
}
